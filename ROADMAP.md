Here is the detailed roadmap based on the Feature-Driven (Vertical Slices) approach.

  SmartAssess Development Roadmap

  Background & Motivation
  SmartAssess is an AI-powered examination platform designed for MCQs and coding problems, enforcing strict CET-style anti-cheat measures. A solid roadmap
  is essential to ensure that features are built in a logical order, prioritizing core infrastructure before advanced real-time features.

  Scope & Impact
  This roadmap covers the end-to-end development of the platform, structured in vertical slices (feature by feature). We will start from foundational setup
  (Auth and Base Schema) and work our way up to complex real-time anti-cheat mechanisms.

  Proposed Solution
  We will follow a Feature-Driven (Vertical Slice) approach. This means we will build each major feature from the database layer up to the frontend UI,
  allowing us to have functional parts of the app earlier in the process.

  Alternatives Considered
   - Horizontal Slices (Layer-Driven): Building all schemas, then all actions, then all UI. Rejected in favor of vertical slicing to deliver functional
     end-to-end features sooner.

  Implementation Plan (Chronological)

  Phase 1: Foundation, Auth & Base Schema (Start Here)
   1. Initial Setup: Configure Next.js, Tailwind CSS, Prisma, and PostgreSQL.
   2. Database Schema Setup: Define core models (User, Exam, Question, Batch, etc.) in schema.prisma.
   3. Authentication: Implement NextAuth.js (Auth.js) with Role-Based Access Control (RBAC) distinguishing between Teacher and Student.
   4. Base UI Layouts: Create the shared layout, login page, and protected route wrappers.

  Phase 2: Teacher Dashboard (Exam & Question Management)
   1. Teacher Layout & Nav: Build the specific dashboard layout for teachers.
   2. Batch & Exam Creation: Server actions and forms to create/manage student batches and configure new exams.
   3. Question Bank Management: UI and server actions to add, edit, and delete MCQs and coding problems for specific exams.
   4. Exam Analytics (Basic): Outline the dashboard view to eventually show percentiles and top scorers.

  Phase 3: Student Exam Environment (Completed)
   1. Secure Exam Layout: Build a full-screen, CET-style UI header (Photo, Name, PRN). (Done)
   2. Exam Session Initialization: Logic to shuffle questions on start and save the state persistently to StudentExamSession to prevent refresh exploits. (Done)
   3. Question Interfaces: (Done)
      - MCQ Interface (selection, navigation).
      - Coding Interface (integration with Judge0 API via backend for code execution).
   4. Exam Submission: Server actions to securely submit answers, calculate scores, and mark the exam as completed. (Done)

  Phase 4: Anti-Cheat & Real-time Features (Completed)
   1. Real-time Infrastructure: Integrate Pusher into the project. (Done)
   2. Student Side Anti-Cheat:
      - Implement tab-switch tracking (visibility change events). (Done)
      - Implement full-screen exit detection (blurring screen, hiding questions). (Done)
   3. Teacher Live Monitoring:
      - Dashboard UI listening to Pusher events to track active students and live tab-switch warnings. (Done)
      - Force-submit command via Pusher from teacher to specific students. (Planned/Optional)

  Phase 5: Polish, Analytics, & Exports (Current)
   1. Advanced Analytics: Finalize the teacher dashboard analytics (question difficulty metrics).
   2. Exports: Implement xlsx and jspdf generation for student reports.
   3. Final Testing: Thorough end-to-end testing of the full flow.

  Verification
   - Each phase will be tested before moving to the next.
   - Unit and integration tests will be written for critical paths (e.g., Auth, scoring logic).
   - Manual QA of the anti-cheat mechanisms across different browsers.

  Migration & Rollback
   - Database migrations will be handled iteratively via Prisma.
   - If a phase fails verification, we will roll back the Prisma migrations and git commits related to that specific vertical slice.

  Please review this detailed plan. Does this look good, or are there any adjustments you'd like to make before we finalize it?