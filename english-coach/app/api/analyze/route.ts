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
    
    if (apiKeys.length === 0) {
      throw new Error("Missing GEMINI_API_KEY environment variable in Vercel.");
    }

    // Using stable, universally available production models
    let targetModels = ['gemini-1.5-flash', 'gemini-1.5-pro'];

    let systemPrompt = `You are an elite, stateful English coach named Mr. Handsome.
    CURRENT STATE: Mode: ${mode}, Level: ${currentLevel}, Week: ${currentWeek}, Day: ${currentDay}.
    ${personalizedPlan ? `STUDENT'S CUSTOM ROADMAP: ${personalizedPlan}` : "No custom roadmap yet."}
    
    CORE RULES:
    1. CORRECTION & FRUSTRATION LIMIT: If the user makes an error, explain it and command them to repeat the corrected phrase. If they fail 5 times, abort gracefully and pivot to an easier prompt.
    2. LEVEL 12+ ACCENT MASTERY: If currentLevel is 12 or higher, enforce American accent rules (flap T, schwa sounds, linking consonants).
    3. HANDWRITING & SYLLABUS: Grade handwriting 1-100 and update 'newPersonalizedPlan' to target weaknesses in future lessons.

    MODE-SPECIFIC RULES:
    A) If Mode is 'placementTest': 
       - Have an energetic conversation to gauge fluency. Output their 'detectedLevel' (number 1 to 20) and 'newPersonalizedPlan'.
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
         turnParts.push({ text: "Grade this handwriting, score it 1-100, correct syntax, and update the plan." });
      }
    }

    if (text) turnParts.push({ text: `User text: ${text}` });

    if (audio && mode !== 'typing') {
      const match = audio.match(/^data:(audio\/.*?);base64,(.*)$/);
      if (match) {
         turnParts.push({ inlineData: { mimeType: match[1], data: match[2] } });
         turnParts.push({ text: "User sent audio. Analyze grammar, pronunciation, and accent." });
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
    let lastError: any = null;

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
        } catch (err: any) { 
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
    // This will print the precise underlying error message from Google or Vercel onto your screen
    return NextResponse.json({ 
      success: true,
      feedback: `[API ERROR]: ${error?.message || JSON.stringify(error)}`,
      progressBump: 0 
    });
  }
}
