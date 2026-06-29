# 🚀 SmartAssess v2

<div align="center">
  <img src="public/smartassess-logo.png" alt="SmartAssess Logo" width="200" height="200">
  
  **The Next-Generation Intelligent Assessment & Remote Code Evaluation Platform**
  
  [![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat&logo=next.js)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat&logo=prisma)](https://www.prisma.io/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?style=flat&logo=postgresql)](https://www.postgresql.org/)
  [![Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini-FF6F00?style=flat&logo=google)](https://deepmind.google/technologies/gemini/)
  [![Pusher](https://img.shields.io/badge/Pusher-WebSockets-300D4F?style=flat)](https://pusher.com/)
  [![Judge0](https://img.shields.io/badge/Judge0-Code%20Execution-00599C?style=flat)](https://judge0.com/)
</div>

---

## 📖 Table of Contents
- [Overview](#-overview)
- [Core Features](#-core-features)
  - [Teacher Portal](#-teacher-portal)
  - [Student Portal](#-student-portal)
- [Tech Stack](#-tech-stack)
- [Project Architecture](#-project-architecture)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
- [Folder Structure](#-folder-structure)
- [Contributing](#-contributing)
- [License](#-license)
- [Contact](#-contact)

---

## 📖 Overview

**SmartAssess v2** is a comprehensive, full-stack educational platform engineered to handle complex assessment workflows. Moving beyond simple multiple-choice quizzes, SmartAssess v2 integrates live proctoring, agentic AI for deep result explanations, and secure remote code execution for competitive programming and technical interviews.

The platform is divided into robust portals tailored for both educators and students, ensuring a seamless, scalable, and highly interactive evaluation experience.

---

## ✨ Core Features

### 👨‍🏫 Teacher Portal (`/teacher`)
* **Intelligent Exam Creator:** Build dynamic exams using manual entry, bulk CSV uploads, or **AI-generated questions** tailored to specific topics and difficulty levels.
* **Batch & Cohort Management:** Organize students into distinct batches, making it easy to deploy exams to targeted groups.
* **Live Proctoring Dashboard:** Monitor active test-takers in real-time. Utilizing WebSockets (via Pusher), teachers can see live progress, connection statuses, and potential anomalies.
* **Deep Analytics & Exports:** Review comprehensive performance metrics and easily export exam results for institutional record-keeping.
* **Option Shuffling & Integrity:** Built-in randomization algorithms ensure no two students get the exact same exam layout.

### 🎓 Student Portal (`/student`)
* **Secure Assessment Environment:** A clean, distraction-free interface for taking timed assessments with live local-time synchronization.
* **Integrated Code Editor:** Tackle algorithmic challenges directly in the browser. Code is compiled, run, and evaluated securely in real-time via Judge0.
* **AI Result Explainer:** Instead of just a pass/fail grade, students receive personalized, AI-driven feedback explaining *why* an answer was incorrect and how to improve.
* **Automated Certification:** Upon successful completion of benchmark exams, customized certificates are dynamically generated and made available for download.

---

## 🛠️ Tech Stack

### Frontend
* **Framework:** [Next.js (App Router)](https://nextjs.org/)
* **Language:** [TypeScript](https://www.typescriptlang.org/)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/) & PostCSS
* **Components:** Custom UI components leveraging modern React hooks.

### Backend & Database
* **Database:** [PostgreSQL](https://www.postgresql.org/)
* **ORM:** [Prisma](https://www.prisma.io/) (Type-safe database access and migrations)
* **Authentication:** [NextAuth.js](https://next-auth.js.org/) (Secure session management)
* **Server Actions:** Next.js Server Actions for seamless, zero-API-route data mutations.

### Integrations & Services
* **AI Orchestration:** Google Gemini API for agentic workflows (Question generation & Result Explanations).
* **Code Execution:** [Judge0 API](https://judge0.com/) for secure, sandboxed code compilation.
* **Real-Time Pub/Sub:** [Pusher](https://pusher.com/) for live exam monitoring and instant state updates.

---

## 🏗️ Project Architecture

SmartAssess relies on a heavily decoupled internal structure:
1. **Server Actions (`/app/actions`)**: Handles direct database operations, AI requests, and Judge0 compilations without exposing standard REST endpoints, improving security and performance.
2. **WebSocket Syncing**: The `pusher-server.ts` broadcasts state changes (like a student starting an exam), which is picked up by `pusher-client.ts` on the teacher's Live Dashboard.
3. **AI Pipeline (`/app/actions/ai.ts` & `AGENTS.md`)**: Contextual data is fed into Gemini prompts to either generate standardized JSON question structures or plain-text student feedback.

---

## 🚀 Getting Started

Follow these steps to set up a local development environment.

### Prerequisites
* Node.js (v18.17.0 or higher)
* A running PostgreSQL database (local or cloud-hosted like Supabase/Neon)
* API keys for Google Gemini, Pusher, and a Judge0 instance.

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/Ganesh07A/smartassess-v2.git](https://github.com/Ganesh07A/smartassess-v2.git)
   cd smartassess-v2
   ```

   ### Database Configuration
 ```bash
DATABASE_URL="postgresql://user:password@localhost:5432/smartassess"
```
### NextAuth Configuration
```bash
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your_generated_secret_key" # Run `openssl rand -base64 32` to generate one
```
### Google Gemini AI
```bash
GEMINI_API_KEY="your_gemini_api_key"
```
### Pusher (Live Proctoring & Real-Time Sync)
```bash
NEXT_PUBLIC_PUSHER_APP_KEY="your_pusher_key"
PUSHER_APP_ID="your_pusher_app_id"
PUSHER_SECRET="your_pusher_secret"
PUSHER_CLUSTER="your_pusher_cluster"
```
### Judge0 (Code Execution)
```bash
JUDGE0_API_URL="your_judge0_url"

JUDGE0_API_KEY="your_judge0_api_key" (If applicable)
```

### 🤝 Contributing
- Contributions make the open-source community an amazing place to learn and build. Any contributions you make are greatly appreciated.

 - Fork the Project

 - Create your Feature Branch (git checkout -b feature/AmazingFeature)

- Commit your Changes (git commit -m 'feat: Add some AmazingFeature')

- Push to the Branch (git push origin feature/AmazingFeature)

- Open a Pull Request

