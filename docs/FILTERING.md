# Advanced Filtering System Architecture & URL Contract

This document specifies the standard filtering, sorting, pagination, and faceting architecture for **SmartAssess v2**.

---

## 1. Five-Layer Architecture

Data flows strictly in one direction from URL state to database query to UI components:

```
┌─ 1. URL (Single source of truth, shareable) ─────────────────────────────────────┐
│  /teacher/exams?q=dbms&status=active,draft&batch=<uuid>                           │
│                 &from=2026-08-01&to=2026-09-30&sort=startTime&dir=desc            │
│                 &page=2&perPage=25                                                │
└──────────────────────────────────────────────────────────────────────────────────┘
        ↓ readParams(schema, searchParams)          ← validate + coerce + drop unknown
┌─ 2. Filter AST (Typed, pure) ────────────────────────────────────────────────────┐
│  lib/filters/schemas.ts      examFilterSchema | resultFilterSchema | liveFilterSchema
│  lib/filters/parse.ts        csv(), intParam(), dateParam(), readParams()
└──────────────────────────────────────────────────────────────────────────────────┘
        ↓ buildExamWhere(ast, scope) / buildResultWhere(examId, ast, scope)
┌─ 3. Prisma Builder (Pure function → Prisma.*WhereInput / OrderByInput[]) ────────┐
│  lib/filters/builders/exams.ts    lib/filters/builders/results.ts                 │
│  No I/O. No `any`. Unit-tested. Uses ONLY allowlisted fields.                     │
└──────────────────────────────────────────────────────────────────────────────────┘
        ↓ one Promise.all per render (bounded query budget ≤ 6 queries)
┌─ 4. Data Access (Server action / RSC) ───────────────────────────────────────────┐
│  rows (skip/take) + total (count) + facets (cheap index-backed counts / groupBy)  │
│  → { rows, total, page, perPage, totalPages, facets }                             │
└──────────────────────────────────────────────────────────────────────────────────┘
        ↓ props
┌─ 5. UI Kit (ui/filters/*) ───────────────────────────────────────────────────────┐
│  FilterBar · SearchInput · FacetSelect · DateRangeFilter · SortMenu ·             │
│  ActiveFilterChips · Pagination · EmptyState · DataTable                          │
│  Client hook useFilterParams() synchronizes the URL                               │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Public URL Contract

| Param | Type & Shape | Example | Description & Notes |
|---|---|---|---|
| `q` | string ≤ 120 | `q=algorithms` | Trimmed, whitespace-collapsed, case-insensitive search (`mode: "insensitive"` in PostgreSQL). |
| `status` | CSV enum | `status=active,upcoming` | Multi-select statuses combined with OR. Computed via timestamps for exams to prevent staleness. |
| `batch` | CSV UUID | `batch=<uuid1>,<uuid2>` | Filters items by batch IDs. |
| `subject` | CSV string | `subject=DBMS,OS` | Matches array values in `Exam.subjects`. |
| `band` | CSV enum | `band=0-40,40-60` | Score bands: `0-40`, `40-60`, `60-75`, `75-100`. |
| `flagged` | boolean | `flagged=1` or `flagged=true` | Violations threshold: `violationCount >= 3`. |
| `from` / `to` | ISO Date (`YYYY-MM-DD`) | `from=2026-08-01` | Half-open window (`[from, to + 1 day)`) on indexed timestamp column. |
| `risk` | enum | `risk=flagged` | Live Monitor: `all` \| `flagged` (≥ 40) \| `critical` (≥ 70). |
| `idle` | minutes int | `idle=5` | Live Monitor: no heartbeat for ≥ N minutes. |
| `dup` | boolean | `dup=true` | Live Monitor: filters for duplicate active IP collisions. |
| `sort` | enum | `sort=percentage` or `sort=-startTime` | Allowlisted field name. Leading `-` denotes descending order. |
| `dir` | `asc` \| `desc` | `dir=desc` | Explicit direction. Supported alongside `-` prefix (leading `-` wins). |
| `page` | integer ≥ 1 | `page=2` | Clamped to total pages. Out-of-bounds displays empty state with "Go to page 1". |
| `perPage` | `10` \| `25` \| `50` \| `100` | `perPage=50` | Number of rows per page. Defaults to 25. |
| `tab` | string | `tab=analytics` | Pre-existing tab state. Preserved across filter modifications. |

### Unknown Parameters
All unknown parameters are preserved and stripped from the filter AST rather than causing a 500 error. Never call `.strict()` on root Zod filter schemas so query params like `tab=` or third-party tracking params degrade gracefully.

---

## 3. Six Non-Negotiable Rules

1. **Server-Side Filtering in SQL**: Every filter and sort runs inside Prisma queries against PostgreSQL indexes. No in-memory `Array.filter()` or `Array.sort()` in server components or server actions. *(The single sanctioned exception is the Live Monitor client dashboard, which must hold the roster in memory to receive Pusher deltas without network round-trips).*
2. **Allowlist Every Field**: A query param must never reach `orderBy`, `select`, or raw SQL without validation against strict TypeScript constants (`EXAM_SORT_FIELDS`, `RESULT_SORT_FIELDS`, etc.).
3. **Authorization Scope First**: Scoping is mandatory and always prepended:
   ```ts
   const scope = teacherExamScope(teacher);
   const where = { AND: [scope, ...userFilters] };
   ```
4. **Every `findMany` Has a `take`**: Maximum `perPage` is 100. Default is 25.
5. **Facets Come From Aggregate Queries**: Facets are never computed from the current page's slice of rows.
6. **Export & Bulk Actions Reuse the Same Builder**: The data exporter calls the exact same `buildResultWhere()` function, ensuring the exported CSV/PDF/Excel matches the on-screen filter results.

---

## 4. The Facet-Exclusion Rule

When calculating facet counts, a facet must **exclude its own filter clause** while respecting all other active filters and the teacher's authorization scope.

### Why?
If a user filters by `status=active`:
- **Wrong:** Running counts with `where: { ...activeFilter }` causes `upcoming`, `draft`, and `expired` counts to show `0`. The user cannot see how many draft exams exist.
- **Correct:** Running counts with `withoutStatus(where)` preserves the counts for all status buckets based on the remaining filters (search, batch, date range, etc.).

### Implementation in SmartAssess:
```ts
// Status facet exclusion:
const [rows, total, active, upcoming, draft, expired] = await Promise.all([
  prisma.exam.findMany({ where, orderBy, skip, take }),
  prisma.exam.count({ where }),
  prisma.exam.count({ where: { AND: [whereWithoutStatus, buildExamStatusWhere(["active"], now)] } }),
  prisma.exam.count({ where: { AND: [whereWithoutStatus, buildExamStatusWhere(["upcoming"], now)] } }),
  prisma.exam.count({ where: { AND: [whereWithoutStatus, buildExamStatusWhere(["draft"], now)] } }),
  prisma.exam.count({ where: { AND: [whereWithoutStatus, buildExamStatusWhere(["expired"], now)] } }),
]);
```

---

## 5. How to Add Filtering to a New Surface (in 3 Steps)

Follow this recipe to add filtering to any future surface (e.g. Batches, Question Bank, Certificate Audit):

### Step 1: Define Schema and Pure Builder (`lib/filters/`)
1. Create a schema in `lib/filters/schemas.ts`:
   ```ts
   export const questionFilterSchema = z.object({
     q: z.string().trim().max(120).optional().catch(undefined),
     difficulty: csv(DIFFICULTY_OPTIONS).optional().catch(undefined),
     topic: z.string().optional().catch(undefined),
     page: intParam(1, 10000, 1),
     perPage: intParam(10, 100, 25),
     sort: z.string().optional(),
     dir: z.enum(["asc", "desc"]).optional(),
   }).transform(...);
   ```
2. Create a pure builder in `lib/filters/builders/questions.ts`:
   - Returns `{ where: Prisma.QuestionWhereInput, orderBy: Prisma.QuestionOrderByWithRelationInput[] }`.
   - Always append stable tiebreaker `{ id: "asc" }`.
   - Add unit tests in `lib/filters/__tests__/questions.test.ts`.

### Step 2: Implement Paged Server Action (`app/actions/question-filters.ts`)
1. Authenticate and resolve user scope.
2. Build `where` and facet `where` clauses using the pure builder.
3. Issue a single `Promise.all` containing `findMany`, `count`, and facet counts (≤ 6 queries).
4. Return `PagedResult<T>`.

### Step 3: Wire the Page and UI Kit (`app/.../page.tsx`)
1. Await Next.js 16 `searchParams`.
2. Parse params using `readParams(questionFilterSchema, searchParams)`.
3. Fetch data via the paged action.
4. Render `<FilterBar defs={filterDefs} />`, `<DataTable />`, and `<Pagination />`.

---

## 6. Live Monitor Special Case (`mode: "history"`)

The **Live Monitor** (`/teacher/exams/[id]/live`) is an active operational cockpit receiving real-time Pusher WebSockets.

- Regular lists use `mode: "navigate"`, calling `router.push()` inside `startTransition` to trigger React Server Component re-renders.
- The Live Monitor wraps controls in `<FilterModeProvider mode="history">`.
- This calls `window.history.replaceState(null, "", targetUrl)` and dispatches a local event.
- Filter changes update the address bar instantly for sharing and bookmarking without triggering a Next.js server navigation that would re-fetch the roster or drop the active WebSocket.

---

## 7. Performance & Index Verification

Every filter and sort combination is backed by a composite index:
- `Exam(batchId, startTime)`: `Exam_batchId_startTime_idx`
- `Exam(published, startTime)`: `Exam_published_startTime_idx`
- `StudentExamSession(examId, percentage)`: `StudentExamSession_examId_percentage_idx`
- `StudentExamSession(examId, violationCount)`: `StudentExamSession_examId_violationCount_idx`
- `StudentExamSession(examId, status)`: `StudentExamSession_examId_status_idx`
- `StudentExamSession(examId, lastHeartbeatAt)`: `StudentExamSession_examId_lastHeartbeatAt_idx`

### Verifying with `EXPLAIN (ANALYZE, BUFFERS)`:
```sql
EXPLAIN ANALYZE 
SELECT * FROM "StudentExamSession"
WHERE "examId" = 'exam-uuid' AND "percentage" < 40 
ORDER BY "percentage" DESC 
LIMIT 25;
-- Expected: Bitmap Index Scan / Index Scan on StudentExamSession_examId_percentage_idx
```
