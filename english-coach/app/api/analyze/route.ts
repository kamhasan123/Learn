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
    
    let targetModels = ['gemini-2.5-flash', 'gemini-3.5-flash'];

    let systemPrompt = `You are an elite, stateful English coach named Mr. Handsome.
    CURRENT STATE: Mode: ${mode}, Level: ${currentLevel}, Week: ${currentWeek}, Day: ${currentDay}.
    ${personalizedPlan ? `STUDENT'S CUSTOM ROADMAP: ${personalizedPlan}` : "No custom roadmap yet."}
    
    STRICT HARDWARE & REALITY CHECK RULES:
    1. NO HALLUCINATIONS: Look at what the user actually provided in this current turn. 
       - If no image was uploaded, DO NOT talk about an image, handwriting, or a photo. 
       - Only acknowledge the literal input that is physically present in the request.
    
    2. ONE RESPONSE FIELD: Provide everything in the 'feedback' string.
    
    3. DYNAMIC MULTI-MODAL FLEXIBILITY: 
       - Lessons can mix speaking, text comprehension, and handwriting. Evaluate whatever input method is used.

    MODE-SPECIFIC RULES:
    
    A) If Mode is 'placementTest': 
       - Have an energetic conversation to gauge fluency. Output their 'detectedLevel' and 'newPersonalizedPlan'. Tell them the test is complete.
       
    B) If Mode is 'curriculum':
       - Use their 'STUDENT'S CUSTOM ROADMAP' to tailor today's lesson. Randomize scenarios. 20% of the time, provide a 1-word search term in 'imageKeyword'.
       
    C) If Mode is 'typing':
       - KEYBOARD ONLY. Give them typing prompts and check text accuracy.
       
    D) If Mode is 'extraHelp':
       - THIS IS NOT A LESSON OR A TEST. Do not push a curriculum.
       - Act exclusively as a homework helper and open-ended Q&A tutor. Wait for the user to ask a specific question, and provide direct, friendly assistance.`;

    const turnParts: any[] = [];

    if (isInitialGreeting) {
      if (mode === 'placementTest') turnParts.push({ text: "Start placement test with an exciting, welcoming text prompt asking about their background." });
      else if (mode === 'curriculum') turnParts.push({ text: `Start Daily Lesson for Week ${currentWeek}, Day ${currentDay}.` });
      else if (mode === 'typing') turnParts.push({ text: "Welcome to Typing Practice. Give them a short sentence to type out." });
      else turnParts.push({ text: "Introduce yourself as a homework helper ready to answer any specific English questions." });
    }

    if (image) {
      const match = image.match(/^data:(image\/.*?);base64,(.*)$/);
      if (match) {
         turnParts.push({ inlineData: { mimeType: match[1], data: match[2] } });
         turnParts.push({ text: "Grade this handwriting from 1 to 100, correct any mistakes, and update the 'newPersonalizedPlan'." });
      }
    }

    if (text) turnParts.push({ text: `User text: ${text}` });

    if (audio && mode !== 'typing') {
      const match = audio.match(/^data:(audio\/.*?);base64,(.*)$/);
      if (match) {
         turnParts.push({ inlineData: { mimeType: match[1], data: match[2] } });
         turnParts.push({ text: "User sent audio. Analyze grammar and pronunciation." });
      }
    }

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

  }   } catch (error: any) {
    console.error("CRITICAL BACKEND ERROR:", error);
    return NextResponse.json({ 
      success: true, 
      feedback: `[SYSTEM ERROR]: ${error.message || "Unknown error occurred"}. Please check your API keys and Vercel logs.`, 
      progressBump: 0 
    });
  }

  }
}
