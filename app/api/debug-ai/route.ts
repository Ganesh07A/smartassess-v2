
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  
  // Strict security check
  if (!session || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENROUTER_API_KEY missing in production environment" }, { status: 500 });
  }

  const modelName = "inclusionai/ring-2.6-1t:free";
  const result: any = {};

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: "user", content: "test" }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      result[modelName] = { 
        status: "failed", 
        message: errorData.error?.message || `HTTP ${response.status}`,
        details: errorData
      };
    } else {
      const data = await response.json();
      result[modelName] = { 
        status: "success", 
        text: data.choices[0].message.content.substring(0, 50) + "..." 
      };
    }
  } catch (err: any) {
    result[modelName] = { 
      status: "error", 
      message: err.message
    };
  }

  return NextResponse.json({
    message: "OpenRouter Model Diagnostic",
    env_check: apiKey.substring(0, 5) + "****",
    results: result
  });
}
