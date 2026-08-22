import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { GoogleGenerativeAI } from '@google/generative-ai';


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
       - If no audio was recorded, DO NOT claim you heard their voice file. 
       - Only acknowledge the literal input (text, audio, or image) that is physically present in the request payload.
    
    2. ONE RESPONSE FIELD: Provide everything in the 'feedback' string.
    3. THE CORRECTION LOOP & 5-TRY RULE: If the user makes a mistake, correct them and ask them to repeat it. If they fail 5 times, abort and pivot to an easier question.
    
    4. DYNAMIC MULTI-MODAL FLEXIBILITY: 
       - Lessons can mix speaking, text comprehension, and handwriting turn-by-turn. Gracefully evaluate whatever input method the user actually uses in this turn.

    5. WEEK 12+ ACCENT RULE: 
       - Accent training and pronunciation tips are STRICTLY FORBIDDEN unless currentWeek >= 12 (or level >= 12). If week is under 12, focus exclusively on grammar, vocabulary, and basic sentence construction.
       
    6. HANDWRITING GRADING: 
       - ONLY if an image is physically provided, give it a Grade from 1 to 100, explain errors, and update 'newPersonalizedPlan'.

    MODE-SPECIFIC RULES:
    
    A) If Mode is 'placementTest': 
       - Have an energetic, clear conversation to gauge fluency. After 2-3 replies, output their numeric 'detectedLevel' (1-20) and a 'newPersonalizedPlan'. Tell them the test is complete so the tab can close.
       
    B) If Mode is 'curriculum':
       - Use their 'STUDENT'S CUSTOM ROADMAP' to tailor today's lesson. Randomize scenarios. 20% of the time, provide a 1-word search term in 'imageKeyword'.
       
    C) If Mode is 'typing':
       - KEYBOARD ONLY. Give them typing prompts, check their text accuracy, and give mechanical typing tips.
       
    D) If Mode is 'extraHelp':
       - Act as an energetic free-form tutor.`;

    const contents: any[] = [];
    
    if (Array.isArray(chatHistory)) {
      for (const msg of chatHistory) {
        if (msg?.content) contents.push(msg.role === 'user' ? `User: ${msg.content}` : `Coach: ${msg.content}`);
      }
    }

    if (image) {
      const match = image.match(/^data:(image\/.*?);base64,(.*)$/);
      if (match) contents.push({ inlineData: { mimeType: match[1], data: match[2] } }, "Grade this handwriting from 1 to 100 and update the 'newPersonalizedPlan'.");
    }
    if (text) contents.push(`User text: ${text}`);
    if (audio && mode !== 'typing') {
      const match = audio.match(/^data:(audio\/.*?);base64,(.*)$/);
      if (match) contents.push({ inlineData: { mimeType: match[1], data: match[2] } }, "User sent audio. Analyze grammar.");
    }
    
    if (isInitialGreeting) {
      if (mode === 'placementTest') contents.push("Start placement test with an exciting, welcoming text prompt asking about their background.");
      else if (mode === 'curriculum') contents.push(`Start Daily Lesson for Week ${currentWeek}, Day ${currentDay}.`);
      else if (mode === 'typing') contents.push("Welcome to Typing Practice. Give them a short sentence to type out.");
      else contents.push("Start Extra Help session.");
    }

    let response: any = null;
    let lastError = null;

    for (const key of apiKeys) {
      const ai = new GoogleGenAI({ apiKey: key });
      for (const modelName of targetModels) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: contents,
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
      feedback: `Let's keep going! What would you like to say next?`, 
      progressBump: 0 
    });
  }
}
