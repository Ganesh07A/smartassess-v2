import "server-only";

/**
 * Low-level Judge0 transport. Kept out of the `"use server"` action module on purpose: every
 * export of a `"use server"` file becomes a publicly callable endpoint, and the grading loop must
 * not be reachable directly by a client.
 */

const JUDGE0_API_URL = process.env.JUDGE0_API_URL || "https://judge0-ce.p.rapidapi.com";
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY;
const JUDGE0_API_HOST = process.env.JUDGE0_API_HOST || "judge0-ce.p.rapidapi.com";
/** Set when running a self-hosted Judge0 instance (RapidAPI is used only for the RapidAPI host). */
const JUDGE0_AUTH_TOKEN = process.env.JUDGE0_AUTH_TOKEN;

export const LANGUAGE_MAP: Record<string, number> = {
  python: 71,
  c: 50,
  cpp: 54,
  java: 62,
  javascript: 63,
};

/** Execution ceilings so a submission cannot pin the runner or exhaust the quota. */
export const EXECUTION_LIMITS = {
  cpu_time_limit: 5,
  wall_time_limit: 10,
  memory_limit: 256_000, // KB
  max_file_size: 1024, // KB of source code
  max_processes_and_or_threads: 60,
  enable_network: false,
};

export interface Judge0Result {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  status: { id: number; description: string } | null;
  time: string | null;
  memory: number | null;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!JUDGE0_API_KEY) return headers;

  if (JUDGE0_AUTH_TOKEN || !JUDGE0_API_HOST.endsWith("rapidapi.com")) {
    headers["X-Auth-Token"] = JUDGE0_AUTH_TOKEN || JUDGE0_API_KEY;
  } else {
    headers["X-RapidAPI-Key"] = JUDGE0_API_KEY;
    headers["X-RapidAPI-Host"] = JUDGE0_API_HOST;
  }
  return headers;
}

export async function executeOnJudge0(input: {
  code: string;
  language: string;
  stdin?: string;
}): Promise<Judge0Result> {
  const languageId = LANGUAGE_MAP[input.language];
  if (!languageId) {
    throw new Error(`Unsupported language: ${input.language}`);
  }

  if (!JUDGE0_API_KEY) {
    // Mock response if no API key is provided
    console.warn("JUDGE0_API_KEY is not set. Returning mock response.");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      stdout: "Mock Output: Hello World\n(Please set JUDGE0_API_KEY in .env to use real execution)",
      stderr: null,
      compile_output: null,
      message: null,
      status: { id: 3, description: "Accepted" },
      time: "0.001",
      memory: 100,
    };
  }

  try {
    const response = await fetch(`${JUDGE0_API_URL}/submissions?wait=true&base64_encoded=false`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({
        source_code: input.code,
        language_id: languageId,
        stdin: input.stdin || "",
        ...EXECUTION_LIMITS,
      }),
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(error.message || "Failed to execute code");
    }

    return (await response.json()) as Judge0Result;
  } catch (error) {
    console.error("Judge0 Error:", error);
    throw new Error(error instanceof Error ? error.message : "Code execution failed");
  }
}
