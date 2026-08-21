import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// This initializes OpenAI using the hidden key in your .env.local file
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { text, type } = await req.json();

    // Give the AI its personality and instructions based on the tab selected
    let systemPrompt = "You are a friendly, encouraging, and expert English language coach. Keep your responses conversational, helpful, and concise.";
    
    if (type === "grammar") {
      systemPrompt = "You are a strict but encouraging English grammar coach. Review the user's text, correct any spelling or grammar mistakes, and briefly explain why the changes were made to help them improve.";
    }

    // Call the OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Fast and cost-effective model
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ],
    });

    const aiFeedback = response.choices[0].message.content;

    return NextResponse.json({ success: true, feedback: aiFeedback });
    
  } catch (error) {
    console.error("OpenAI Error:", error);
    return NextResponse.json({ success: false, message: "Server Error connecting to AI" }, { status: 500 });
  }
}
