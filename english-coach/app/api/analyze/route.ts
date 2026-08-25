import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { text, audio, image, currentLevel, currentWeek, currentDay, mode, personalizedPlan, isInitialGreeting, chatHistory } = body;

    const apiKeys = [
      process.env.GEMINI_API_KEY, 
      process.env.GEMINI_API_KEY_2, 
      process.env.GEMINI_API_KEY_3
    ].filter(Boolean) as string[];
    
    // Updated to currently supported production models
    let targetModels = ['gemini-3.7-flash', 'gemini-3.6-flash'];

    let systemPrompt = `You are an elite, stateful English coach named Mr. Handsome.
    CURRENT STATE: Mode: ${mode}, Level: ${currentLevel}, Week: ${currentWeek}, Day: ${currentDay}.
    ${personalizedPlan ? `STUDENT'S CUSTOM ROADMAP: ${personalizedPlan}` : "No custom roadmap yet."}
    
    MODE-SPECIFIC RULES:
    A) If Mode is 'placementTest': 
       - Have an energetic conversation to gauge fluency. Output their 'detectedLevel' (number 1 to 5) and 'newPersonalizedPlan'.
    B) If Mode is 'curriculum':
       - Use their roadmap to tailor today's lesson. 20% of the time, provide a 1-word search term in 'imageKeyword'.
    C) If Mode is 'typing':
       - Give them sentences to practice typing accuracy.
    D) If Mode is 'extraHelp':
       - Act exclusively as a homework helper and open-ended Q&A tutor. Do not push a curriculum.`;

    const turnParts: any[] = [];

    if (isInitialGreeting) {
      if (mode === 'placementTest') turnParts.push({ text: "Start placement test with an exciting greeting asking about their background." });
      else if (mode === 'curriculum') turnParts.push({ text: `Start Daily Lesson for Week ${currentWeek}, Day ${currentDay}.` });
      else if (mode === 'typing') turnParts.push({ text: "Welcome to Typing Practice. Give them a short sentence to type out." });
      else turnParts.push({ text: "I am ready to help with your English questions or homework!" });
    }

    if (image) {
      const match = image.match(/^data:(image\/.*?);base64,(.*)$/);
      if (match) {
         turnParts.push({ inlineData: { mimeType: match[1], data: match[2] } });
         turnParts.push({ text: "Grade this handwriting and update the plan." });
      }
    }

    if (text) turnParts.push({ text: `User text: ${text}` });

    const finalContents: any[] = [];
    if (Array.isArray(chatHistory)) {
      for (const msg of chatHistory) {
        if (msg?.content) {
           finalContents.push({
             role: msg.role === 'user' ? 'user' : 'model',
             parts: [{ text: msg.content }]
           });
        }
      }
    }

    if (turnParts.length > 0) {
       finalContents.push({ role: 'user', parts: turnParts });
    } else if (finalContents.length === 0) {
       finalContents.push({ role: 'user', parts: [{ text: "Hello" }] });
    }

    let response: any = null;
    let lastError = null;

    for (const key of apiKeys) {
      const ai = new GoogleGenAI({ apiKey: key });
      for (const modelName of targetModels) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: finalContents,
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  feedback: { type: "STRING" },
                  imageKeyword: { type: "STRING" },
                  progressBump: { type: "NUMBER" },
                  detectedLevel: { type: "NUMBER" },
                  newPersonalizedPlan: { type: "STRING" }
                },
                required: ["feedback", "imageKeyword", "progressBump"]
              }
            },
          });
          if (response?.text) break;
        } catch (err) { 
          lastError = err; 
        }
      }
      if (response?.text) break;
    }

    if (!response || !response.text) {
      throw lastError || new Error("All API Keys and AI models failed.");
    }

    let rawText = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const resultData = JSON.parse(rawText);

    if (resultData.imageKeyword && resultData.imageKeyword.length > 2) {
      resultData.webImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(resultData.imageKeyword)}?width=800&height=600&nologo=true`;
    }

    return NextResponse.json({ success: true, ...resultData });

  } catch (error: any) {
    console.error("CRITICAL BACKEND ERROR:", error);
    return NextResponse.json({ 
      success: true,
      feedback: `[SYSTEM ERROR]: ${error.message || "Unknown error occurred"}.`,
      progressBump: 0 
    });
  }
}
