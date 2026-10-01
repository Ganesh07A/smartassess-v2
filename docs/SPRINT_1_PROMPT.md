# Sprint 1 — Handoff Prompt (copy everything below the line into your agent)

> **How to use this document**
> - **If your agent starts from `main` (`a3cd136`)** — hand it the whole prompt. It describes the current broken state and the target state.
> - **If your agent starts from this branch (`arena/01a0f81e-smartassess-v2`, PR #15)** — Sprint 1 is already implemented. Then tell the agent: *"Review the existing implementation against the acceptance checklist in §10, fix anything that fails, and skip §4–§9 unless a checklist item fails."*
> - Companion documents: `docs/UPGRADE_PLAN_AND_FILTERING.md` (full analysis + Sprint 2–4 designs).

---

## 1. Your role and objective

You are a senior full-stack engineer working on **SmartAssess v2**, an examination portal with live proctoring, remote code execution (Judge0) and AI-assisted question generation.

Your job in this sprint is **not** to add features. It is to make the platform **safe to run a real exam on**: correct authorization, runtime input validation, abuse limits, and the database foundations (columns + indexes) that every later feature depends on.

**Definition of success:** a hostile or buggy client cannot read another teacher's data, forge a certificate, answer a question that is not in their exam, start an exam they are not enrolled in, or learn the answer key while the exam is still running — and the database is fast enough that list pages do not fall over at a few thousand rows.

**Do not start Sprint 2 work** (search/filter/sort/pagination UI). Out of scope is listed in §13.

---

## 2. Repository orientation (read this before touching anything)

**Stack:** Next.js 16 (App Router, React 19, Server Components + Server Actions), TypeScript strict, Prisma 7 + PostgreSQL, NextAuth v4 (JWT strategy, credentials), Tailwind v4, Pusher (realtime), Judge0 (code execution), OpenRouter (AI), `xlsx` + `jspdf` (exports).

**Layout:**
```
app/actions/*.ts          ← server actions ("use server"): exam, batch, certificate, judge0, ai, auth
app/lib/auth.ts           ← NextAuth options, JWT/session callbacks, role + department on the token
app/db.ts                 ← singleton PrismaClient (pg Pool adapter in non-Prisma-Postgres mode)
app/lib/pusher-{server,client}.ts
app/teacher/**            ← teacher dashboard, exam builder, live monitor, results, batches
app/student/**            ← student dashboard, exam runner (exam-client.tsx), results, certificates
prisma/schema.prisma      ← 13 models + 5 migrations
lib/utils.ts, ui/*        ← shared helpers/components
proxy.ts                  ← route protection middleware (Next 16 name; was middleware.ts)
```

**Three rules that will bite you if you ignore them:**
1. **Every export of a `"use server"` module is a publicly callable HTTP endpoint.** Internal helpers that must only run server-side (system-triggered certificate issuance, grading, Judge0 transport) must live in a **non-`"use server"` module** under `lib/`, or remain unexported.
2. **`AGENTS.md` is authoritative:** this Next.js version has breaking changes vs. your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code. Note the middleware file is `proxy.ts` exporting `proxy()`.
3. **Server actions must re-verify authorization.** Page-level checks (`app/student/exams/[id]/page.tsx`) are *not* a security boundary — an attacker calls the action directly with any id they like.

Prisma config: `prisma.config.ts` (loads `.env` via dotenv, sets schema + migrations path + seed command). Errors must be verified with `npx prisma validate` and `npx prisma format`.

---

## 3. Workstream overview

| # | Workstream | Why it blocks everything else |
|---|---|---|
| 4 | Authorization scoping module | The filter/query builders planned for Sprint 2 take a scope argument; building them on today's copy-pasted auth is how tenant leaks get introduced. |
| 5 | Runtime validation (zod) | Every action currently trusts its TypeScript types, which are erased at runtime. |
| 6 | Rate limiting | AI + Judge0 costs are unbounded and reachable by any logged-in user. |
| 7 | Schema, migration, indexes | Sprint 2 cannot filter by score/status/difficulty/topic until these columns exist; the DB has 1 non-unique index for 13 tables. |
| 8 | P0 security & correctness fixes | Certificate forgery, IDOR, answer-key leak, PII leak — these are shippable-today vulnerabilities. |
| 9 | Proctoring event trail | The current single integer counter is not defensible evidence of anything. |

Work in that order. Commit per workstream so review is possible.

---

## 4. Workstream 1 — Centralize authorization (`lib/auth/scope.ts`)

### What is wrong today

The following block is **copy-pasted in ~10 server actions and ~6 pages** (`app/actions/exam.ts` ×8, `app/actions/batch.ts` ×5, `app/teacher/page.tsx`, `app/teacher/exams/page.tsx`, `app/teacher/exams/[id]/page.tsx`, `app/teacher/exams/[id]/live/page.tsx`, `app/teacher/exams/[id]/results/page.tsx`, `app/teacher/batches/[id]/page.tsx`):

```ts
const session = await getServerSession(authOptions);
if (!session || session.user.role !== "TEACHER") throw new Error("Unauthorized");
const teacher = await prisma.user.findUnique({ where: { id: session.user.id }, select: { department: true } });
const teacherDept = teacher?.department;
// then, in every query:
where: { batch: { OR: [ { teacherId: session.user.id }, ...(teacherDept ? [{ department: teacherDept, teacherId: null }] : []) ] } }
```

Consequences: (a) each copy is a chance to drift and leak another department's data; (b) the same "which exams may I see" definition cannot be reused by the query builders Sprint 2 needs; (c) each call re-reads the teacher row, so one page issues the same query 3–4 times.

### What to build

Create `lib/auth/scope.ts` (`import "server-only"`) exporting:

```ts
declare class UnauthorizedError extends Error {}
declare class NotFoundOrUnauthorizedError extends Error {}

// React `cache()` so N call sites share one session read per request
export const requireUser: () => Promise<SessionUser>;
export const requireRole: (role: Role) => Promise<SessionUser>;
export const requireStudent: () => Promise<SessionUser>;
export const requireTeacher: () => Promise<TeacherScope>; // re-reads department from DB every time

export function teacherBatchScope(teacher): Prisma.BatchWhereInput;
export function teacherExamScope(teacher): Prisma.ExamWhereInput;

export function assertExamAccess(examId, teacher, select?: Prisma.ExamSelect);   // throws NotFoundOrUnauthorizedError
export function assertBatchAccess(batchId, teacher, select?: Prisma.BatchSelect);
export function assertStudentExamAccess(examId, studentId, opts?: { ignoreWindow?: boolean });
```

`assertStudentExamAccess` must verify **all four**: exam exists, `published === true`, `batch.students.some(id === studentId)`, and (unless `ignoreWindow`) `startTime <= now <= endTime`.

**Then delete the duplicated blocks** in all the files listed above and call these helpers. Behaviour must be identical for the happy path. Reuse `teacherExamScope()` in: `getTeacherExams`, `uploadQuestions`, `removeQuestionFromExam`, `updateQuestion` (must also verify the question belongs to the exam — see §7.4), `getExamResults`, `getExamAnalytics`, `duplicateExam`, `publishExam`, `deleteBatch`, `getBatchDetails`, `addStudentToBatch`, `removeStudentFromBatch`, and the 5 pages.

**Verified working reference implementation:** `lib/auth/scope.ts` on branch `arena/01a0f81e-smartassess-v2` (PR #15). Match its semantics.

---

## 5. Workstream 2 — Runtime validation (`lib/validation/`)

### What is wrong today

No zod (or any) runtime validation exists anywhere. Concretely exploitable:

- `createExam` (`app/actions/exam.ts`) accepts `duration: -5`, `NaN` dates, `startTime > endTime`, and a `batchId` belonging to another teacher (see §7.2).
- `updateQuestion` accepts `points: -50` → `pointsAwarded = (passed/total) * -50` **reduces** a student's score; also `points` feeds `pointsAwarded = isCorrect ? examQuestion.points : 0`.
- `saveSubmission` accepts arbitrarily long `codeAnswer` strings (10 MB will reach Postgres) and any `questionId`.
- `signUp` (`app/actions/auth.ts`) validates with hand-rolled `if` statements and no length caps.
- `explainCodeSubmission` / `generateAIQuestions` (`app/actions/ai.ts`) accept unbounded prompt text — a cost vector.

### What to build

1. Add `zod` to `dependencies` (use a v3 line such as `^3.25.x`).
2. `lib/validation/schemas.ts` — one schema per action boundary, with **business rules, not just types**:
   - `createExamSchema`: `title` ≤ 200, `duration` int 1–600, `startTime < endTime`, `duration * 60_000 <= endTime - startTime`, optional `negativeMarking` 0–10, optional `proctoring { maxTabSwitches 1–20, blockClipboard, requireFullscreen }`, optional `subjects[]`.
   - `questionInputSchema`: discriminated on `type`; MCQ requires **≥2 non-empty options** and `correctAnswer` must be a key whose text is non-empty; CODING requires ≥1 test case with a non-empty expected output; `points` 0–1000; `content` ≤ 20 000; `options` values ≤ 2000; optional `difficulty` (EASY/MEDIUM/HARD), `topic`, `tags[]`, `bloomLevel`, `explanation`.
   - `uploadQuestionsSchema` (1–500 questions), `updateQuestionSchema`, `examQuestionRefSchema`.
   - `saveSubmissionSchema`: `.strict()`, `mcqAnswer` ≤ 8 chars, `codeAnswer` ≤ 20 000, `language` enum, exactly one of the two present.
   - `proctorEventSchema`, `updateBlurStateSchema`, `heartbeat`, `issueCertificateSchema`, `runCodeSchema`, `generateQuestionsSchema` (prompt ≤ 8000, count 1–30), `explainCodeSchema`, `createBatchSchema`, `addStudentSchema`, `batchStudentSchema`, `duplicateExamSchema`, `signUpSchema` (email valid, **password ≥ 8**, role-discriminated required fields).
3. `lib/validation/parse.ts` — `parseInput(schema, data)` throwing a single `ValidationError` carrying `{ path, message }[]` so actions can return user-safe messages instead of a raw `ZodError`.
4. Apply `parseInput` at the **top of every exported action**, before any DB access.

**Important — preserve legitimate existing flows.** These two will break if you validate naively:
- `removeQuestionFromExam(examId, questionId)` has no `data` payload → validate with `examQuestionRefSchema` (a separate schema), **not** the full question schema.
- `question-builder-form.tsx` seeds MCQ options as `{A:"",B:"",C:"",D:""}` and `testCases: [{input:"",output:""}]`, so an unsaved-form empty row can reach validation. Handle it by rejecting in the UI with a clear message, and/or by making the "non-empty" rule the single documented rule — but never silently drop a question.
- `bulk-upload.tsx` currently builds options as `{A,B,C,D}` including blanks and does **not** validate the answer key. Fix it there too: drop blank options, skip rows whose `correctAnswer` is not among the non-empty options, skip CODING rows with no usable test case, and report the skipped rows to the teacher ("Uploaded 42 questions. Skipped 2 invalid rows: …").

---

## 6. Workstream 3 — Rate limiting (`lib/rate-limit.ts`)

### What is wrong today

Nothing is rate limited. Any authenticated teacher can loop `generateAIQuestions` and drain the OpenRouter budget; any student can loop `runCode` against Judge0; `/api/debug-ai` accepts unlimited calls; `signUp` accepts unlimited registrations; credentials login allows unlimited password guesses.

### What to build

A **Postgres-backed** fixed-window limiter (in-memory maps do not work on Vercel — each lambda has its own memory, so a client retries until it lands on a fresh instance):

```ts
export class RateLimitError extends Error { readonly retryAfterSeconds: number }
export async function enforceRateLimit(key: string, limit: number, windowMs: number): Promise<void>;
```

Implementation: one `upsert` on a `RateLimitCounter` table keyed by `(key, windowStart)`, incrementing `count`; throw `RateLimitError` when `count > limit`. Add an opportunistic (≈1 % of calls) `deleteMany` of windows older than 24 h so the table cannot grow unbounded; never let cleanup block the request.

Quotas to wire in:

| Call site | Key | Limit |
|---|---|---|
| `generateAIQuestions` | `ai:generate:<userId>` | 20 / hour |
| `explainCodeSubmission` | `ai:explain:<userId>` | 40 / hour |
| `runCode` | `judge0:run:<userId>` | 60 / minute |
| `signUp` | `auth:signup:<ip from x-forwarded-for>` | 5 / hour |
| NextAuth `authorize()` | `auth:login:<email>` | 10 / 15 min |
| `saveSubmission` | `exam:submit:<sessionId>` | 240 / minute |
| `heartbeat` | `exam:heartbeat:<sessionId>` | 20 / minute |
| `logProctorEvent` | `exam:proctor:<sessionId>` | 60 / minute |

Order matters in each action: **validate input first, then rate limit, then hit the DB.**

---

## 7. Workstream 4 — Schema, migration and indexes

### 7.1 What is wrong today

- **One** non-unique index exists in the entire schema (`_StudentBatches_B_index`). Prisma does not auto-create indexes for relation scalar fields on PostgreSQL, so `where: { examId }`, `where: { studentId }`, `where: { batchId }`, `orderBy: { startTime }` are all sequential scans that collapse at a few thousand rows.
- Scores are computed in JavaScript after fetching every session (`getExamResults`, `getExamAnalytics`, the student dashboard) — so you can never `ORDER BY score` or filter by score band.
- The exam lifecycle is derived from `published` + timestamps *in three different components*, each slightly differently; there is no way to filter "active" vs "draft" in SQL.
- Questions have no difficulty/topic/tags, so item analysis, weakness reports and blueprint paper generation are impossible.
- No audit trail for proctoring: only `tabSwitches: Int`.
- No rate-limit storage (see §6).

### 7.2 What to add to `prisma/schema.prisma`

New enums: `Difficulty { EASY MEDIUM HARD }`, `ExamStatus { DRAFT UPCOMING ACTIVE EXPIRED ARCHIVED }`, `AnswerRevealPolicy { NEVER AFTER_EXAM_END AFTER_RELEASE IMMEDIATELY }`, `ProctorEventType { EXAM_STARTED EXAM_SUBMITTED FORCE_SUBMITTED TAB_BLUR FULLSCREEN_EXIT CLIPBOARD_ATTEMPT DEVTOOLS_ATTEMPT HEARTBEAT_MISSED DUPLICATE_TAB IP_COLLISION TIME_EXTENDED TEACHER_MESSAGE }`.

- `Exam`: `status ExamStatus @default(DRAFT)`, `examCode String? @unique`, `resultsReleasedAt DateTime?`, `answerReveal AnswerRevealPolicy @default(AFTER_EXAM_END)`, `proctoring Json @default("{}")`, `negativeMarking Float @default(0)`, `subjects String[] @default([])`.
- `Question`: `difficulty Difficulty @default(MEDIUM)`, `topic String?`, `tags String[] @default([])`, `bloomLevel String?`, `explanation String?`.
- `StudentExamSession`: `totalScore Float @default(0)`, `maxScore Float @default(0)`, `percentage Float @default(0)`, `violationCount Int @default(0)`, `riskScore Int @default(0)`, `lastHeartbeatAt DateTime?`, `submittedAt DateTime?`.
- New `ProctorEvent { id, sessionId, type ProctorEventType, severity Int @default(1), metadata Json?, occurredAt DateTime @default(now()) }` with cascade delete from `StudentExamSession`.
- New `RateLimitCounter { key String, windowStart DateTime, count Int @default(0) @@id([key, windowStart]) }`.

### 7.3 The indexes (all currently missing)

`Exam(batchId,startTime)` · `Exam(published,startTime)` · `Exam(status)` · `Exam(endTime)` · `ExamQuestion(examId,order)` · `Submission(questionId)` · `Submission(submittedAt)` · `StudentExamSession(examId,percentage)` · `StudentExamSession(examId,violationCount)` · `StudentExamSession(examId,status)` · `StudentExamSession(examId,lastHeartbeatAt)` · `StudentExamSession(examId,updatedAt)` · `Batch(teacherId)` · `Batch(department)` · `Batch(createdAt)` · `Account(userId)` · `Session(userId)` · `Question(difficulty,topic)` · `Question(type,difficulty)` · `Question USING GIN(tags)` · `ProctorEvent(sessionId,occurredAt)` · `ProctorEvent(type,occurredAt)` · `ProctorEvent(severity,occurredAt)` · `Certificate(examId)` · `Certificate(issueDate)` · `RateLimitCounter(windowStart)`.

### 7.4 Migration requirements

- Create it with `npx prisma migrate dev --name filtering_foundation` (the SQL must be committed).
- **Backfill, do not assume empty tables:**
  - `Exam.status` ← from `published`, `startTime`, `endTime` relative to `NOW()`.
  - `StudentExamSession.totalScore` ← `SUM(Submission.pointsAwarded)` per session; `maxScore` ← `SUM(ExamQuestion.points)` per exam; `percentage` ← `ROUND(totalScore / maxScore * 100, 2)` guarded against `maxScore = 0`; `violationCount` ← `tabSwitches`; `riskScore` ← `LEAST(100, tabSwitches * 20)`; `submittedAt` ← `endTime` where status is COMPLETED/FORCE_SUBMITTED.
- Add a `CertificateNumber_seq` sequence and seed it past the current certificate count — certificate numbering currently does `count() + 1` and **must not** be replaced without a race-free source (see §8.5).
- Verify: `npx prisma validate`, `npx prisma format`, `npx prisma migrate deploy` against a scratch database, then `npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma` should report **no drift**.

---

## 8. Workstream 5 — P0 security and correctness fixes

Audit every file listed. Each item is a real defect, not a style preference.

### 8.1 Pusher channels are public → student PII is broadcast

`app/lib/pusher-server.ts` triggers on `` `exam-${examId}` ``; `app/lib/pusher-client.ts` constructs the client with no `channelAuthorization`, so the channel is **public**. Anyone with the app key (which ships to every browser by design) can subscribe and receive **student names, PRNs and IP addresses**, plus live answer counts.

**Fix:**
1. `app/lib/pusher-channels.ts`: `examChannel(examId) → "private-exam-" + id`, `studentSessionChannel(sessionId) → "private-session-" + id`. Use it on both sides.
2. `app/api/pusher/auth/route.ts`: POST handler that reads `socket_id` + `channel_name` from form data, requires a session, and authorizes:
   - `private-exam-*` → **teacher must own/department-share the exam** (§4 helper); a student may only subscribe if they have their own session for that exam.
   - `private-session-*` → the owning student, or a teacher who has access to that exam.
   - Return `pusherServer.authorizeChannel(socketId, channel)`, `403` otherwise, `401` when unauthenticated.
3. `app/lib/pusher-client.ts`: add `channelAuthorization: { endpoint: "/api/pusher/auth", transport: "ajax" }`.
4. `app/lib/pusher-server.ts`: export `isPusherConfigured` (`Boolean(appId && key && secret)`); skip broadcasts when false; the auth route returns `503` when false. Do not fall back to `"dummy"` credentials silently.

### 8.2 `startExamSession` is an unprotected public action (IDOR)

`app/actions/exam.ts` → `startExamSession` only checks `session.user.role === "STUDENT"`. `app/student/exams/[id]/page.tsx` performs the `published` + batch-membership checks, but the action itself is callable directly with any exam UUID: a student from another batch can start (and later answer) an exam, including unpublished ones and outside the time window.

**Fix:** call `assertStudentExamAccess(examId, studentId)` inside the action (§4). Preserve this edge case: if a session is already `STARTED` and the window has since closed, finalize it as `FORCE_SUBMITTED` (with grading) instead of throwing — never strand a student with an un-submittable session.

Also: assign `order` on insert. `uploadQuestions` currently writes `order: 0` for every question, so `orderBy: { order: "asc" }` is meaningless; compute the next order after the current max.

### 8.3 `saveSubmission` accepts anything

Same file. It upserts `{sessionId, questionId}` **without checking that the question belongs to the exam**, without checking the payload matches the question type (an MCQ answer can be stored against a CODING question and vice-versa), without checking `mcqAnswer` is one of the option keys actually issued for that question, without a size cap, and without checking `now >= startTime`.

**Fix:** validate with `saveSubmissionSchema`; then load the session *joined to the exam and the single requested question*; assert membership, question-in-exam, type match, option-key membership (use the `optionsMapping` issued at start when option shuffling is enabled); enforce `now <= endTime` and the duration + 1-minute grace rule (finalize as `FORCE_SUBMITTED` when elapsed). Update `lastHeartbeatAt` in the same transaction as the upsert (autosaves double as a liveness signal).

### 8.4 `updateQuestion` / `removeQuestionFromExam` don't verify question↔exam membership

Both currently authorize the *exam* only, then mutate by `questionId` alone: a teacher could pass an exam they own plus a `questionId` from a colleague's exam and edit or unlink it. **Fix:** require the `ExamQuestion` row to exist for `(examId, questionId)` first.

### 8.5 Certificate forgery (IDOR) and race-prone numbering

`app/actions/certificate.ts` → `issueCertificate(examId, studentId)` is a `"use server"` export that only asserts `if (!session) throw new Error("Unauthorized")` and then reads `where: { studentId_examId: { studentId, examId } }` **from its own parameters**. Any logged-in student can mint a certificate for themselves or for any other student id.

Numbering is also unsafe: `const count = await prisma.certificate.count(); certificateId = \`SA-${year}-${count + 1}\`` — two concurrent submissions collide on the unique index (or duplicate if it were absent). `verificationCode` uses `Math.random()`.

**Fix:**
1. Move issuance to `lib/certificates/issue.ts` (plain module, **not** `"use server"`): `issueCertificateInternal(examId, studentId)` with the score/pass/grade logic. Prefer the denormalized `maxScore`/`totalScore`/`percentage` and fall back to recomputation for legacy rows.
2. Keep the public action thin: `requireTeacher()` + `assertExamAccess(examId, teacher)` + delegate.
3. `submitExam` calls `issueCertificateInternal` directly (it is already trusted server code) — never re-export an internal as an action.
4. Number from `nextval('"CertificateNumber_seq"')`; generate `verificationCode` with `crypto.randomBytes(5).toString("hex").toUpperCase()`. Wrap `create` in try/catch and return the existing row if another writer won the race.
5. `getCertificate(examId, studentId)` currently has **no auth at all** — it returns any student's certificate (with name + PRN) to any caller. Require a session; students may only read their own; teachers must own the exam.

### 8.6 Answer key leaks the moment a student submits

`app/student/exams/[id]/result/page.tsx` renders `q.correctAnswer` immediately after submission, and passes `exam.questions` (which include `correctAnswer`, `testCases`) into the client component `StudentResultExporter`. During a live exam, a student who finishes early can share the key with classmates still writing.

**Fix:** gate on the exam's policy — `NEVER`, `AFTER_EXAM_END` (`now > exam.endTime`), `AFTER_RELEASE` (`exam.resultsReleasedAt` set and passed), `IMMEDIATELY` — default `AFTER_EXAM_END` (§7.2). When the key is not available, show a neutral message ("Your answer is recorded; the correct option will be shown once the exam window closes."). Pass the exporter a sanitized shape (`questionId`, `content`, `type` only) — never raw `Question` rows containing `correctAnswer`.

### 8.7 Grading blocks the request and is serial

`app/actions/exam.ts` → `submitExam` grades in a `for` loop, and `evaluateCode` (`app/actions/judge0.ts`) issues one awaited HTTP call **per test case**. A 40-question coding exam × 5 cases = 200 sequential round trips inside a request that must complete before the browser can navigate. On Vercel this hits the function timeout and leaves the session `STARTED` with ungraded rows.

**Fix (in-scope version):** grade MCQ inline; grade coding with a **bounded concurrency pool (3–5)**; wrap each evaluation in try/catch and treat failures as 0 points rather than aborting the whole submission; persist per-submission `isCorrect`/`pointsAwarded` in batches of ~10; then persist `totalScore`, `maxScore`, `percentage`, `violationCount`, `riskScore`, `submittedAt`, `status`. Also implement **negative marking** when `exam.negativeMarking > 0` (apply only to attempted-but-wrong answers) and clamp the total at ≥ 0.

Bonus if time permits (otherwise leave for Sprint 4): move grading to a queue/`GradingJob` table with a cron worker and a "Grading in progress" state in the UI.

**Also fix here:** `revalidatePath("/teacher/exams/[id]/results", "page")` is a **no-op** — the literal segment never matches a real path. Revalidate the concrete paths for that exam (`/teacher/exams/${examId}/results`, `/student`, `/student/exams/${examId}/result`, `/teacher/exams/${examId}/live`).

### 8.8 `evaluateCode` is exported from a `"use server"` module

`app/actions/judge0.ts` exports `evaluateCode(code, language, testCases)` → publicly callable, accepts arbitrary test cases. **Fix:** split into `lib/judge0/client.ts` (transport: URL/key/host/token, `LANGUAGE_MAP`, execution limits, `executeOnJudge0`) and `lib/judge0/evaluate.ts` (grading loop). Keep `app/actions/judge0.ts` exporting only `runCode` (validated + rate-limited). Add Judge0 execution ceilings to every request: `cpu_time_limit: 5`, `wall_time_limit: 10`, `memory_limit: 256000`, `max_file_size: 1024`, `enable_network: false`. Support self-hosted Judge0 via `JUDGE0_API_HOST` + `JUDGE0_AUTH_TOKEN` (`X-Auth-Token`), falling back to RapidAPI headers otherwise.

### 8.9 Teacher sign-up has a hard-coded fallback secret

`app/actions/auth.ts`: `const requiredInviteCode = process.env.TEACHER_SIGNUP_CODE || "SMART_TEACHER_2026";` — a public string in the repo that grants teacher accounts on any deployment where the env var is unset. **Fix:** fail closed (return "Teacher registration is currently disabled" + `console.error`) when neither `TEACHER_EMAIL_DOMAIN` nor `TEACHER_SIGNUP_CODE` is configured; compare against the env value only. Raise the minimum password length to 8 in the schema **and** in `app/signup/page.tsx` (currently 6).

### 8.10 `app/db.ts` boots production against a dummy database

If `DATABASE_URL` is missing the module silently falls back to `postgresql://postgres:postgres@localhost:5432/postgres`, so a misconfigured deploy starts successfully and fails confusingly on the first query. It also logs `["query"]` (every SQL statement) for the Prisma-Postgres branch. **Fix:** throw at module init when `DATABASE_URL` is missing in a production runtime (allow the dummy only for `NODE_ENV=development` / `NEXT_PHASE=phase-production-build`); log `["warn","error"]` in development and `["error"]` in production. Keep the pg `Pool` limits as they are and keep the global singleton.

### 8.11 Delete `/api/debug-ai`

`app/api/debug-ai/route.ts` returns `env_check: apiKey.substring(0,5) + "****"`, upstream error bodies, and the probed model name, with no rate limit. Delete the route (do not gate it behind an env flag — nothing in the app calls it).

### 8.12 Live dashboard re-subscribes on every event

`app/teacher/exams/[id]/live/live-dashboard.tsx`: `useEffect(..., [examId, sessions, addAlert])` — `sessions` changes on every Pusher event, so the channel is unsubscribed and re-subscribed continuously (dropped events, churn) and the `student-submitted` handler closes over stale state. It also hardcodes `status: "COMPLETED"`, discarding the server's `FORCE_SUBMITTED`.

**Fix:** keep a `sessionsRef` updated in its own effect for reads inside handlers; depend only on `[examId, addAlert]`; always use the functional `setSessions(prev => …)` form; honour `data.status`; keep the duplicate-IP warning (it may move to a server-side check later, but do not delete it).

### 8.13 Timezone bug: server components render UTC to IST users

`new Date(x).toLocaleString()` / `toLocaleDateString()` are called **inside server components** — `app/teacher/exams/page.tsx` (start/end times) and `app/teacher/exams/[id]/page.tsx` ("Starts:"). Vercel renders UTC, so every exam time is wrong for Indian users. `app/teacher/exams/[id]/results/page.tsx` has the same issue for "Last Update".

**Fix:** add a client `LocalTime` component (mode `time` | `date` | `datetime`, optional `className`). Use `useSyncExternalStore` with a server snapshot of `false` and a client snapshot of `true` to render a placeholder during SSR and the localized string after hydration — this avoids both the hydration mismatch **and** the `react-hooks/set-state-in-effect` lint rule that rejects the naive `useEffect` + `setState` version. Use it in the three files above. (Note `app/student/local-time.tsx` already exists for the same purpose; unify on one component.)

### 8.14 Small but real

- `duplicateExam` copies `published` — a duplicate of a published exam goes live instantly. Force `published: false` + `status: "DRAFT"` on the copy.
- `publishExam` should stamp a human-joinable `examCode` when absent and compute `status` via the shared helper (next item).
- Extract `resolveExamStatus(exam, now)` into `lib/exams/status.ts` (DRAFT takes precedence; ARCHIVED is terminal; otherwise compare timestamps) and use it in `app/teacher/exams/page.tsx` and `app/teacher/exams/[id]/page.tsx` instead of re-deriving `isDraft/isUpcoming/isExpired` inline. The same helper must drive any status badge so the three copies of this logic collapse into one.
- `app/teacher/exams/[id]/live/page.tsx`, `results/page.tsx` and others embed `include: { …, take: undefined }` semantics — add explicit `take` caps (200) to every `findMany` on sessions/submissions/questions.
- Remove `console.log` noise; keep `console.error` for genuine failures (the "Auto-certificate issuance skipped" log is intentional and should stay, but should use `console.info`).

---

## 9. Workstream 6 — Proctoring event trail + heartbeat

### What is wrong today

`logTabSwitch` increments one integer and sets `isBlurred`. There is no record of *what* happened, *when*, or *how often*; the threshold `3` is hard-coded; there is no liveness signal (so "idle" and "closed the laptop" look identical); and nothing else (clipboard, devtools, duplicate tabs, IP collisions) is recorded beyond a toast message.

### What to build

1. `logProctorEvent({ sessionId, type, metadata })` — validates with `proctorEventSchema`, rate-limits, verifies the session belongs to the caller and is `STARTED`, then in one transaction increments `tabSwitches` + `violationCount` (only for `TAB_BLUR` / `FULLSCREEN_EXIT`), sets `isBlurred`, bumps `lastHeartbeatAt`, and writes a `ProctorEvent` row with a `severity`. Afterwards recompute `riskScore` from a `groupBy(type)` over the session's events and store it. Broadcast on the private exam channel.
2. Keep `logTabSwitch(sessionId)` as a thin wrapper → `logProctorEvent({ type: "TAB_BLUR" })` so nothing breaks.
3. Read the threshold from `Exam.proctoring.maxTabSwitches` (default 3) via a `readProctoringSettings(raw)` helper that also defaults `blockClipboard`/`requireFullscreen` to `true`. When the threshold is reached, force-submit through the same `finalizeSession` path and return `{ ...session, status: "FORCE_SUBMITTED" }`.
4. `heartbeat(sessionId)` action (student-owned, `STARTED` only, `updateMany` so a finished session is a no-op) updating `lastHeartbeatAt`.
5. `lib/exams/status.ts`: `computeRiskScore(counts)` — weighted, capped at 100, explainable (TAB_BLUR 20, FULLSCREEN_EXIT 20, CLIPBOARD_ATTEMPT 10, DEVTOOLS_ATTEMPT 30, DUPLICATE_TAB 15, IP_COLLISION 15, HEARTBEAT_MISSED 5).
6. Client (`app/student/exams/[id]/exam-client.tsx`):
   - Replace the single `logTabSwitch` call with typed events: `FULLSCREEN_EXIT` when `reason === "Exited Fullscreen"`, `TAB_BLUR` for tab switch / window blur.
   - Report `CLIPBOARD_ATTEMPT` on copy/cut/paste and `DEVTOOLS_ATTEMPT` on the blocked F12 / Ctrl+Shift+I/J/C shortcuts — **throttled to one event per 10 s per type**, otherwise a user mashing Ctrl+C floods the audit table.
   - Send a heartbeat every 20 s; the returned server time can be used to correct client-side clock drift (the exam timer currently trusts `exam.endTime` and the local clock).
   - Use `void action(...).catch(() => undefined)` for telemetry so a failed beacon never interrupts the exam.

---

## 10. Acceptance criteria (definition of done)

A reviewer must be able to check every box by reading the diff and running the app:

**Authorization**
- [ ] No file outside `lib/auth/scope.ts` contains the `batch: { OR: [{ teacherId … department … }] }` pattern.
- [ ] A student calling `startExamSession` with an exam id from another batch, an unpublished exam, or outside the window gets an error and **no** session row is created/started.
- [ ] A student calling `saveSubmission` with a `questionId` not in their exam, with an MCQ answer for a CODING question, or with an option key that wasn't issued, gets an error and no row is written.
- [ ] `getCertificate(examId, otherStudentsId)` returns an error for a student and for an unrelated teacher.

**Validation & limits**
- [ ] `createExam` with `duration: -5`, `startTime > endTime`, or a foreign `batchId` fails with a readable message.
- [ ] `updateQuestion` with `points: -50` is rejected.
- [ ] `saveSubmission` with a 1 MB `codeAnswer` is rejected.
- [ ] 21 AI generations in an hour → the 21st returns a rate-limit error; 6 sign-ups from one IP in an hour → the 6th is rejected.
- [ ] `/api/debug-ai` returns 404 (route deleted).

**Data & performance**
- [ ] `npx prisma migrate deploy` applies cleanly on a database **seeded with old data**, and the backfill leaves `percentage` consistent with `SUM(pointsAwarded) / SUM(points)`.
- [ ] `EXPLAIN ANALYZE SELECT * FROM "StudentExamSession" WHERE "examId" = '…' ORDER BY "percentage" DESC;` uses an index scan, not a sequential scan.
- [ ] `submitExam` writes non-zero `totalScore`/`maxScore`/`percentage`/`submittedAt` for a completed session; a session that fails mid-grading is never left `STARTED` without grades.

**Security**
- [ ] Subscribing to `exam-<id>` (non-private) is no longer possible; `private-exam-<id>` returns 403 for a student who isn't in that exam and for a teacher who doesn't own it; the auth route returns 401 unauthenticated and 503 when Pusher is unconfigured.
- [ ] `issueCertificate` called by a student, or by a teacher for an exam they don't own, throws; two concurrent submissions produce **two distinct** certificate ids.
- [ ] The student result page does not contain `correctAnswer` (or the answer key in any form) in its HTML/payload before the exam window closes.

**Behaviour preserved**
- [ ] Teacher: create exam → bulk upload → publish → live monitor → results → export still works.
- [ ] Student: dashboard → start exam → fullscreen gate → answer MCQ + run code → tab-switch warning → submit → result page → certificate download still works.
- [ ] A duplicate of a published exam starts unpublished.
- [ ] Teacher pages show correct local (IST) times.

**Quality gates**
- [ ] `npm run type-check` → no errors. `npm run lint` → 0 errors. `npm run build` → succeeds.
- [ ] No new `any`, no `@ts-ignore` without an explanatory comment, no `console.log` in new code.
- [ ] JSDoc on every exported action and helper.

---

## 11. Verification commands

```bash
npm install                     # also runs prisma generate (postinstall)

cp .env.example .env            # if you add one; otherwise ensure .env exists
npx prisma validate
npx prisma format
npx prisma migrate dev --name filtering_foundation   # generates SQL; commit it
npx prisma migrate status
npx prisma db seed                                   # teacher@test.com / teacher123, student@test.com / student123

npm run type-check && npm run lint && npm run build
npm run dev                     # manual smoke test of the two flows in §10
```

**If `prisma generate` fails** with a network error to `binaries.prisma.sh`, your machine/CI cannot download Prisma engines — that's an environment problem, not a code problem. Workarounds: allow that host, set `PRISMA_ENGINES_MIRROR`, or run the install on a network that permits it. Do **not** hand-write Prisma types to work around it.

---

## 12. Environment variables (add to `.env` and document in `README.md`)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres (Neon/Supabase/local). |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | yes | Session signing. |
| `TEACHER_SIGNUP_CODE` | yes for invite-based teacher signup | **No fallback exists any more**; signup for teachers is disabled without this or `TEACHER_EMAIL_DOMAIN`. |
| `TEACHER_EMAIL_DOMAIN` | optional | Comma-separated institutional domains allowed to self-register. |
| `PUSHER_APP_ID`, `PUSHER_SECRET`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` | for realtime | Server skips broadcasts when unset; auth route returns 503. |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | for AI | Model defaults to `openrouter/auto`. |
| `JUDGE0_API_KEY`, `JUDGE0_API_URL`, `JUDGE0_API_HOST`, `JUDGE0_AUTH_TOKEN` | for code execution | `X-Auth-Token` for self-hosted, RapidAPI headers otherwise. |
| `NEXT_PUBLIC_APP_URL` | optional | Replaces a hard-coded `http://localhost:3000` referer. |

Add `.env.example` with dummy values (`.env*` is gitignored — add a `!.env.example` negation to `.gitignore`). **Never commit real secrets.**

---

## 13. Out of scope for this sprint (do not start)

Search/filter/sort/pagination, facets, saved views, DataTable/FilterBar UI; item analysis or discrimination metrics; manual grading queue; regrade workflow; email notifications; calendar/ICS; plagiarism or collusion detection; async grading queue; Playwright/Vitest suites; CI migration step; dark mode; admin/invigilator roles; `xlsx` and `next-auth` dependency migrations. These are specified in `docs/UPGRADE_PLAN_AND_FILTERING.md` (Sprints 2–4).

If you find something P0 while working that isn't listed here, **fix it and call it out explicitly in the PR description** rather than silently expanding scope.

---

## 14. Deliverables

1. One commit per workstream, imperative subject lines, body explaining *what was wrong* and *what changed* (e.g. `security: verify exam membership inside startExamSession`).
2. A PR description containing: the workstream table with ✅/❌, the acceptance checklist from §10 with evidence (command output, `EXPLAIN` output, screenshots of the two smoke flows), the applied migration name, and any deviation from this brief with justification.
3. The migration SQL committed and **never edited after being applied**.
4. A short "Reviewer notes" section listing the exact 3 files a human should read first.

---

*Sprint 1 brief — SmartAssess v2. Companion analysis: `docs/UPGRADE_PLAN_AND_FILTERING.md`.*
