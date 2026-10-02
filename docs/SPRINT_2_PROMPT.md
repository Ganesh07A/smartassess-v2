# Sprint 2 — Handoff Prompt (copy everything below the line into your agent)

> **How to use this document**
> - **Prerequisite:** Sprint 1 must be merged (PR #15, branch `arena/01a0f81e-smartassess-v2`, or the equivalent on `main`). Sprint 2 consumes the foundations it created — see §2. Verify they exist before starting; if any are missing, stop and report instead of re-implementing them.
> - **Nothing in this sprint exists yet** on any branch. This is new work.
> - Companion documents: `docs/UPGRADE_PLAN_AND_FILTERING.md` (full analysis, Part A = the design this brief expands), `docs/SPRINT_1_PROMPT.md` (foundations brief).

---

## 1. Your role and objective

You are a senior full-stack engineer working on **SmartAssess v2** (Next.js 16 App Router + React 19 Server Components, Prisma 7/PostgreSQL, TypeScript strict).

Today, **no list in the application is filterable**. Every page calls a function that returns *all* rows (`getTeacherExams()`, `getExamResults(examId)`) and, at best, filters them in JavaScript after the fact (`app/student/page.tsx` has three hard-coded tabs applied with `Array.filter` on an already-fetched array). There is no search box, no facet, no sort menu, no pagination, and no way to export "what I'm looking at" rather than "everything".

**Your job:** build the advanced filtering system and wire it up to the three surfaces where teachers feel the pain most — **Teacher Exams**, **Exam Results**, and the **Live Monitor** — so that a teacher with 500 exams and 300 sessions can find any row in two interactions and share that exact view as a link.

**Definition of success:**
1. Every filter state lives in the **URL** and survives reload, back/forward and copy-paste.
2. Filtering, sorting and counting happen **in SQL** (never by mapping a full result set in JS), and every query is bounded.
3. Facet counts are correct even when other facets are active.
4. Exports and bulk actions operate on the **filtered set**, not the current page.
5. Nothing regresses: the live monitor stays real-time, Sprint 1's authorization scopes are used everywhere, and no existing flow changes behaviour for the happy path.

**Do not start Sprint 3+ work** — no item/discrimination analysis, topic-mastery dashboards, manual grading queue, email, or the remaining surfaces (batches, roster, question bank, certificates, student dashboard). Out of scope is listed in §11.

---

## 2. Prerequisites produced by Sprint 1 (reuse, do not duplicate)

| Asset | Where | How Sprint 2 uses it |
|---|---|---|
| `requireTeacher`, `teacherExamScope`, `assertExamAccess`, `assertBatchAccess` | `lib/auth/scope.ts` | Every new query/action must AND the scope **before** user filters, so facet counts can never leak another teacher's data. |
| `parseInput`, `ValidationError` | `lib/validation/parse.ts` | Filter schemas are parsed with the same helper; invalid params degrade to defaults instead of throwing 500s. |
| `StudentExamSession.percentage / totalScore / maxScore / violationCount / riskScore / lastHeartbeatAt / submittedAt` | `prisma/schema.prisma` | These exist **specifically** so results/live lists can filter and sort in SQL. If they are absent, stop — Sprint 2 cannot be built without them. |
| `Question.difficulty / topic / tags` | `prisma/schema.prisma` | Source of the difficulty/topic facets. |
| `Exam.status / examCode / subjects` | `prisma/schema.prisma` | Exam facet/ordering inputs (with the staleness caveat in §6.3). |
| Indexes (`Exam(batchId,startTime)`, `StudentExamSession(examId,percentage)`, `(examId,violationCount)`, `(examId,status)`, `(examId,lastHeartbeatAt)`, …) | `prisma/migrations/20261001120000_filtering_foundation/` | Every filter/sort combination you ship must be served by one of these. Verify with `EXPLAIN` (§9.6). |
| `ui/local-time.tsx` | `ui/` | Any timestamp rendered in a new row (results "submitted at", live "last activity"). |
| `app/error.tsx` | `app/` | Errors from the new actions surface as the friendly boundary. |

**Rule:** if you need a behaviour that Sprint 1 already centralized, import it. Do not re-implement scoping, validation or rate limiting locally.

---

## 3. Architecture: five layers, one direction of dataflow

```
┌─ 1. URL (single source of truth, shareable) ─────────────────────────────────────┐
│  /teacher/exams?q=dbms&status=active,draft&batch=<uuid>                           │
│                 &from=2026-08-01&to=2026-09-30&sort=startTime&dir=desc            │
│                 &page=2&perPage=25                                                │
└──────────────────────────────────────────────────────────────────────────────────┘
        ↓ readParams(schema, searchParams)          ← validate + coerce + drop unknown
┌─ 2. Filter AST (typed, pure) ────────────────────────────────────────────────────┐
│  lib/filters/schemas.ts      examFilterSchema | resultFilterSchema | liveFilterSchema
│  lib/filters/parse.ts        csv(), intParam(), dateParam(), readParams()
└──────────────────────────────────────────────────────────────────────────────────┘
        ↓ buildExamWhere(ast, scope) / buildResultWhere(examId, ast, scope)
┌─ 3. Prisma builder (pure function → Prisma.*WhereInput / OrderByInput[]) ────────┐
│  lib/filters/builders/exams.ts    lib/filters/builders/results.ts                 │
│  No I/O. No `any`. Unit-tested. Uses ONLY allowlisted fields.                     │
└──────────────────────────────────────────────────────────────────────────────────┘
        ↓ one Promise.all per render
┌─ 4. Data access (server action / RSC) ───────────────────────────────────────────┐
│  rows (skip/take) + total (count) + facets (2–5 cheap counts or one groupBy)      │
│  → { rows, total, page, perPage, totalPages, facets }                             │
└──────────────────────────────────────────────────────────────────────────────────┘
        ↓ props
┌─ 5. UI kit (ui/filters/*) ───────────────────────────────────────────────────────┐
│  FilterBar · SearchInput · FacetSelect · DateRangeFilter · SortMenu ·             │
│  ActiveFilterChips · Pagination · EmptyState · DataTable                          │
│  client hook useFilterParams() rewrites the URL inside startTransition            │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Six non-negotiable rules

1. **Server-side filtering always.** No `Array.filter()` in a `page.tsx` for anything that can grow. The only sanctioned exception is the Live Monitor (§6.3) and it is justified there.
2. **Allowlist every sortable/filterable field.** A query param must never reach `orderBy`, `select` or a raw SQL string without going through an enum. `sort=-startTime` means `{ startTime: 'desc' }`; anything else falls back to the default sort.
3. **Scope first, filters second.** `{ AND: [teacherExamScope(teacher), ...userFilters] }`.
4. **Every `findMany` has a `take`.** `perPage ∈ {10, 25, 50, 100}`, default 25, hard cap 100. Pagination is `skip`/`take` this sprint (cursor pagination is a Sprint 4 concern; document that in the code comment).
5. **Facets come from aggregate queries**, never from mapping the page you fetched — otherwise the counts are wrong on page 2+.
6. **Export/bulk actions reuse the same builder function** as the list. Two code paths that "build the same query" will diverge; the export will silently disagree with the screen.

---

## 4. URL contract (the public interface — document it in `docs/FILTERING.md`)

| Param | Shape | Example | Notes |
|---|---|---|---|
| `q` | string ≤ 120 | `q=normalization` | Trimmed, whitespace-collapsed, `mode: "insensitive"` |
| `status` | CSV enum | `status=active,draft` | Multiple values OR together |
| `batch` | CSV uuid | `batch=<uuid>,<uuid>` | Teacher Exams only |
| `subject` | CSV string | `subject=DBMS` | From `Exam.subjects` |
| `type` | CSV enum | `type=MCQ,CODING` | Results / analytics |
| `difficulty` | CSV enum | `difficulty=HARD` | Analytics tab |
| `band` | CSV enum | `band=0-40,40-60` | Score bands: `0-40`, `40-60`, `60-75`, `75-100` |
| `flagged` | boolean | `flagged=1` | Violations ≥ 3 |
| `from` / `to` | ISO date | `from=2026-08-01` | Half-open window on the indexed timestamp column |
| `risk` | enum | `risk=flagged` | Live: `all` \| `flagged` \| `critical` |
| `idle` | minutes | `idle=5` | Live: no heartbeat for ≥ N minutes |
| `sort` | enum | `sort=-percentage` | Leading `-` = descending; per-surface allowlist |
| `dir` | `asc`\|`desc` | `dir=desc` | Explicit alternative to the `-` prefix; pick one and be consistent (recommended: support both, `-` wins) |
| `page` | int ≥ 1 | `page=3` | Clamped; out-of-range pages show an empty state with a "back to page 1" link |
| `perPage` | 10/25/50/100 | `perPage=50` | Anything else → 25 |
| `tab` | enum | `tab=analytics` | **Pre-existing** on the results page — must be preserved and must not be treated as an unknown param |

**Unknown params are ignored, not rejected.** The results page shares its URL with `tab=`, and users paste URLs between surfaces. Your `readParams` should collect `Object.fromEntries(searchParams)` and let the zod object strip keys it doesn't know (`z.object({...})` strips by default — do **not** copy the `.strict()` used in one of Sprint 1's schemas, or a harmless `tab` param becomes a 500).

---

## 5. Files to create

```
lib/filters/
  parse.ts                 ← csv(), intParam(), dateParam(), isoDateParam(), readParams(), toURLSearchParams()
  schemas.ts               ← examFilterSchema, resultFilterSchema, liveFilterSchema + sort enums + defaults
  pagination.ts            ← DEFAULT_PER_PAGE, PER_PAGE_OPTIONS, pageCount(), clampPage(), paginationArgs()
  builders/exams.ts        ← buildExamWhere(), buildExamOrderBy(), buildExamStatusFacetWheres()
  builders/results.ts      ← buildResultWhere(), buildResultOrderBy(), buildResultFacets()
  serialize.ts             ← filterToQueryString(filter), filterToSearchParams(filter)  (for links/exports)
  use-filter-params.ts     ← "use client" hook (see §7.1)
  __tests__/parse.test.ts, exams.test.ts, results.test.ts

ui/filters/
  filter-bar.tsx, search-input.tsx, facet-select.tsx, date-range-filter.tsx, sort-menu.tsx,
  active-filter-chips.tsx, pagination.tsx, data-table.tsx, empty-state.tsx, skeleton-rows.tsx

app/actions/exam-filters.ts ← getTeacherExamsPaged(), getExamResultsPaged(), exportExamResults()

scripts/seed-large.ts      ← dev-only dataset generator (see §9.5)
docs/FILTERING.md          ← URL contract + how to add a filter to a new surface
```

**Why a new `app/actions/exam-filters.ts` instead of extending `app/actions/exam.ts`:** the existing module is ~1,000 lines and mixes authorization, grading, proctoring and reads. Keep the read-side filter actions in their own module and import the shared builders. Move the *old* unpaged exports only if nothing else uses them (§6.1).

---

## 6. Per-surface specifications

### 6.0 Component APIs (implement exactly; pages pass data in)

```tsx
// ui/filters/filter-bar.tsx  (client)
export interface FilterDef {
  param: string;                                   // "status"
  label: string;                                   // "Status"
  type: "search" | "facet" | "date-range" | "sort";
  options?: { value: string; label: string; count?: number }[];
  sortOptions?: { value: string; label: string }[];
  placeholder?: string;
  multi?: boolean;                                 // facet: multi-select (default true)
}
export function FilterBar({ defs, children }: { defs: FilterDef[]; children?: React.ReactNode }): JSX.Element;

// ui/filters/search-input.tsx (client)
export function SearchInput(props: { param: string; label: string; placeholder?: string; debounceMs?: number }): JSX.Element;

// ui/filters/facet-select.tsx (client)
export function FacetSelect(props: { param: string; label: string; options: FilterDef["options"]; showCounts?: boolean }): JSX.Element;

// ui/filters/date-range-filter.tsx (client)
export function DateRangeFilter(props: { label?: string; fromParam?: string; toParam?: string }): JSX.Element;

// ui/filters/sort-menu.tsx (client)
export function SortMenu(props: { options: FilterDef["sortOptions"]; defaultSort: string }): JSX.Element;

// ui/filters/active-filter-chips.tsx (client)
export function ActiveFilterChips(props: { defs: FilterDef[] }): JSX.Element;

// ui/filters/pagination.tsx (client)
export function Pagination(props: { total: number; page: number; perPage: number; totalPages: number }): JSX.Element;

// ui/filters/empty-state.tsx (server-safe)
export function EmptyState(props: { title: string; description?: string; action?: React.ReactNode; icon?: React.ReactNode }): JSX.Element;

// ui/filters/data-table.tsx (client) — used by Results
export interface Column<T> {
  key: string; header: string; sortKey?: string; align?: "left" | "right";
  render: (row: T) => React.ReactNode; className?: string;
}
export function DataTable<T>(props: { rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string; emptyState?: React.ReactNode }): JSX.Element;
```

`FilterBar` renders one control per `FilterDef` and (this is the part people skip) `ActiveFilterChips` needs human labels — derive them from the same `defs` array rather than re-declaring strings in the chips component.

### 6.1 Teacher Exams — `app/teacher/exams/page.tsx`

**Current state:** server component, `getTeacherExams()` → *all* exams, `orderBy createdAt desc`, rendered as cards with a `DRAFT/UPCOMING/ACTIVE/EXPIRED` badge derived from `resolveExamStatus`.

**Add:** `q` (title, description, batch name), `status`, `batch`, `subject`, `from`/`to`, `sort`, `dir`, `page`, `perPage`.

**Sort allowlist:** `createdAt` (default, desc), `startTime`, `endTime`, `title`, `sessions` (`orderBy: { sessions: { _count: dir } }`), `questions` (`{ questions: { _count: dir } }`). Always append a stable tiebreaker (`{ id: "asc" }`) so pagination cannot repeat or skip rows.

**Status filter — the staleness trap.** `Exam.status` is written at create/publish time, so a row published as `UPCOMING` remains `UPCOMING` in the column forever. Build the filter from **timestamps**, and use the column only for the states timestamps cannot express:

```ts
// lib/filters/builders/exams.ts
export function buildExamStatusWhere(statuses: ExamStatus[], now: Date): Prisma.ExamWhereInput {
  return {
    OR: statuses.map((status) => {
      switch (status) {
        case "draft":    return { published: false, status: { not: "ARCHIVED" } };
        case "archived": return { status: "ARCHIVED" };
        case "upcoming": return { published: true, status: { not: "ARCHIVED" }, startTime: { gt: now } };
        case "expired":  return { published: true, status: { not: "ARCHIVED" }, endTime: { lt: now } };
        case "active":   return { published: true, status: { not: "ARCHIVED" }, startTime: { lte: now }, endTime: { gte: now } };
      }
    }),
  };
}
```

**Facets.** The status buckets cannot be produced by a single `groupBy` on the derived expression, so run **one `count()` per bucket in the same `Promise.all`** (four cheap index-backed counts), each using the *other* filters but **not** the status filter — otherwise selecting "Active" zeroes every other count:

```ts
const [rows, total, active, upcoming, draft, expired] = await Promise.all([
  prisma.exam.findMany({ where, orderBy, skip, take, select: EXAM_LIST_SELECT }),
  prisma.exam.count({ where }),
  prisma.exam.count({ where: withoutStatus({ ...where, ...buildExamStatusWhere(["active"], now) }) }),
  prisma.exam.count({ where: withoutStatus({ ...where, ...buildExamStatusWhere(["upcoming"], now) }) }),
  prisma.exam.count({ where: withoutStatus({ ...where, ...buildExamStatusWhere(["draft"], now) }) }),
  prisma.exam.count({ where: withoutStatus({ ...where, ...buildExamStatusWhere(["expired"], now) }) }),
]);
```

**Batch facet needs a second lookup:** `groupBy` cannot include relations.

```ts
const batchGroups = await prisma.exam.groupBy({
  by: ["batchId"], where: whereWithoutBatch, _count: { _all: true },
  orderBy: { _count: { batchId: "desc" } }, take: 20,
});
const batches = await prisma.batch.findMany({
  where: { id: { in: batchGroups.map((g) => g.batchId) } }, select: { id: true, name: true },
});
// → options: batchGroups.map(g => ({ value: g.batchId, label: nameById.get(g.batchId) ?? "Unknown", count: g._count._all }))
```

**Relation-count filters — the part that is not expressible.** Prisma supports `sessions: { some: {} }` / `{ none: {} }` (used for a "has submissions / no submissions" toggle) but **not** "≥ N submissions". If you want a numeric threshold, it needs a denormalized counter column — say so in a comment and leave it out; do not write `$queryRaw` for it in this sprint.

**Row payload:** `{ id, title, examCode, startTime, endTime, duration, published, status, subjects, proctoring, batch: { id, name }, _count: { questions, sessions } }` — everything the card renders today. Keep the existing card markup, badges and `LocalTime` usage; add a "N results" line above the list and an `<EmptyState>` with a **Clear filters** action when the result set is empty.

**Bulk actions:** selection checkboxes + a `BulkActionBar` (publish / duplicate / delete) are *optional* in this sprint. If you add them, they must operate on selected ids only, require a confirmation step, and reuse `publishExam`/`duplicateExam` (which are already authorization-checked) — never write new unaudited delete paths.

**Export:** the exams list has no exporter today; skip it (the results page already has one). Do not build a new XLSX path here.

### 6.2 Exam Results — `app/teacher/exams/[id]/results/page.tsx`

**Current state:** two tabs (`?tab=table|analytics`), `getExamResults(id)` returns every session **with all submissions** and computes `totalScore`/`correctAnswers` in JS; `getExamAnalytics(id)` recomputes per-question metrics.

**Add (table tab):** `q` (student name, PRN, email), `status` (COMPLETED / FORCE_SUBMITTED / STARTED / NOT_STARTED / PAUSED), `band` (score buckets), `flagged` (violations ≥ 3), `from`/`to` (on `submittedAt`), `sort`, `dir`, `page`, `perPage`. Preserve `tab`.

**Sort allowlist:** `percentage` (default, desc), `totalScore`, `submittedAt`, `violationCount`, `name`, `prn`.

**Keep the query light — this is the biggest performance win in the sprint.** Do **not** include every submission for every row. Use the denormalized columns for score/percentage/violations, and include submissions *only for the 25 rows on the current page* (a bounded, small join) if the "Correct 7 / 10" cell needs `isCorrect`:

```ts
const rows = await prisma.studentExamSession.findMany({
  where, orderBy, skip, take: perPage,
  select: {
    id: true, status: true, percentage: true, totalScore: true, maxScore: true,
    violationCount: true, riskScore: true, submittedAt: true, updatedAt: true, ipAddress: true,
    student: { select: { id: true, name: true, email: true, prn: true } },
    submissions: { select: { isCorrect: true } },   // bounded: only this page's rows
  },
});
```

**Facets:** `groupBy(["status"])` for the status facet (excluding the status filter itself), and four `count()` calls with `percentage: { gte, lt }` ranges for the score bands, each excluding the band filter. Reuse the same `where` object with one clause removed — implement a single `withoutFacet(where, "status" | "band")` helper so the exclusion logic exists once.

**Export must follow the filter.** `ResultExporter` (`result-exporter.tsx`) currently receives the full `results` array. Change it to receive the **filtered** set from a new action, and label the button with the count:

```ts
// app/actions/exam-filters.ts
export async function exportExamResults(examId: string, filter: Partial<ResultFilter>) {
  const teacher = await requireTeacher();
  await assertExamAccess(examId, teacher);
  const f = resultFilterSchema.parse(filter);
  const where = buildResultWhere({ examId, ...f });      // SAME builder as the table
  const rows = await prisma.studentExamSession.findMany({
    where, orderBy: buildResultOrderBy(f), take: EXPORT_ROW_CAP, // 5000, documented
    select: /* same select as the table */,
  });
  return { rows, truncated: rows.length === EXPORT_ROW_CAP, filter: f };
}
```
Call it **on click** (not during page render) so the page stays fast, then keep the existing `xlsx`/`jspdf` generation in the client component. If the set is truncated, surface it in the toast ("Exported first 5 000 rows — narrow your filters").

**Drill-down (optional):** clicking a row opens the student's detailed review (their submissions + AI explainer). Only add it if the rest is complete; it needs its own authorization check via `assertExamAccess`.

**Analytics tab (optional, do last):** accept `type` and `difficulty` from the same URL and filter `exam.questions` in `getExamAnalytics` before computing metrics. Keep the existing metric shapes; do not redesign the dashboard in this sprint.

### 6.3 Live Monitor — `app/teacher/exams/[id]/live/page.tsx` + `live-dashboard.tsx`

**Current state:** the page loads all sessions for the exam (with `_count.submissions`), passes them as `initialSessions`, and `live-dashboard.tsx` keeps them in a `Record<studentId, Session>` updated by Pusher events, sorted by `updatedAt` only, with a duplicate-IP warning.

**This surface is different, and it is the one place client-side filtering is correct:** the roster is bounded (one exam's cohort) and **must** be held in memory anyway, because Pusher deltas have to merge into it. Do not try to re-query the server on every keystroke here.

**Add:**
- `q` (name / PRN), `status`, `risk` (`flagged` = riskScore ≥ 40, `critical` = ≥ 70), `idle` (no heartbeat for ≥ N minutes), `dup` (duplicate IP only), `sort`.
- **Derived liveness** from `lastHeartbeatAt` (Sprint 1 writes it every 20 s from the exam client, and on every autosave): `< 60 s` live, `60–180 s` stale (amber), `> 180 s` disconnected (red). Add a `useNow(30_000)` tick so the badges re-render without a server round-trip.
- **Students who never started:** fetch the batch roster in the server component and left-join it against sessions so "not started" students appear as rows and can be filtered (`status=not_started`). This is the single most requested thing on an invigilator screen — a student who silently never joined is invisible today.

```ts
// app/teacher/exams/[id]/live/page.tsx
const [exam, sessions, roster] = await Promise.all([
  assertExamAccess(id, teacher, { id: true, title: true, batchId: true, _count: { select: { questions: true } } }),
  prisma.studentExamSession.findMany({ where: { examId: id }, take: ROSTER_CAP /* 1000 */, select: {...} }),
  prisma.user.findMany({ where: { role: "STUDENT", enrolledBatches: { some: { id: exam.batchId } } },
                         select: { id: true, name: true, prn: true }, take: ROSTER_CAP }),
]);
// merge → rows for every roster student, status "NOT_STARTED" when there is no session
```

- **Row rendering:** add a risk badge (from `riskScore`), a liveness dot, and "violations" (already present as tab switches — relabel it and read `violationCount`). Keep the existing stat cards and the Pusher alert toasts.
- **URL sync without refetching:** the filter state should still be reflected in the URL so a view can be shared, but a `router.replace()` would re-run the server component (re-fetching the roster on every keystroke). Use `window.history.replaceState(null, "", url)` for this page — it updates the address bar without a Next.js navigation. Document the trade-off in a comment: browser back/forward will not step through filter states here (acceptable for a live view).

**Suggested default view:** sort by risk desc, then violations desc, then last activity desc — the invigilator should see the worst case first without touching anything. Pin/surface a summary line: "3 flagged · 2 disconnected · 41 in progress".

---

## 7. Filter core implementation details

### 7.1 The client hook (`lib/filters/use-filter-params.ts`)

```ts
"use client";
export interface UseFilterParams {
  params: URLSearchParams;
  get(name: string): string | null;
  getAll(name: string): string[];
  set(patch: Record<string, string | string[] | number | boolean | undefined>, opts?: { resetPage?: boolean }): void;
  clearAll(): void;
  activeCount: number;      // number of active filter params (excluding page/perPage/sort/tab)
  isPending: boolean;       // from useTransition
}
export function useFilterParams(options?: { mode?: "navigate" | "history" }): UseFilterParams;
```

- `set()` writes through `router.push(`${pathname}?${qs}`, { scroll: false })` inside `startTransition` (default), or `window.history.replaceState` when `mode: "history"` (Live Monitor).
- Empty values (`""`, `[]`, `undefined`) **delete** the param rather than writing `?q=`.
- `resetPage: true` by default: any filter change clears `page`.
- Debounce lives in `SearchInput` (300 ms) plus `useDeferredValue` for the input value itself; the hook itself does not debounce.
- Reading: `useSearchParams()` (cached, does not suspend) — the pages are dynamic, but keep any component that calls it behind a `<Suspense>` boundary anyway so it cannot be a static-render failure later.
- `activeCount` must **exclude** `page`, `perPage`, `sort`, `dir`, `tab` so the "3 filters active" chip and the "Clear all" affordance are honest.

### 7.2 Parsing (`lib/filters/parse.ts`)

```ts
export const MAX_TEXT = 120;
export function csv<T extends string>(values: readonly T[]) {
  return z.string()
    .transform((s) => s.split(",").map((v) => v.trim()).filter(Boolean).slice(0, 20))
    .pipe(z.array(z.enum(values as unknown as [T, ...T[]])).min(1));
}
export function intParam(min: number, max: number, fallback: number) {
  return z.coerce.number().int().min(min).max(max).catch(fallback);
}
export function dateParam() {
  return z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((s) => new Date(`${s}T00:00:00.000Z`)).optional();
}
export function readParams<T extends z.ZodTypeAny>(schema: T, searchParams: Record<string, string | string[] | undefined>): z.infer<T>;
```

`readParams` must (a) flatten `string[]` values by taking the last entry, (b) drop empty strings, and (c) **never throw** — use `.catch()`/defaults so a hand-edited URL degrades to "no filter" instead of a 500.

### 7.3 Pagination (`lib/filters/pagination.ts`)

```ts
export const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;
export const DEFAULT_PER_PAGE = 25;
export const MAX_PER_PAGE = 100;
export const EXPORT_ROW_CAP = 5000;
export function pageCount(total: number, perPage: number): number;      // ceil, min 1
export function paginationArgs(page: number, perPage: number): { skip: number; take: number };
```

If `page > totalPages` and `total > 0`, render the empty state with "Go to page 1" rather than silently showing page 1 (silent clamping makes shared links lie).

### 7.4 Server response shape (identical for every surface)

```ts
export interface PagedResult<T> {
  rows: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  facets: Record<string, { value: string; label: string; count: number }[]>;
}
```

Render the header and `FilterBar` **outside** the `<Suspense>` boundary and the rows inside it, keyed by the serialized filter, so typing never blanks the page:

```tsx
<Suspense key={filterToQueryString(filter)} fallback={<SkeletonRows rows={filter.perPage} />}>
  <ExamList filter={filter} />
</Suspense>
```

### 7.5 Where filters must sit relative to authorization

```ts
export async function getTeacherExamsPaged(input: Partial<ExamFilter> = {}): Promise<PagedResult<ExamListRow>> {
  const teacher = await requireTeacher();                     // 1. identity
  const filter = examFilterSchema.parse(input);                // 2. validate
  const scope = teacherExamScope(teacher);                     // 3. scope
  const where = buildExamWhere(filter, scope);                 // 4. filters AND scope
  // 5. one Promise.all for rows + total + facets
}
```

**Facet counts must be computed inside the scope too** — a facet count that includes another teacher's exams is an information leak as real as returning their rows.

---

## 8. Accessibility and UX requirements (not optional)

- Every control has a programmatic label (`<label htmlFor>` or `aria-label`); the search input is wrapped in `role="search"`.
- `DataTable` headers that are sortable render as `<button>` with `aria-sort="ascending|descending|none"` and the active state visible without colour alone.
- Result counts announce politely: `<span aria-live="polite">{total} results</span>` (update on change only, not on every keystroke).
- `FacetSelect` must be operable by keyboard alone: either a checkbox list inside a `<details>`/popover with focus management, or a `<select multiple>`. No click-outside-only popovers that trap focus.
- `ActiveFilterChips`: each chip is a `<button>` with an accessible name like "Remove filter: Status Active".
- Loading states: skeletons with `aria-hidden`, plus `aria-busy` on the list container.
- Focus is visible on every interactive element; do not remove outlines.
- Empty state always offers a route out (Clear filters / Create exam / Back to page 1).
- Responsive: the filter bar wraps to a "Filters (3)" disclosure under `md`; the results table becomes stacked cards under `md` (**the table is currently unusable on a phone**).

---

## 9. Verification: how to prove it works

### 9.1 Unit tests for the pure layer (required)

Add `vitest` as a devDependency + `npm run test`, and cover:

```
parse.test.ts    → csv() trims/limits/splits; intParam clamps and falls back; dateParam rejects "2026-13-99";
                   readParams ignores unknown keys (e.g. tab=analytics) and never throws on garbage
exams.test.ts    → status=active → published + startTime<=now + endTime>=now (AND scope, not OR);
                   two statuses produce an OR of both fragments; batch[] → { batchId: { in: [...] } };
                   q is trimmed + max length; sort allowlist falls back to createdAt; unknown sort is ignored;
                   orderBy always ends with the stable tiebreaker
results.test.ts  → band=0-40 → percentage { gte: 0, lt: 40 }; band=75-100 → { gte: 75 } (and lt: undefined);
                   flagged → violationCount { gte: 3 }; facet "without" helper removes only its own clause
```

These are pure functions with no DB — the whole point is that the query shapes are provable without a database.

### 9.2 Query-budget check (required)

Each of the three surfaces must issue **≤ 6 DB queries per render**, all inside one `Promise.all` (rows, total, facets, lookups). Prove it by enabling Prisma query logging in development for one request and pasting the count into the PR. This catches the classic regression where a facet is fetched sequentially per option.

### 9.3 Behaviour to preserve (regression checklist)

- [ ] Teacher: exams list → card badges and `LocalTime` still correct; "Manage Questions" and "Duplicate" still work.
- [ ] Results: `?tab=analytics` still renders the analytics dashboard; the exporter still produces the same XLSX/PDF columns.
- [ ] Live: Pusher updates still merge in real time (join / answer / tab-switch / submit), toasts still appear, duplicate-IP warning still fires.
- [ ] All new reads go through `requireTeacher()` + `assertExamAccess()`; a teacher from another department still sees nothing.
- [ ] No page fetches an unbounded list anywhere (`grep -rn "findMany" app/ | grep -v take` must come up clean for the touched files).

### 9.4 Manual acceptance (with a 500-exam dataset)

- [ ] `/teacher/exams` → type "dbms" → results narrow after ~300 ms; the URL updates; **reload keeps the filter**; Back returns to the unfiltered list.
- [ ] Select "Active" → every other status count stays correct (not zeroed).
- [ ] Sort by "Submissions" desc → the row with the most sessions is first; page 2 does not repeat a row from page 1.
- [ ] `/teacher/exams/<id>/results?band=0-40&flagged=1` → only failing + flagged students; "Export" produces exactly that set and the button reads "Export 12 filtered results".
- [ ] Live Monitor: search a PRN, filter `idle=5`, sort by risk — all without a network request; the URL reflects the state.
- [ ] Keyboard only: Tab to the search box, type, Tab to facets, toggle with Space, Tab to "Clear all", press Enter — every step works.
- [ ] 375 px viewport: filter bar collapses to a disclosure and the table becomes cards with no horizontal scroll.

### 9.5 Large dataset for testing (`scripts/seed-large.ts`)

Dev-only, idempotent, `npm run seed:large` (add the script; never commit generated data):
`1 department → 8 batches → 2,000 students → 500 exams → ~20,000 sessions → ~200,000 submissions`.
This is what makes facets, pagination and the indexes testable. Use `createMany` in batches of 1,000 inside a transaction with an explicit timeout; guard the script so it refuses to run when `NODE_ENV === "production"`.

### 9.6 Index verification (required evidence)

For each new filter/sort combination, paste `EXPLAIN (ANALYZE, BUFFERS)` output:

```sql
EXPLAIN ANALYZE SELECT * FROM "StudentExamSession"
WHERE "examId" = '<uuid>' AND "percentage" < 40 ORDER BY "percentage" DESC LIMIT 25;
-- expect an Index Scan / Bitmap Index Scan on StudentExamSession_examId_percentage_idx, not Seq Scan

EXPLAIN ANALYZE SELECT * FROM "Exam" WHERE "batchId" = '<uuid>' ORDER BY "startTime" DESC LIMIT 25;
-- expect Exam_batchId_startTime_idx
```
If a hot combination is not covered, add the index **in a new migration** (`npx prisma migrate dev --name filtering_indexes`) — do not edit the Sprint 1 migration after it has been applied.

---

## 10. Environment, commands and constraints

```bash
npm install
npx prisma generate && npx prisma migrate deploy   # Sprint 1 migration must be applied
npm run seed:large                                 # new script
npm run test                                       # new script (vitest)
npm run type-check && npm run lint && npm run build
npm run dev
```

Constraints:
- **TypeScript strict.** No `any`, no `@ts-ignore` without a comment explaining why, no non-null assertions on parsed filter values.
- **JSDoc** on every exported builder, schema, action and component prop interface.
- **Prisma 7 API only** — check the generated client for the exact `where`/`orderBy` forms (`groupBy`, `_count` ordering and `mode: "insensitive"` all behave slightly differently between majors). `AGENTS.md` applies here too: read `node_modules/next/dist/docs/` before writing Next.js-specific code.
- **Next.js 16:** `searchParams` and `params` are Promises — `await` them. Middleware lives in `proxy.ts`. React 19 `useOptimistic`/`useTransition` are available; use `useTransition` for navigations.
- Keep `export const dynamic = "force-dynamic"` on these three pages this sprint (the data is inherently live); a caching strategy is a later concern. Note it in a comment so a future reader does not "optimize" it away.
- Do not introduce a data-fetching library (TanStack Query etc.) — URL + RSC + `startTransition` is the chosen architecture.

---

## 11. Out of scope for this sprint (do not start)

The remaining surfaces from the plan matrix: batches list, batch roster, question bank/list, certificates, student dashboard, proctor-log/audit UI. Item analysis and discrimination metrics; topic-mastery dashboards; saved views (persisting named filter presets per user); bulk actions beyond what §6.1 lists; cursor pagination; virtualized lists; CSV import; manual grading queue; email/calendar notifications; plagiarism or collusion detection; dark mode; i18n; admin/invigilator roles; Playwright end-to-end suite; CI pipeline changes beyond adding the test step.

If you uncover a P0 defect while working, fix it and **call it out explicitly** in the PR description instead of silently expanding scope.

---

## 12. Deliverables

1. Commits per layer: `filters(core)`, `filters(ui)`, `filters(exams)`, `filters(results)`, `filters(live)`, `test(filters)`, `docs(filters)`.
2. PR description with: the file list from §5, the URL contract table, **query-count evidence** (§9.2), **`EXPLAIN` evidence** (§9.6), the regression checklist with ✅/❌, and the manual acceptance results including a screenshot of the 375 px view.
3. `docs/FILTERING.md` — the URL contract, the five-layer diagram, "how to add a filter to a new surface in 3 steps", and the facet-exclusion rule. This is what makes Sprint 3 (the remaining surfaces) mechanical.
4. Unit tests passing in CI-able form (`npm run test`).
5. A "Reviewer notes" section listing the three files to read first (recommended: `lib/filters/builders/exams.ts`, `lib/filters/use-filter-params.ts`, `app/teacher/exams/page.tsx`).

---

## 13. Suggested implementation order (with checkpoints)

| Step | Work | Checkpoint before moving on |
|---|---|---|
| 1 | `parse.ts`, `schemas.ts`, `pagination.ts`, `builders/*` + unit tests | `npm run test` green; no page touched yet |
| 2 | `use-filter-params.ts`, `search-input`, `facet-select`, `date-range-filter`, `sort-menu`, `active-filter-chips`, `pagination`, `empty-state` | A scratch route (or the exams page with dummy data) proves the controls round-trip through the URL |
| 3 | `getTeacherExamsPaged` + **Teacher Exams** page | §9.4 items 1–3 pass |
| 4 | `getExamResultsPaged` + `exportExamResults` + **Results** page + `DataTable` | §9.4 item 4 passes; analytics tab still renders |
| 5 | **Live Monitor**: roster join, filters, liveness, risk sort, `history` URL mode | §9.4 item 6 passes; Pusher regression checklist green |
| 6 | `seed-large.ts`, `EXPLAIN` evidence, a11y pass, responsive pass, `docs/FILTERING.md` | Full §9 completed and documented |

Steps 1–2 are ~40 % of the work and are pure/additive — do not let them slide into a half-built page.

---

*Sprint 2 brief — SmartAssess v2. Companion analysis: `docs/UPGRADE_PLAN_AND_FILTERING.md` (Part A).*
