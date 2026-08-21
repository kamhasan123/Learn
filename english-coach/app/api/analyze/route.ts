import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    // Parse the incoming request body
    const { text, type } = await req.json();

    // Default system prompt
    let systemPrompt = "You are a friendly, encouraging English language coach. Review the user's text, correct any grammar or spelling mistakes, and provide helpful feedback in a positive tone.";

    // Adjust prompt based on type if needed
    if (type === "grammar") {
      systemPrompt = "You are a strict but encouraging English grammar coach. Review the user's text, clearly point out any grammatical errors, and explain how to fix them.";
    }

    // Call the OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", 
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ],
    });

    // Extract the AI's response safely using optional chaining
    const aiFeedback = response.choices[0]?.message?.content || "No response received from AI.";

    // Return the successful response as JSON
    return NextResponse.json({ success: true, feedback: aiFeedback });

  } catch (error: any) {
    console.error("OpenAI Error:", error);
    
    // Ensure we always return valid JSON even on error
    return NextResponse.json(
      { 
        success: false, 
        message: "Server Error connecting to AI", 
        error: error?.message || "Unknown error"
      }, 
      { status: 500 }
    );
  }
}
