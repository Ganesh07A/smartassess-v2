"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function generateAIQuestions(prompt: string, count: number = 5) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "TEACHER") {
    throw new Error("Unauthorized");
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("AI Configuration missing (GEMINI_API_KEY)");
  }

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
    4. Return ONLY the JSON array, no preamble or extra text.
  `;

  try {
    const result = await model.generateContent([systemPrompt, prompt]);
    const response = await result.response;
    const text = response.text();
    
    // Clean the text in case Gemini adds markdown code blocks
    const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    try {
      const questions = JSON.parse(cleanedText);
      return questions;
    } catch {
      console.error("AI JSON Parse Error. Cleaned text was:", cleanedText);
      throw new Error("The AI returned an invalid format. Please try re-generating.");
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
