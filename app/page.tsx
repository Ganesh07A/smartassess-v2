import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { redirect } from "next/navigation";
import { Hero } from "@/sections/Hero";
import { SocialProof } from "@/sections/SocialProof";
import { FeatureMini } from "@/sections/FeatureMini";
import { SplitSection } from "@/sections/SplitSection";
import CodeEditor from "@/sections/CodeEditor";
import { DarkShowcase } from "@/sections/DarkShowcase";
import { FinalCTA } from "@/sections/FinalCTA";
import { TrustSection } from "@/sections/TrustSection";

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
    <div className="bg-white min-h-screen flex flex-col selection:bg-green-100 selection:text-green-900 font-sans">
      <main className="flex-grow">
        <Hero />
        <SocialProof />
        <TrustSection />
        <SplitSection 
          title="Master Concepts Visually"
          description="Stop reading elements of code, algorithms and programs flows. Interactive graphs make learning intuitive and engaging before you ever write a line of code."
          visual={<div className="h-64 bg-gray-100 rounded-xl flex items-center justify-center">Interactive Graph Demo</div>}
        />
        <SplitSection 
          title="Real-time Code Execution"
          description="Write, run, and test code securely. Our in-browser editor supports multiple languages and provides immediate feedback on your solutions."
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
