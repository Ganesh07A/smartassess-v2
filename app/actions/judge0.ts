"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const JUDGE0_API_URL = process.env.JUDGE0_API_URL || "https://judge0-ce.p.rapidapi.com";
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY;

const LANGUAGE_MAP: Record<string, number> = {
  "python": 71,
  "c": 50,
  "cpp": 54,
  "java": 62,
  "javascript": 63,
};

export async function runCode(code: string, language: string, stdin?: string) {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new Error("Unauthorized");
  }

  const languageId = LANGUAGE_MAP[language.toLowerCase()];
  if (!languageId) {
    throw new Error(`Unsupported language: ${language}`);
  }

  if (!JUDGE0_API_KEY) {
    // Mock response if no API key is provided
    console.warn("JUDGE0_API_KEY is not set. Returning mock response.");
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      stdout: "Mock Output: Hello World\n(Please set JUDGE0_API_KEY in .env to use real execution)",
      stderr: null,
      compile_output: null,
      message: null,
      status: { id: 3, description: "Accepted" },
      time: "0.001",
      memory: 100
    };
  }

  try {
    const response = await fetch(`${JUDGE0_API_URL}/submissions?wait=true&base64_encoded=false`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": JUDGE0_API_KEY,
        "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
      },
      body: JSON.stringify({
        source_code: code,
        language_id: languageId,
        stdin: stdin || "",
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to execute code");
    }

    return await response.json();
  } catch (error: any) {
    console.error("Judge0 Error:", error);
    throw new Error(error.message || "Code execution failed");
  }
}

export async function evaluateCode(code: string, language: string, testCases: { input: string; output: string }[]) {
  let passedCount = 0;
  
  if (!testCases || testCases.length === 0) {
    return { passed: 0, total: 0, isCorrect: true };
  }

  for (const tc of testCases) {
    try {
      const result = await runCode(code, language, tc.input);
      // Status 3 is "Accepted"
      if (result.status?.id === 3 && result.stdout?.trim() === tc.output.trim()) {
        passedCount++;
      }
    } catch (err) {
      console.error(`Error evaluating test case:`, err);
    }
  }

  return {
    passed: passedCount,
    total: testCases.length,
    isCorrect: passedCount === testCases.length
  };
}
