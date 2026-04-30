# SmartAssess Platform
- Goal: A secure, CET-style AI-powered examination platform for MCQs and coding problems.

## Tech Stack & Libraries
- Core: Next.js (App Router), React, Tailwind CSS, TypeScript.
- Database: PostgreSQL, Prisma ORM.
- Authentication: NextAuth.js (Auth.js) for strict session control and role-based access.
- Real-time: Pusher (for live teacher monitoring, cheat alerts, and force-submit commands).
- Code Evaluation: Judge0 API (executed strictly on the backend).
- Exports: `xlsx` (Excel) and `jspdf` (PDF).

## Architecture Rules
- Next.js: Use React Server Components (RSC) for data fetching. Use Server Actions for database mutations. No separate Express backend.
- API Design: Return standard JSON responses. Handle all errors gracefully with try/catch.
- Security: User roles (Teacher vs. Student) must be verified on every protected route and Server Action.

## Core Features & Logic
1. Teacher Dashboard:
   - Exam creation with specific batch allocation.
   - Live dashboard: Pusher integration to see active students, live submissions, and instant tab-switch warnings.
   - Analytics: Percentiles, top scorers, question difficulty metrics. Exportable reports.
2. Student Dashboard:
   - Secure environment: Full-screen CET-style UI (Photo, Name, PRN in header).
   - Anti-Cheat: 
     - Tab-switch tracking with auto-submit at a defined limit.
     - Full-screen exit blurs the screen and hides questions (timer continues running in the background).
   - Question Randomization: Questions are shuffled upon exam start and saved persistently in a `StudentExamSession` database table to prevent refresh exploits.


## Documentation Rules
- All critical functions and Server Actions must include JSDoc comments.
- Keep the code self-documenting by using highly descriptive, verb-first variable and function names.