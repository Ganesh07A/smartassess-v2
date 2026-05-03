"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";

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
    // Throwing a clean error message that Next.js can serialize to the client
    throw new Error(err.message || "An unexpected error occurred while generating questions.");
  }
}

export async function generateAIQuestionsInternal(prompt: string, count: number = 5) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("AI Configuration missing (GEMINI_API_KEY)");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash-latest",
    generationConfig: {
      responseMimeType: "application/json",
    }
  });

  const systemPrompt = `
    You are an expert examiner. Generate ${count} multiple-choice questions (MCQs) based on the provided text.
    Return the result strictly as a valid JSON array of objects.
    Each object must follow this structure:
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
    
    Rules:
    1. Ensure the questions are technically accurate and challenging.
    2. Provide 4 distinct options for each question.
    3. The correctAnswer must be one of "A", "B", "C", or "D".
  `;

  try {
    const result = await model.generateContent([systemPrompt, prompt]);
    const response = await result.response;
    
    // Handle potential content blocking
    if (response.candidates?.[0]?.finishReason === "SAFETY" || response.candidates?.[0]?.finishReason === "BLOCKLIST") {
      throw new Error("Content was blocked by AI safety filters. Please try with different text.");
    }

    const text = response.text();
    
    try {
      // In JSON mode, Gemini should return pure JSON
      const questions = JSON.parse(text);
      return questions;
    } catch {
      // Fallback: try extraction if JSON mode somehow failed or added text
      const startIndex = text.indexOf("[");
      const endIndex = text.lastIndexOf("]") + 1;
      
      if (startIndex !== -1 && endIndex > startIndex) {
        const jsonString = text.substring(startIndex, endIndex);
        try {
          return JSON.parse(jsonString);
        } catch (innerErr) {
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
    
    // Provide more specific error messages for common issues
    if (err?.message?.includes("API_KEY")) {
      throw new Error("AI service is not configured (Missing API Key).");
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("AI Configuration missing (GEMINI_API_KEY)");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

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
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("AI Explanation Error:", error);
    throw new Error("Failed to generate AI feedback.");
  }
}
