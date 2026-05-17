
"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";

async function callOpenRouter(messages: { role: string; content: string }[], jsonMode: boolean = false) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("AI Configuration missing (OPENROUTER_API_KEY)");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "SmartAssess",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openrouter/auto",
      messages: messages,
      // Note: Not all free models support strict JSON mode, so we rely on prompting + parsing
      response_format: jsonMode ? { type: "json_object" } : undefined,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("OpenRouter API Error:", errorData);
    throw new Error(errorData.error?.message || `OpenRouter API request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export async function generateAIQuestions(prompt: string, count: number = 5) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "TEACHER") {
      throw new Error("Unauthorized: Please log in as a teacher.");
    }

    return await generateAIQuestionsInternal(prompt, count);
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Critical AI Action Error:", err);
    throw new Error(err.message || "An unexpected error occurred while generating questions.");
  }
}

export async function generateAIQuestionsInternal(prompt: string, count: number = 5) {
  const systemPrompt = `
    You are an expert examiner. Your task is to generate EXACTLY ${count} multiple-choice questions (MCQs) based on the provided text.
    
    CRITICAL RULES:
    1. You MUST generate exactly ${count} questions. No more, no less.
    2. Return the result ONLY as a valid JSON array of objects.
    3. Each object must follow this structure:
    {
      "type": "MCQ",
      "content": "The question text",
      "options": {
        "A": "Option 1",
        "B": "Option 2",
        "C": "Option 3",
        "D": "Option 4"
      },
      "correctAnswer": "A",
      "points": 1
    }
    
    4. Ensure the questions are technically accurate and challenging.
    5. Provide 4 distinct options for each question.
    6. The correctAnswer must be one of "A", "B", "C", or "D".
    7. Return ONLY the raw JSON array. Do not include markdown code blocks, explanations, or any other text.
  `;

  try {
    const text = await callOpenRouter([
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt }
    ], true);
    
    try {
      // Try parsing directly
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'object' && parsed !== null) {
        // If it's a single object, wrap it in an array
        return [parsed];
      }
      throw new Error("AI did not return a valid list of questions.");
    } catch {
      // Fallback: try extraction if the model added markdown or extra text
      const startIndex = text.indexOf("[");
      const endIndex = text.lastIndexOf("]") + 1;
      
      if (startIndex !== -1 && endIndex > startIndex) {
        const jsonString = text.substring(startIndex, endIndex);
        try {
          const parsed = JSON.parse(jsonString);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          console.error("AI JSON Parse Error. Response was:", text);
          throw new Error("The AI generated an invalid question set. Please try again.");
        }
      }
      
      console.error("AI Response did not contain a valid JSON array:", text);
      throw new Error("AI returned an invalid format. Please try again.");
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error("AI Generation Error Details:", err);
    
    if (err?.message?.includes("API_KEY")) {
      throw new Error("AI service is not configured (Missing OpenRouter API Key).");
    }
    
    throw new Error(err.message || "Failed to generate questions. Please try again with a clearer prompt.");
  }
}

/**
 * Provides AI-powered feedback on a student's coding submission.
 */
export async function explainCodeSubmission(
  questionContent: string, 
  code: string, 
  pointsAwarded: number, 
  totalPoints: number
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Unauthorized");
  }

  const prompt = `
    You are an expert programming tutor. A student has submitted code for a coding problem.
    Problem: ${questionContent}
    Student's Submission:
    \`\`\`
    ${code}
    \`\`\`
    Score: ${pointsAwarded} / ${totalPoints}

    Provide a concise, encouraging, and highly technical feedback.
    Identify:
    1. What they did well.
    2. Where they might have failed or could improve (logic errors, edge cases, time complexity).
    3. Specific advice to improve their code.
    
    If the score is full, praise their efficiency and suggest alternative approaches or more idiomatic code.
    If the score is low, guide them towards the correct logic without just giving the full solution immediately.
    Keep the tone professional and helpful. Use Markdown for formatting. Use about 150-200 words.
  `;

  try {
    return await callOpenRouter([
      { role: "system", content: "You are a helpful and technical programming tutor." },
      { role: "user", content: prompt }
    ]);
  } catch (error) {
    console.error("AI Explanation Error:", error);
    throw new Error("Failed to generate AI feedback.");
  }
}
