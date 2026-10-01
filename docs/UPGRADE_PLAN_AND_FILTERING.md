# SmartAssess v2 — Codebase Analysis, Advanced Filtering Design & Upgrade Roadmap

> **Scope reviewed:** commit `a3cd136` on `main` — 17 route files, 7 server-action modules, 1 Prisma schema (13 models), 5 migrations, 1 CI workflow.
> **Verdict:** the platform has a genuinely strong feature skeleton (live proctoring, Judge0 evaluation, AI generation + explainers, certificates, certificates verification, exports). What is missing is *depth*: no search/filter/sort/pagination anywhere, no denormalized scoring columns, no DB indexes for the queries it already runs, no test suite, and several server actions that trust the client more than they should.
>
> **This document has 3 parts:**
> 1. **[Part A](#part-a--advanced-filtering-system-the-headline-feature)** — a complete, drop-in design for the advanced filtering system (the headline feature).
> 2. **[Part B](#part-b--critical-fixes-do-these-first)** — P0 correctness/security/integrity fixes found during the review.
> 3. **[Part C](#part-c--roadmap-best-features-to-add)** — prioritized feature roadmap (item analysis, proctoring 2.0, question bank, email, plagiarism, accessibility, testing, DevOps).
>
> **➡️ Sprint 1 of this plan is implemented on this branch — see [Sprint 1 delivery notes](#sprint-1-delivery-notes) at the bottom.**

---

## Part A — Advanced Filtering System (the headline feature)

### A.1 Current state — what exists today

| Surface | File | What it can do today | What it can't |
|---|---|---|---|
| Teacher → Exams | `app/teacher/exams/page.tsx` | Nothing. `getTeacherExams()` returns **every** exam, `orderBy createdAt desc`. | search, status filter, batch filter, date range, sort, pagination, counts |
| Teacher → Results | `app/teacher/exams/[id]/results/page.tsx` | Nothing. Full table of every session, score computed in JS in `getExamResults()`. | search student/PRN, filter status, score band, violations, pass/fail, sort by score, pagination, export filtered set |
| Teacher → Live Monitor | `app/teacher/exams/[id]/live/live-dashboard.tsx` | Sort by `updatedAt` only. | find a student among 200, filter by status/violations/duplicate IP, sort by risk |
| Teacher → Batches | `app/teacher/batches/page.tsx` | Nothing. | search, sort by size, filter by department/year/division |
| Teacher → Batch roster | `app/teacher/batches/[id]/student-manager.tsx` | Nothing. | search by name/PRN/email, sort |
| Teacher → Question list | `app/teacher/exams/[id]/page.tsx` | Cards only. | search, filter by type/points/difficulty, reorder, bulk delete |
| Teacher → Analytics | `.../results/analytics-dashboard.tsx` | Fixed metric list. | filter by question type/difficulty, topic drill-down, cohort comparison |
| Student → Exams | `app/student/page.tsx` | 3 hardcoded tabs (`all` / `active` / `completed`) applied **in memory after fetching everything**. | search, sort, subject filter, pagination, `?filter=` is not composable with anything |
| Student → Results | `app/student/exams/[id]/result/page.tsx` | None. | filter questions by outcome, search |

**Root problem:** filtering is done *after* the database returns everything, in a `page.tsx`, with a hardcoded `if/else` on one string. There is no shared filter vocabulary, no URL contract, no query builder, no index strategy, and no UI component to render a filter.

### A.2 Target architecture (5 layers)

```
┌─ 1. URL state ───────────────────────────────────────────────────────────┐
│  /teacher/exams?q=dbms&status=active,draft&batch=b1,b2&sort=-startTime    │
│                 &from=2026-08-01&to=2026-09-01&page=2&perPage=25          │
│  URL is the single source of truth → shareable, bookmarkable, back-safe.  │
└──────────────────────────────────────────────────────────────────────────┘
                    ↓ parse + validate (allowlist, never trust input)
┌─ 2. Filter AST ──────────────────────────────────────────────────────────┐
│  lib/filters/schema.ts   → zod schema per resource (ExamFilter, ...)     │
│  lib/filters/parse.ts    → URLSearchParams → typed, coerced filter AST   │
└──────────────────────────────────────────────────────────────────────────┘
                    ↓ compile
┌─ 3. Prisma where builder ────────────────────────────────────────────────┐
│  lib/filters/builders/exams.ts → buildExamWhere(ast, scope): Prisma args │
│  Every builder is pure + unit-testable. No string SQL. No `any`.          │
└──────────────────────────────────────────────────────────────────────────┘
                    ↓
┌─ 4. Data access ─────────────────────────────────────────────────────────┐
│  Server action / RSC: findMany({ where, orderBy, skip, take }) +         │
│  count() + facet groupBy() in one Promise.all (parallel, not serial).     │
│  Always returns { rows, total, page, perPage, facets }.                   │
└──────────────────────────────────────────────────────────────────────────┘
                    ↓
┌─ 5. UI ──────────────────────────────────────────────────────────────────┐
│  ui/filters/FilterBar · SearchInput · FacetSelect · DateRange ·          │
│  SortMenu · ActiveChips · Pagination · SavedViews · BulkActionBar        │
│  Client hook useFilterParams() rewrites the URL inside startTransition.  │
└──────────────────────────────────────────────────────────────────────────┘
```

**Non-negotiable rules**

1. **Server-side filtering always.** The client only owns the URL and the widgets. No `array.filter()` in a `page.tsx` for anything that could grow.
2. **Allowlist every sortable/filterable field.** Never interpolate a query-param into `orderBy` or a raw SQL string.
3. **Scope first, filter second.** The teacher's ownership/department scope (`batch.teacherId = me OR (batch.department = myDept AND teacherId IS NULL)`) is ANDed *before* user filters, so facet counts can never leak another teacher's data.
4. **Cap `perPage` at 100** and always return `total`; use cursor pagination for the live monitor (append-only stream).
5. **Facets come from `groupBy`**, not from mapping the rows you fetched (otherwise counts are wrong for pages ≠ 1).
6. **Every filter state is in the URL** → the Export buttons export *the current filtered view*, not the whole table.

### A.3 URL contract

| Param | Shape | Example | Notes |
|---|---|---|---|
| `q` | string ≤ 120 chars | `q=normalization` | Trimmed, case-insensitive, `mode: "insensitive"` |
| `status` | CSV enum | `status=active,upcoming` | Derived status for exams; real enum for sessions |
| `batch` | CSV id | `batch=<uuid>,<uuid>` | Teacher exams |
| `type` | CSV enum | `type=MCQ,CODING` | Results / questions |
| `from` / `to` | ISO date | `from=2026-08-01` | Half-open `[from, to]` on the index timestamp column |
| `scoreMin` / `scoreMax` | number | `scoreMin=40` | % band on the **denormalized** score column |
| `violations` | `0`/`1+`/`3+` | `violations=3%2B` | Proctoring risk band |
| `sort` | `-field` prefix = desc | `sort=-score` | Enum per resource |
| `page` / `perPage` | int | `page=2&perPage=25` | `perPage ∈ {10,25,50,100}` |
| `view` | id | `view=at-risk` | Saved view (URL is then rehydrated from it) |
| `tab` | enum | `tab=analytics` | Existing pattern, keep |

### A.4 Step-by-step implementation

#### Step 1 — Extract the duplicated authorization into `lib/auth/scope.ts`

Every action currently copies this block **10+ times** (`exam.ts` × 8, `batch.ts` × 5, `results/page.tsx`, `live/page.tsx`, `teacher/page.tsx`, `exams/[id]/page.tsx`):

```ts
const teacher = await prisma.user.findUnique({ where: { id: session.user.id }, select: { department: true } });
```

Replace with:

```ts
// lib/auth/scope.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/app/db";
import { cache } from "react";

export class UnauthorizedError extends Error {}
export class NotFoundError extends Error {}

/** Memoized per-request so N calls share 1 query. */
export const requireUser = cache(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new UnauthorizedError("Not signed in");
  return session.user;
});

export const requireTeacher = cache(async () => {
  const user = await requireUser();
  if (user.role !== "TEACHER") throw new UnauthorizedError("Teacher role required");
  const record = await prisma.user.findUnique({ where: { id: user.id }, select: { department: true } });
  return { ...user, department: record?.department ?? null };
});

export const requireStudent = cache(async () => {
  const user = await requireUser();
  if (user.role !== "STUDENT") throw new UnauthorizedError("Student role required");
  return user;
});

/** The single source of truth for "which exams may this teacher see". */
export function teacherExamScope(teacher: { id: string; department: string | null }): Prisma.ExamWhereInput {
  return {
    batch: {
      OR: [
        { teacherId: teacher.id },
        ...(teacher.department ? [{ department: teacher.department, teacherId: null }] : []),
      ],
    },
  };
}

export async function assertExamAccess(examId: string, teacher: { id: string; department: string | null }) {
  const exam = await prisma.exam.findFirst({
    where: { AND: [{ id: examId }, teacherExamScope(teacher)] },
    select: { id: true, batchId: true, title: true, published: true },
  });
  if (!exam) throw new NotFoundError("Exam not found or unauthorized");
  return exam;
}
```

> **Why first:** the filter builders *need* a scope parameter. Building filters on top of ad-hoc, copy-pasted authorization is how tenant-leak bugs get introduced.

#### Step 2 — Add the schema fields filtering needs

Current schema cannot express the filters users actually want (difficulty, topic, score band, violation count, release status). Add:

```prisma
model Exam {
  // ... existing
  status         ExamStatus  @default(DRAFT)   // replaces the 4 client-side boolean derivations
  examCode       String?     @unique           // human-joinable code
  resultsReleasedAt DateTime?                  // gates answer-key visibility (see P0-7)
  proctoring     Json        @default("{}")    // { maxTabSwitches, blockClipboard, requireFullscreen, webcam }
  negativeMarking Float      @default(0)
  subjects       String[]    @default([])      // facet
  @@index([batchId, startTime])
  @@index([published, startTime])
}

model Question {
  // ... existing
  difficulty  Difficulty @default(MEDIUM)      // facet
  topic       String?                          // facet + weakness analysis
  tags        String[]   @default([])          // facet (GIN index)
  bloomLevel  String?
  explanation String?                          // shown after release
  @@index([difficulty, topic])
}

model StudentExamSession {
  // ... existing
  totalScore     Float   @default(0)   // denormalized at submit → sort/filter by score
  maxScore       Float   @default(0)
  percentage     Float   @default(0)
  violationCount Int     @default(0)   // == tabSwitches today; separate counter for future event types
  riskScore      Int     @default(0)   // 0-100 computed
  lastHeartbeatAt DateTime?            // server-side abandonment detection (P0-4)
  submittedAt    DateTime?
  @@index([examId, percentage])
  @@index([examId, violationCount])
  @@index([examId, status, lastHeartbeatAt])
}

model ProctorEvent {
  id        String   @id @default(uuid())
  sessionId String
  type      ProctorEventType   // TAB_BLUR, FULLSCREEN_EXIT, CLIPBOARD, DEVTOOLS, DISCONNECT, DUPLICATE_TAB, IP_COLLISION
  severity  Int      @default(1)
  metadata  Json?
  occurredAt DateTime @default(now())
  session   StudentExamSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  @@index([sessionId, occurredAt])
  @@index([type, occurredAt])
}
```

#### Step 3 — Add the indexes the current queries are already missing

Prisma does **not** create indexes for relation scalar fields on PostgreSQL, and across **all 5 migrations there is exactly one non-unique index** (`_StudentBatches_B_index`) for 13 models — the rest are uniqueness constraints. Every `where: { examId }`, `where: { studentId }`, `where: { batchId }`, `orderBy: { startTime }` is currently a sequential scan that will fold at a few thousand rows.

```sql
-- prisma/migrations/2026xxxx_add_filtering_indexes/migration.sql
CREATE INDEX IF NOT EXISTS "Exam_batchId_startTime_idx"          ON "Exam"("batchId", "startTime");
CREATE INDEX IF NOT EXISTS "Exam_published_startTime_idx"        ON "Exam"("published", "startTime");
CREATE INDEX IF NOT EXISTS "Exam_title_idx"                      ON "Exam" USING gin (to_tsvector('english', "title"));
CREATE INDEX IF NOT EXISTS "ExamQuestion_examId_order_idx"       ON "ExamQuestion"("examId", "order");
CREATE INDEX IF NOT EXISTS "Submission_sessionId_idx"            ON "Submission"("sessionId");
CREATE INDEX IF NOT EXISTS "Submission_questionId_idx"           ON "Submission"("questionId");
CREATE INDEX IF NOT EXISTS "StudentExamSession_examId_pct_idx"   ON "StudentExamSession"("examId", "percentage");
CREATE INDEX IF NOT EXISTS "StudentExamSession_examId_status_idx"ON "StudentExamSession"("examId", "status");
CREATE INDEX IF NOT EXISTS "StudentExamSession_studentId_idx"    ON "StudentExamSession"("studentId");
CREATE INDEX IF NOT EXISTS "Batch_teacherId_idx"                 ON "Batch"("teacherId");
CREATE INDEX IF NOT EXISTS "Batch_department_idx"                ON "Batch"("department");
CREATE INDEX IF NOT EXISTS "Certificate_studentId_idx"           ON "Certificate"("studentId");
CREATE INDEX IF NOT EXISTS "Question_tags_idx"                   ON "Question" USING gin ("tags");
```

> For fuzzy student search, either keep `mode: "insensitive" + contains` (fine to ~50k rows) or add `pg_trgm` + `GIN (name gin_trgm_ops)` when the roster grows.

#### Step 4 — Ship the filter core (`lib/filters/`)

```ts
// lib/filters/parse.ts
import { z } from "zod";

export function csv<T extends string>(values: readonly T[]) {
  return z.string().transform(s => s.split(",").map(v => v.trim()))
    .pipe(z.array(z.enum(values as unknown as [T, ...T[]])).max(20));
}

export function intParam(min = 1, max = 100) {
  return z.coerce.number().int().min(min).max(max).catch(min);
}

export function dateParam() {
  return z.string().datetime({ offset: false }).transform(s => new Date(`${s}T00:00:00.000Z`)).optional();
}

/** Generic helper: nulls/empties are dropped so builders stay clean. */
export function readParams<T extends z.ZodTypeAny>(schema: T, params: URLSearchParams): z.infer<T> {
  const raw: Record<string, string | undefined> = {};
  params.forEach((value, key) => { if (value !== "") raw[key] = value; });
  return schema.parse(raw);
}
```

```ts
// lib/filters/schemas.ts
export const EXAM_STATUS = ["draft", "upcoming", "active", "expired"] as const;
export const EXAM_SORT   = ["createdAt", "startTime", "endTime", "title", "sessions", "questions"] as const;

export const examFilterSchema = z.object({
  q:        z.string().trim().min(1).max(120).optional(),
  status:   csv(EXAM_STATUS).optional(),
  batch:    z.string().uuid().array().max(20).optional(),   // parse CSV of uuids
  from:     dateParam(),
  to:       dateParam(),
  sort:     z.enum(EXAM_SORT).catch("createdAt"),
  dir:      z.enum(["asc", "desc"]).catch("desc"),
  page:     intParam(1, 10_000).default(1),
  perPage:  z.coerce.number().int().refine(n => [10, 25, 50, 100].includes(n)).catch(25),
}).strict();

export type ExamFilter = z.infer<typeof examFilterSchema>;
```

```ts
// lib/filters/builders/exams.ts
export function buildExamWhere(f: ExamFilter, scope: Prisma.ExamWhereInput): Prisma.ExamWhereInput {
  const now = new Date();
  const AND: Prisma.ExamWhereInput[] = [scope];

  if (f.q) AND.push({ OR: [
    { title:       { contains: f.q, mode: "insensitive" } },
    { description: { contains: f.q, mode: "insensitive" } },
    { batch: { name: { contains: f.q, mode: "insensitive" } } },
  ]});
  if (f.batch?.length) AND.push({ batchId: { in: f.batch } });
  if (f.from) AND.push({ startTime: { gte: f.from } });
  if (f.to)   AND.push({ endTime:   { lte: f.to } });

  if (f.status?.length) {
    AND.push({ OR: f.status.map(s => {
      switch (s) {
        case "draft":    return { published: false };
        case "upcoming": return { published: true, startTime: { gt: now } };
        case "active":   return { published: true, startTime: { lte: now }, endTime: { gte: now } };
        case "expired":  return { published: true, endTime: { lt: now } };
      }
    })});
  }
  return { AND };
}

export function buildExamOrderBy(f: ExamFilter): Prisma.ExamOrderByWithRelationInput[] {
  const dir = f.dir;
  switch (f.sort) {
    case "title":  return [{ title: dir }];
    case "endTime": return [{ endTime: dir }];
    case "startTime": return [{ startTime: dir }];
    case "sessions":  return [{ sessions: { _count: dir } }];
    case "questions": return [{ questions: { _count: dir } }];
    default: return [{ createdAt: dir }, { id: "asc" }]; // stable tiebreaker
  }
}
```

```ts
// app/actions/exam.ts  (new signature — old one kept as a thin wrapper for compatibility)
export async function getTeacherExamsPaged(input: Partial<ExamFilter> = {}) {
  const teacher = await requireTeacher();
  const f = examFilterSchema.parse(input);
  const where = buildExamWhere(f, teacherExamScope(teacher));

  const [rows, total, statusFacets] = await Promise.all([
    prisma.exam.findMany({
      where, orderBy: buildExamOrderBy(f),
      skip: (f.page - 1) * f.perPage, take: f.perPage,
      select: {
        id: true, title: true, startTime: true, endTime: true, duration: true,
        published: true, examCode: true, subjects: true, proctoring: true,
        batch: { select: { id: true, name: true } },
        _count: { select: { questions: true, sessions: true } },
      },
    }),
    prisma.exam.count({ where }),
    prisma.exam.groupBy({ by: ["published"], where, _count: { _all: true } }), // → facets
  ]);

  return { rows, total, page: f.page, perPage: f.perPage, totalPages: Math.ceil(total / f.perPage), facets: { status: statusFacets } };
}
```

#### Step 5 — Build the UI kit (`ui/filters/`)

| Component | Responsibility |
|---|---|
| `<FilterBar schema>` | Renders configured controls, owns "Clear all", exposes active count |
| `<SearchInput>` | `useDeferredValue` + 300 ms debounce, `/` keyboard shortcut, `×` clear, `aria-label` |
| `<FacetSelect field options counts>` | Multi-select with live counts, "Show more" for long lists, keyboard accessible |
| `<DateRangeFilter>` | Presets (Today, 7d, 30d, This term) + custom, writes `from`/`to` |
| `<SortMenu>` | Enum-driven; toggles `dir`; shows `aria-sort` on the table header |
| `<ActiveFilterChips>` | One removable chip per active param + "Clear all" |
| `<Pagination>` | `total`, `page`, `perPage`; perPage selector; disables during transition |
| `<SavedViews>` | Named presets (`At risk`, `Ungraded`, `This week`) persisted per user |
| `<BulkActionBar>` | Appears on row selection: publish, duplicate, export, delete, assign batch |
| `<DataTable>` | Generic: column defs, sticky header, row selection, empty/loading/error states, `aria-sort` |

```tsx
// lib/filters/use-filter-params.ts  (client)
"use client";
export function useFilterParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setParams = useCallback((patch: Record<string, string | string[] | number | undefined>, opts = { resetPage: true }) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) next.delete(k);
      else next.set(k, Array.isArray(v) ? v.join(",") : String(v));
    });
    if (opts.resetPage) next.delete("page");
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  }, [params, pathname, router]);

  return { params, setParams, isPending, clearAll: () => startTransition(() => router.push(pathname, { scroll: false })) };
}
```

```tsx
// app/teacher/exams/page.tsx  (server component — the wiring pattern to copy)
export default async function ExamsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const filter = readParams(examFilterSchema, toURLSearchParams(sp));
  const { rows, total, page, perPage, facets } = await getTeacherExamsPaged(filter);

  return (
    <div className="max-w-6xl mx-auto">
      <ExamsHeader total={total} />
      <FilterBar>
        <SearchInput param="q" placeholder="Search title, batch…" />
        <FacetSelect param="status" options={[
          { value: "active", label: "Active", count: facets.status.active },
          { value: "upcoming", label: "Upcoming", count: facets.status.upcoming },
          { value: "draft", label: "Draft", count: facets.status.draft },
          { value: "expired", label: "Expired", count: facets.status.expired },
        ]} />
        <BatchFacet param="batch" />
        <DateRangeFilter />
        <SortMenu options={EXAM_SORT} />
      </FilterBar>
      <ActiveFilterChips />
      <Suspense key={JSON.stringify(filter)} fallback={<ExamListSkeleton />}>
        <ExamList exams={rows} />
      </Suspense>
      <Pagination total={total} page={page} perPage={perPage} />
      <BulkActionBar />
      <ExportButton scope="filtered" filter={filter} />  {/* exports the filtered set, not the table */}
    </div>
  );
}
```

#### Step 6 — Per-surface filter matrix (what to ship, in order)

| # | Surface | Filters | Sort | Facets | Extra |
|---|---|---|---|---|---|
| 1 | **Teacher Exams** | q, status, batch, subject, date range, has-questions / has-submissions | title, start, end, created, #sessions, #questions | status, batch | bulk publish/duplicate/delete, saved views ("Drafts", "Live now") |
| 2 | **Exam Results** | q (name/PRN/email), status, score band %, pass/fail, violations ≥, section/topic, submitted-after | score, %, name, PRN, submittedAt, violations | status, score band, violation band | bulk release results, regrade selected, export filtered XLSX/PDF, per-row drill-down |
| 3 | **Live Monitor** | q (name/PRN), status, violations ≥ 1/3+, duplicate IP, idle > N min, not-started | risk desc, violations, progress, last activity | status, risk | pinned at-risk rows, CSV snapshot, force-submit selected, broadcast message |
| 4 | **Batches** | q, department, year, division, size band | name, created, #students, #exams | department, year | bulk add students by CSV, archive |
| 5 | **Batch Roster** | q (name/PRN/email) | name, PRN, addedAt | — | multi-select remove, CSV import/export |
| 6 | **Question List / Bank** | q, type, difficulty, topic, tags, points band | order, points, difficulty, successRate | type, difficulty, topic | drag-reorder, bulk delete, "add from bank", edit-lock after publish |
| 7 | **Certificates** | q, grade, score band, issue date, exam | issueDate, score | grade, exam | bulk ZIP download, revoke, re-issue |
| 8 | **Student Dashboard** | q, subject, status (upcoming/available/missed/completed), date | start, end, score | status, subject | "Practice mode" filter, calendar view |
| 9 | **Analytics** | type, difficulty, topic, batch subset, score band (cohort) | — | topic, difficulty | compare cohorts, export chart data |
| 10 | **Audit / Proctor log** (new) | student, event type, severity, date, exam | occurredAt, severity | type, severity | timeline view, evidence export for a malpractice case |

#### Step 7 — Facet counts, performance, and the "trap" to avoid

```ts
// ✅ Correct: one aggregate query per facet, over the *scope + all filters except the facet itself*
const facets = await prisma.studentExamSession.groupBy({
  by: ["status"],
  where: filtersWithoutStatus,     // prevents the "selecting a status makes the other counts 0" bug
  _count: { _all: true },
});
```

* Run `rows` + `count` + `groupBy` in a **single `Promise.all`**.
* `perPage` max 100. Never `findMany()` without `take`.
* Keep the filter AST in the URL; add `useOptimistic`/`useTransition` so typing feels instant while the server round-trips.
* For the live monitor stream: cursor pagination + `router.refresh()` on Pusher events instead of a full reload.
* Add `loading.tsx` skeletons per route (only `app/teacher/loading.tsx` and `app/student/loading.tsx` exist today) and `<Suspense key={...}>` per filtered list so the header/filters stay interactive while rows stream.

#### Step 8 — Testing the filter layer

```ts
// lib/filters/__tests__/exams.test.ts  (Vitest — new)
it("ORs status buckets and ANDs the scope", () => {
  const where = buildExamWhere({ status: ["active", "draft"], page: 1, perPage: 25, sort: "createdAt", dir: "desc" },
                               { batch: { teacherId: "t1" } });
  expect(where.AND).toHaveLength(2);
});
it("caps perPage and ignores unknown sort fields", () => { /* ... */ });
```

Add a Playwright spec: *filter → reload → filters persist → export contains only the filtered rows*.

**Estimated effort:** core (steps 1–5) ≈ 2–3 days; wiring surfaces #1–#3 ≈ 1–2 days; the rest ≈ 3–4 days. Ship #1, #2, #3 first — those are where teachers actually feel pain.

---

## Part B — Critical fixes (do these first)

These are ordered by risk. Each is real in the current code, not hypothetical.

### P0-1 · Pusher channels are **public** → PII leak
`app/lib/pusher-server.ts` triggers on `exam-${examId}`; `app/lib/pusher-client.ts` creates the client with no `authorizer`. Pusher **public** channels can be subscribed by anyone who knows the app key (which is in the client bundle by design) and the channel name. The payloads include student **names, PRNs, and IP addresses**, plus live answer counts.
**Fix:** use `private-exam-${examId}` (and `private-user-${id}`) with `channelAuthorization` pointing at an auth route that (a) verifies the session, (b) verifies the caller is the exam's owning teacher *or* the enrolled student. Note that teachers and students must not share a channel with each other's payloads — split into `private-exam-${id}-staff` and `private-session-${sessionId}`.

### P0-2 · Anti-cheat is entirely client-reported
`logTabSwitch` increments a counter. A student can simply not call it (DevTools/extension), call it with a different session, or call it in a loop. There is no heartbeat, no server-side session validity check, no duplicate-tab detection, no reconnect detection, no event timeline.
**Fix:** (a) add `lastHeartbeatAt` + a `heartbeat(sessionId)` action called every 15 s; the live monitor marks a session `DISCONNECTED` after 3 missed beats and logs a `ProctorEvent`; (b) write every violation to `ProctorEvent` (type, severity, metadata) instead of only incrementing an int; (c) issue a per-session nonce in `startExamSession` and require it on every mutating action; (d) enforce single active tab (BroadcastChannel/localStorage lock) and single active session; (e) reconcile with an `ipAddress`/`userAgent` mismatch check.

### P0-3 · `startExamSession` is a directly-callable server action with no authorization checks
`app/student/exams/[id]/page.tsx` checks batch membership and `published` — but the action it calls (`app/actions/exam.ts:startExamSession`) checks only that the caller is *a* student. Any authenticated student who knows an exam UUID can invoke the action directly (server actions have stable IDs and are callable from the client) and start/answer an exam for a batch they are not in, including unpublished exams, outside the time window.
**Fix:** inside the action, verify `exam.published === true`, `batch.students.some(id === studentId)`, and `startTime <= now <= endTime` (with a configurable early-start grace). Reuse a `assertStudentExamAccess(examId, studentId)` helper.

### P0-4 · `saveSubmission` accepts any `questionId` and any answer shape
Same file: the action upserts `{sessionId, questionId}` without verifying the question belongs to the exam. It also doesn't verify the question type matches the payload (an MCQ answer can be written into a coding question and vice-versa), doesn't cap string length (a 10 MB `codeAnswer` will happily hit the DB), and doesn't enforce `now >= exam.startTime`.
**Fix:** validate `questionId ∈ exam.questions`, `type` matches the payload branch, `mcqAnswer ∈ Object.keys(options we issued)`, `codeAnswer.length <= 20_000`, and use `zod` for runtime validation of every action input.

### P0-5 · `startExamSession` / `submitExam` lack a results-release gate → answer-key leak
`app/student/exams/[id]/result/page.tsx` renders `q.correctAnswer` (and passes `questions={exam.questions}` — including the key — into the client-side `StudentResultExporter`) as soon as the student submits. In a live exam where some students are still writing, the key can be shared immediately.
**Fix:** add `Exam.resultsReleasedAt` (and/or `showAnswersPolicy: NEVER | AFTER_EXAM_END | AFTER_RELEASE`); gate the correct-answer render and the exporter payload on it; default to `AFTER_EXAM_END`.

### P0-6 · `issueCertificate` has no role check (IDOR / certificate fraud)
`app/actions/certificate.ts` only asserts `if (!session) throw`. Any logged-in student can call `issueCertificate(examId, theirOwnId)` — or another student's id — and mint a certificate, because the action itself does not verify the caller is a teacher, does not verify ownership, and does not verify the session belongs to them.
**Fix:** `requireTeacher()` + `assertExamAccess(examId, teacher)` for manual issuance; for the automatic path, call an internal (non-exported) `issueCertificateInternal` that trusts the caller from `submitExam` — never expose a "system" function as a public action.

### P0-7 · Certificate ID + verification code are race-prone
`const count = await prisma.certificate.count(); const id = SA-${year}-${count+1}` → two concurrent submissions produce the same ID and the unique constraint throws (or worse, if unique weren't there, a duplicate). `verificationCode` uses `Math.random()`.
**Fix:** use a Postgres sequence / `generate_series`-backed counter table inside a transaction, or switch to `crypto.randomUUID()`/`cuid2` for both, and use `crypto.randomInt`/`randomBytes` (never `Math.random`) for anything security-relevant.

### P0-8 · `/api/debug-ai` ships a diagnostic endpoint to production
It returns `env_check: apiKey.substring(0,5) + "****"`, the upstream error body, and a hardcoded model name. It's teacher-gated, which is better than nothing, but it still leaks configuration info and burns API credits on demand. There is no rate limiting, so a teacher account can drain the AI budget.
**Fix:** delete the route (or gate with `process.env.NODE_ENV !== "production"`), and add per-user rate limiting to `generateAIQuestions`, `explainCodeSubmission`, `runCode`, `evaluateCode`, `signUp`, and NextAuth's `authorize` (Upstash Ratelimit / Redis, or a `RateLimit` table for a no-extra-service start).

### P0-9 · `submitExam` evaluates Judge0 calls serially and blocks the request
`for (const submission of examSession.submissions)` → `evaluateCode` → `for (const tc of testCases)` → an awaited HTTP call each. A 40-question coding exam × 5 test cases = 200 sequential round-trips inside a request that also must finish before the browser can navigate. On Vercel this will hit the function timeout; if it fails mid-way, the session is left `STARTED` with ungraded rows.
**Fix:** make submission two-phase — mark `SUBMITTED` + enqueue (QStash / Inngest / a `GradingJob` table polled by a cron route), grade with concurrency ≤ 5, persist per-test-case results (`SubmissionTestCase`), set `TIMEOUT`/status per row, and show "Grading in progress" in the student result page. Also set Judge0 `cpu_time_limit`, `memory_limit`, `max_file_size`, and support self-hosted auth (`X-Auth-Token` when `JUDGE0_API_URL` isn't RapidAPI).

### P0-10 · Live dashboard resubscribes on every event
`live-dashboard.tsx` `useEffect(..., [examId, sessions, addAlert])` — `sessions` changes on every Pusher event, so it unsubscribes/resubscribes the channel continuously (dropped events, churn, and a stale `sessions` closure in the `student-submitted` handler). Also `student-submitted` hardcodes `status: "COMPLETED"`, discarding `data.status` so force-submits render as normal completions.
**Fix:** depend on `[examId]` only; use `setSessions(prev => …)` (already done) and read the name from `prev` inside the updater; set `status: data.status`.

### P0-11 · No runtime validation anywhere
Server actions take hand-rolled object types. `createExam` accepts `duration` of `-5`, `startTime` after `endTime`, and `NaN`; `updateQuestion` accepts negative `points` (which would *increase* a score when multiplied). No `zod` in `package.json`.
**Fix:** `zod` schemas co-located with actions + a shared `ActionError` taxonomy; validate numerics, dates (`startTime < endTime`, `duration ∈ [1, 600]`, `points ∈ [0, 1000]`), and string lengths.

### P0-12 · `revalidatePath("/teacher/exams/[id]/results", "page")` is a no-op
In `submitExam`. The literal segment doesn't match the real path; the teacher results page will be stale until a hard refresh. Also `force-dynamic` on ~every page cancels most caching benefit. Fix the call (`/teacher/exams/${examId}/results`) and prefer `revalidateTag(\`exam-${examId}\`)` with `unstable_cache`.

### P0-13 · Smaller but real
* `TEACHER_SIGNUP_CODE || "SMART_TEACHER_2026"` — a hardcoded fallback secret in `app/actions/auth.ts`. Fail closed if the env var is missing.
* Password minimum 6, no reset, no email verification, no lockout, no "revoke all sessions". JWT sessions never pick up role/department changes (a transferred teacher keeps old scope until token expiry) — re-fetch on `jwt` callback with a short TTL or add a `tokenVersion`.
* `app/db.ts` silently falls back to a dummy localhost database — a misconfigured production deploy will boot and fail mysteriously at query time instead of at startup.
* `xlsx@0.18.5` (npm) is the last npm-published SheetJS release and carries known prototype-pollution/ReDoS advisories; SheetJS now distributes via their own CDN. Plan a migration (`exceljs` or `@e965/xlsx`) or pin/audit consciously.
* `next-auth@4` + Next 16 + React 19: v4 is in maintenance and the `as unknown as` adapter cast in `app/lib/auth.ts` is a symptom. Evaluate Auth.js v5 or Better Auth.
* `prisma/db.ts` uses `log: ["query"]` for Prisma Postgres connections — that's SQL logging at full volume in production.

---

## Part C — Roadmap: best features to add

Grouped by theme, ordered by impact-to-effort. ✅ = exists (per ROADMAP.md), 🟡 = partial, ⬜ = not started.

### C.1 Assessment intelligence (highest leverage)

| Feature | Why | Effort |
|---|---|---|
| **Item analysis** (facility index p-value, point-biserial discrimination, distractor analysis, Cronbach's α) | Tells teachers *which questions are broken*, not just "40% got it wrong". Distinguishes a genuinely hard question from a badly-worded one. | M |
| **Unfair/leaky question detector** | Flag questions where high performers fail more than low performers (negative discrimination) — classic sign of a wrong key or ambiguous wording. | S–M |
| **Topic mastery & weakness analysis** 🟡 (ROADMAP "Planned") | Per-student and per-cohort topic radar; drives the "practice recommendation" loop. Requires `Question.topic`. | M |
| **Blueprint-based random paper generation** | Quotas per topic/difficulty/section → unique paper per student, auto-balanced. Store a paper snapshot per session for auditability. | L |
| **Practice mode** | Same engine, no proctoring, instant feedback, unlimited retakes, per-topic drills. Big student-value add for near-zero new infrastructure. | M |
| **Question versioning + edit lock after publish** | Today editing a question mutates an in-flight exam. Snapshot `QuestionVersion` (or clone questions on publish) so live exams are immutable. | M |

### C.2 Proctoring 2.0 (make it defensible)

* ⬜ **`ProctorEvent` timeline** (see P0-2) with severity and metadata — the single most important upgrade; everything else builds on it.
* ⬜ **Heartbeat + abandonment detection**, `DISCONNECTED` status, resume window.
* ⬜ **Duplicate-tab / multi-device detection**, per-session nonce, single-active-session enforcement.
* ⬜ **IP + device fingerprint collision** across *all* exams, not just within one monitoring session (currently the duplicate-IP check is client-side and only inside the live view).
* 🟡 **Optional webcam snapshot on violation** (consent-gated, stored with retention policy) — check institutional policy before shipping.
* ⬜ **AI anomaly summary** for the invigilator: "3 sessions flagged: user X switched tabs 5× in 2 min after question 7" — summarize `ProctorEvent` rather than raw counters.
* ⬜ **Force-submit / pause / extend-time / message-student** commands from the live dashboard (ROADMAP lists force-submit as Planned) via private channels, with an audit record.
* ⬜ **Kiosk guidance**: PWA fullscreen + Safe Exam Browser / lockdown-browser config for high-stakes exams, documented per institution.

### C.3 Academic integrity analytics

* ⬜ **Answer-collusion detection**: pairwise similarity matrix over (answer sets, timing) within a batch — flags plausible copying pairs for human review. This is a *filter* on the results page ("flagged pairs").
* ⬜ **Code plagiarism/similarity** (token-normalized / AST-based, k-gram winnowing) for coding questions; store a similarity score per submission pair.
* ⬜ **Malpractice case file export** — one PDF/ZIP per flagged student with violations, IP/UA, similarity, and submissions.

### C.4 Notifications & scheduling

* ⬜ **Email** (Resend/Postmark + React Email): exam scheduled, exam starts in 1 h, results released, certificate issued, missing submissions digest.
* ⬜ **`.ics` calendar invites** + teacher calendar view (day/week/month) with drag-to-reschedule.
* ⬜ **Web push / in-app notification center** for "results released" and "exam live now".
* ⬜ **Scheduled reminders** to students who haven't started 10 min before the window closes.

### C.5 Grading & workflow

* ⬜ **Manual grading queue** for descriptive/subjective types, with rubric checklists, per-question marks, comments, double-marking, and moderation.
* ⬜ **Regrade / re-evaluate** a single student or all students after fixing a key (with an audit trail of score deltas).
* ⬜ **Grade release workflow** (draft → approved → released) and score overrides with reason.
* ⬜ **Negative marking, partial credit rules, per-section timing, weighted sections** (all currently impossible to express).
* ⬜ **Bulk student onboarding**: CSV of `name,email,prn,dept,year,division` → invite emails; only single-add exists today.

### C.6 Platform & architecture

* ⬜ **`zod`-validated action layer** + `ActionError` mapping to user-safe messages (stop leaking raw `Error.message` to the client).
* ⬜ **Sentry / structured logging / metrics** — you currently have 37 `console.*` calls and no error tracking; add `error.tsx` boundaries and `not-found.tsx`.
* ⬜ **Caching layer**: `unstable_cache`/`revalidateTag` per exam, replace blanket `force-dynamic`, use `Suspense` streaming.
* ⬜ **Background jobs** (QStash/Inngest/BullMQ) for grading, exports, email, AI batch generation.
* ⬜ **Testing**: Vitest (filter builders, scoring, shuffle integrity, grading math) + Playwright (login → take exam → submit → result → certificate; proctoring via `page.evaluate` on `visibilitychange`) + a k6 load test on the live monitor channel. Currently **zero tests**.
* ⬜ **CI hardening**: add `prisma migrate deploy` against a throwaway Postgres service container, `npm audit --audit-level=high`, Dependabot, Prettier + `lint-staged` + commitlint, and a preview deploy per PR.
* ⬜ **RBAC expansion**: `ADMIN` (institution), `INVIGILATOR` (can watch but not edit), co-teachers per exam, department-scoped admins.
* ⬜ **Audit log** for privileged actions (publish, delete, regrade, certificate revoke, results release).
* ⬜ **Data protection**: consent + retention policy for IP/UA/webcam data, per-institution data export/delete (DPDP/GDPR), secrets rotation, and a documented incident runbook.

### C.7 UX, accessibility, and polish

* ⬜ **Dark mode + design tokens** (Tailwind v4 `@theme`), a real `<DataTable>`, `<Modal>` (with focus trap — `confirm()` is used for destructive actions today), `<EmptyState>`, `<Badge>`, `<Skeleton>`.
* ⬜ **Timezone correctness.** `app/teacher/exams/page.tsx` and `app/teacher/exams/[id]/page.tsx` call `toLocaleString()`/`toLocaleDateString()` **in server components** → Vercel renders UTC to Indian users. Every date should go through the existing `app/student/local-time.tsx` client component (or `Intl` with an explicit `timeZone` from the user profile).
* ⬜ **Accessibility (WCAG 2.1 AA)**: labeled filter inputs, `aria-sort` on sortable headers, `aria-live` for live alerts, keyboard-operable MCQ options, focus management in the blur overlay, no color-only status, contrast pass on the `text-gray-400` uppercase labels, screen-reader-friendly anti-cheat messaging.
* ⬜ **Accommodation flags**: extra time (×1.5/×2), separate room, screen-reader mode, exempt from fullscreen requirement — stored per student per exam and respected by the clock and overlay logic.
* ⬜ **Mobile exam experience** + responsive tables (card view under `md`).
* ⬜ **i18n scaffolding** (`next-intl`) if multi-region is on the table.
* ⬜ **Reconnect/offline resilience**: autosave indicator, retry queue for `saveSubmission`, "your last answer was saved at 12:04:33" banner.
* ⬜ **Onboarding**: sample exam demo, first-run checklist for teachers, empty-state CTAs.

### C.8 Growth / platform plays

* ⬜ **Public question-bank marketplace / sharing across departments** (with license + moderation).
* ⬜ **Public practice contests** ("CodeChef-style" weekly) using the same Judge0 engine — marketing + student acquisition.
* ⬜ **LTI 1.3 / SCORM integration** for Moodle/Canvas institutions; grade passback.
* ⬜ **Certificates 2.0**: public verification page polish, QR + PDF/A, bulk issuance, revocation list, LinkedIn "Add to profile" deep link.
* ⬜ **Institution branding**: per-college logo/colors on exams and certificates.
* ⬜ **Usage metering & cost dashboard** for AI/Judge0 per teacher/department, with quotas.

---

## Suggested sequence (4 sprints)

**Sprint 1 — Foundations (must precede all filtering work)**
`lib/auth/scope.ts` refactor · `zod` validation · indexes migration · denormalized `StudentExamSession` score/violation columns · `Exam.status` + `Question.difficulty/topic/tags` · private Pusher channels · kill `/api/debug-ai` · fix P0-3/4/6/10/12.
*Definition of done: every existing page behaves identically, type-checks, and the new columns/indexes are populated by a migration + backfill script.*

**Sprint 2 — Filter core + the 3 surfaces that hurt most**
`lib/filters/*` (parse/schemas/builders) · `ui/filters/*` kit · **Teacher Exams**, **Exam Results**, **Live Monitor** with filters, facets, sort, pagination, filtered export, saved views.
*DoD: a teacher with 500 exams and 300 sessions can find anything in ≤ 2 interactions; filter state survives refresh and is shareable.*

**Sprint 3 — Remaining surfaces + analytics depth**
Batches, roster, question bank, certificates, student dashboard, proctor log · item analysis (facility/discrimination/α) · topic mastery dashboards · release-results gate.
*DoD: no page loads an unbounded query; every list is filterable; analytics answers "which questions are broken?"*

**Sprint 4 — Integrity & reliability**
`ProctorEvent` + heartbeat + duplicate-tab detection · async grading pipeline with per-test-case results · email notifications + calendar · rate limiting · Sentry + Vitest/Playwright suites + CI migrations.
*DoD: proctoring has an auditable timeline; submission grading survives function timeouts; test coverage on the critical path.*

---

## Quick wins you can ship today (≤ 1 h each)

1. Delete `app/api/debug-ai/route.ts` (or gate it behind `NODE_ENV !== "production"`).
2. Change `live-dashboard.tsx` deps to `[examId]` and respect `data.status` on `student-submitted`.
3. Fix `revalidatePath(\`/teacher/exams/${examId}/results\`)` in `submitExam`.
4. Replace `toLocaleString()` in the two teacher server components with the existing `<LocalTime>` client component.
5. Fail-closed on `TEACHER_SIGNUP_CODE` (`if (!process.env.TEACHER_SIGNUP_CODE) throw`) and raise the password minimum to 8.
6. Add `requireTeacher()`/`assertExamAccess()` inside `issueCertificate` and `startExamSession`.
7. Add `take: 100` to `getTeacherExams`, `getExamResults`, and `getExamAnalytics`'s session include.
8. Add the 12 indexes via one `CREATE INDEX` migration.
9. `crypto.randomBytes` for `verificationCode`; `randomUUID` for `certificateId`.
10. Add `error.tsx` + `not-found.tsx` at `app/` level so a thrown action renders a friendly page instead of a stack trace.
11. Use `private-` channels in Pusher (one-line change on both server and client once the auth route exists).
12. Add `resultsReleasedAt` to `Exam` and gate the answer-key block in the student result page.

---

### Appendix — Files that will change

| Change | Files |
|---|---|
| New filter core | `lib/filters/{parse,schemas,builders/*,use-filter-params}.ts`, `lib/filters/__tests__/*` |
| New filter UI | `ui/filters/{FilterBar,SearchInput,FacetSelect,DateRangeFilter,SortMenu,ActiveFilterChips,Pagination,SavedViews,DataTable,BulkActionBar}.tsx` |
| Rewritten surfaces | `app/teacher/exams/page.tsx`, `app/teacher/exams/[id]/results/page.tsx`, `app/teacher/exams/[id]/live/live-dashboard.tsx` + `page.tsx`, `app/teacher/batches/page.tsx`, `app/teacher/batches/[id]/student-manager.tsx`, `app/teacher/exams/[id]/page.tsx`, `app/student/page.tsx` |
| Rewritten actions | `app/actions/exam.ts` (paged/filtered reads), `app/actions/batch.ts`, `app/actions/certificate.ts`, `app/actions/judge0.ts` |
| New auth/validation | `lib/auth/scope.ts`, `lib/validation/*.ts`, `app/actions/safe-action.ts` |
| Schema/migrations | `prisma/schema.prisma` + 3 migrations (filtering indexes, exam/question metadata, proctor events + denormalized scores) |
| New realtime | `app/api/pusher/auth/route.ts`, `app/lib/pusher-client.ts`, `app/lib/pusher-server.ts` |
| Tests/CI | `vitest.config.ts`, `playwright.config.ts`, `e2e/*.spec.ts`, `.github/workflows/ci.yml` |

> **Note on verification:** `node_modules` is not installed in this checkout, so `npm run type-check` / `npm run build` could not be executed here. Run `npm install && npm run type-check && npm run lint` after any of these changes; the CI workflow at `.github/workflows/ci.yml` already covers lint + type-check + build.

---

## Sprint 1 delivery notes

Sprint 1 ("Foundations") is implemented on this branch. Nothing in Sprint 2+ (the filter engine and UI kit) has been started yet — the schema/indexes/validation/authorization groundwork it depends on is now in place.

### What shipped

**Authorization & validation foundations**
- `lib/auth/scope.ts` — `requireUser/requireTeacher/requireStudent` (request-memoized), `teacherBatchScope`, `teacherExamScope`, `assertExamAccess`, `assertBatchAccess`, `assertStudentExamAccess`. The copy-pasted "teacher owns this batch/exam" block is gone from all 7 action modules and 6 pages.
- `lib/validation/schemas.ts` + `lib/validation/parse.ts` — zod runtime validation for every server-action boundary, with business rules (start < end, duration ≤ window, MCQ needs ≥2 non-empty options and a valid key, coding needs a test case with an expected output, string/size caps, code ≤ 20 000 chars).
- `lib/rate-limit.ts` — Postgres-backed fixed-window limiter (works across serverless instances): AI generation, AI explainer, code runs, sign-up, login, submissions, heartbeats and proctor telemetry.

**P0 security fixes**
- Certificate forgery (P0-6): `issueCertificate` is teacher-scoped and exam-scoped; issuance logic moved to `lib/certificates/issue.ts` so it is no longer a public endpoint.
- Certificate numbering (P0-7): race-free Postgres sequence + `randomBytes` verification codes.
- Exam-session IDOR (P0-3/4): `startExamSession` now enforces published + batch membership + time window; `saveSubmission` validates question↔exam mapping, answer type, option keys and payload size.
- Answer-key leak (P0-5): the student result page gates correct answers on `Exam.answerReveal` (`IMMEDIATELY` / `AFTER_EXAM_END` / `AFTER_RELEASE` / `NEVER`), and the exporter no longer receives raw question rows containing `correctAnswer`.
- Pusher PII leak (P0-1): all channels are now `private-*`, authorized per subscription in `app/api/pusher/auth/route.ts` (teachers must own the exam; students may only see their own session channel).
- `/api/debug-ai` deleted (P0-8).
- Grading (P0-9): coding submissions are graded with a bounded concurrency pool, totals/percentages are persisted, and negative marking is honoured.
- Live dashboard (P0-10): the Pusher subscription no longer tears down on every event, and `FORCE_SUBMITTED` is no longer rendered as `COMPLETED`.
- `revalidatePath` target fixed (P0-12); UTC-not-IST timestamps fixed via `ui/local-time.tsx` on all teacher pages (P0-13).
- Auth hardening: teacher sign-up fails closed without `TEACHER_SIGNUP_CODE`/`TEACHER_EMAIL_DOMAIN`, password minimum raised to 8 (client + server), per-account login throttling.
- `app/db.ts` no longer boots production against a dummy local database, and no longer logs every SQL query in production.

**Schema, indexes and data model** (`prisma/migrations/20261001120000_filtering_foundation/`)
- `Exam`: `status`, `examCode`, `resultsReleasedAt`, `answerReveal`, `proctoring` (JSON), `negativeMarking`, `subjects`.
- `Question`: `difficulty`, `topic`, `tags[]`, `bloomLevel`, `explanation`.
- `StudentExamSession`: `totalScore`, `maxScore`, `percentage`, `violationCount`, `riskScore`, `lastHeartbeatAt`, `submittedAt` — with a backfill that computes them for all existing rows.
- New `ProctorEvent` audit table (immutable event trail) and `RateLimitCounter`.
- 24 indexes on the columns every list/filter query actually uses (previously: one non-unique index across the whole schema).
- Certificate numbering sequence.

**Proctoring**
- `heartbeat()` action + 20-second client beacon; `logProctorEvent()` records `TAB_BLUR`, `FULLSCREEN_EXIT`, `CLIPBOARD_ATTEMPT`, `DEVTOOLS_ATTEMPT` with severity and metadata; the threshold comes from `Exam.proctoring.maxTabSwitches` (defaults to the previous hard-coded 3); risk score is derived from the event trail.

### How to deploy this

```bash
npm install                 # regenerates the Prisma client
npx prisma migrate deploy   # applies 20261001120000_filtering_foundation
npm run type-check && npm run lint
npm run build
```

New/updated environment variables (all optional except where noted):

| Variable | Purpose |
|---|---|
| `TEACHER_SIGNUP_CODE` | **Required for invite-code teacher sign-up** (no hard-coded fallback any more). |
| `TEACHER_EMAIL_DOMAIN` | Comma-separated institutional domains allowed to self-register as teachers. |
| `OPENROUTER_MODEL` | Overrides the `openrouter/auto` default. |
| `NEXT_PUBLIC_APP_URL` | Sent as the OpenRouter referer (replaces the hard-coded `http://localhost:3000`). |
| `JUDGE0_API_HOST` / `JUDGE0_AUTH_TOKEN` | Use a self-hosted Judge0 instead of RapidAPI. |

Verify the migration on a staging copy first: it backfills scores for every existing session and adds NOT NULL columns.

### Not done yet (next sprints)

- Sprint 2: `lib/filters/*`, `ui/filters/*`, and the Teacher Exams / Results / Live Monitor surfaces.
- Proctoring 2.0 gaps: duplicate-tab detection, IP-collision detection is still only *reported* not enforced, no detachment/kiosk mode, no force-submit/broadcast teacher commands.
- Async/queued grading: `submitExam` still grades inside the request (now with bounded concurrency).
- Manual grading, regrade workflow, item analysis, topic mastery dashboards.
- Test suite (Vitest + Playwright) and CI migration step.
- `xlsx@0.18.5` advisory and the `next-auth@4` → Auth.js v5 evaluation.
