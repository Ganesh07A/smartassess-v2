import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { redirect } from "next/navigation";
import { Hero } from "@/sections/Hero";
import { FeatureMini } from "@/sections/FeatureMini";
import { SplitSection } from "@/sections/SplitSection";
import CodeEditor from "@/sections/CodeEditor";
import { DarkShowcase } from "@/sections/DarkShowcase";
import { FinalCTA } from "@/sections/FinalCTA";
import ProctoringShowcase from "@/sections/ProctoringShowcase";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    if (session.user.role === "TEACHER") {
      redirect("/teacher");
    } else {
      redirect("/student");
    }
  }

  return (
    <div className="bg-white text-gray-900 min-h-screen flex flex-col selection:bg-green-100 selection:text-green-900 font-sans">
      <main className="flex-grow">
        <Hero />
        <SplitSection 
          title="Proctored Examination Canvas"
          description="Minimize academic dishonesty with strict full-screen locks and tab-switch monitoring. SmartAssess tracks visibility loss and automatically submits the assessment when limits are breached."
          visual={<ProctoringShowcase />}
        />
        <SplitSection 
          title="Real-time Code Evaluation"
          description="Write, run, and evaluate code securely in multiple programming languages. Our built-in editor runs solutions backend-side, delivering immediate results and test-case validations."
          reverse={true}
          bg="bg-gray-50"
          visual={<CodeEditor />}
        />
        <FeatureMini />
        <DarkShowcase />
        <FinalCTA />
      </main>
    </div>
  );
}
