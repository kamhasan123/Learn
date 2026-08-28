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

    // Strictly bypassing 1.5 and using the active 2.0 AI Studio models
    let targetModels = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'];

    let systemPrompt = `You are an elite, stateful English coach named Mr. Handsome.
    CURRENT STATE: Mode: ${mode}, Level: ${currentLevel}, Week: ${currentWeek}, Day: ${currentDay}.
    ${personalizedPlan ? `STUDENT'S CUSTOM ROADMAP: ${personalizedPlan}` : "No custom roadmap yet."}
    
    CORE PEDAGOGICAL RULES FROM SYSTEM ARCHITECTURE:
    1. THE CORRECTION LOOP & 5-TRY LIMIT: If the user makes an error, fully explain the specific error first, provide the correction, and command them to repeat the corrected phrase. Check chat history: if they have failed to repeat it correctly 5 times, abort the loop gracefully, praise their effort, and pivot to an easier question.
    2. LEVEL 12+ ACCENT MASTERY: If currentLevel is 12 or higher, shift grading criteria away from basic vocabulary to heavily enforce American accent rules.
    3. HANDWRITING & SYLLABUS FEEDBACK: When grading handwriting, always explicitly output the strict 1-100 score in your feedback, detail any spelling/syntax errors, and update 'newPersonalizedPlan'.

    DYNAMIC HOMEWORK & BANGLA ROAST RULE:
    - During 'curriculum' mode, organically generate a short, custom written homework exercise tailored directly to today's lesson topic.
    - Ask the user to write their answer down on paper and upload a photo using the camera button (📸).
    - If they respond without uploading an image or completing the writing exercise, playfully roast them with funny jokes mixed in Bangla to make them feel playfully bad and push them to write it down, but keep the lesson moving forward.

    MODE-SPECIFIC RULES:
    A) If Mode is 'placementTest': 
       - Have an energetic conversation to gauge fluency. Output 'detectedLevel' and 'newPersonalizedPlan'.
    B) If Mode is 'curriculum':
       - Use their roadmap to tailor today's lesson. 20% of the time, provide a 1-word search term in 'imageKeyword'.
    C) If Mode is 'typing':
       - Give them sentences to practice typing accuracy.
    D) If Mode is 'extraHelp':
       - Act exclusively as a homework helper and open-ended Q&A tutor.`;

    const finalContents: any[] = [];
    const recentHistory = Array.isArray(chatHistory) ? chatHistory.slice(-6) : [];
    
    for (let i = 0; i < recentHistory.length; i++) {
      const msg = recentHistory[i];
      if (!msg?.content) continue;
      
      const parts: any[] = [];
      
      if (msg.imageUrl) {
         const match = msg.imageUrl.match(/^data:(image\/.*?);base64,(.*)$/);
         if (match) {
            parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
         }
      }
      
      parts.push({ text: msg.content });
      
      if (i === recentHistory.length - 1 && msg.role === 'user') {
         if (isInitialGreeting) {
            if (mode === 'placementTest') parts.push({ text: "Start placement test with an exciting greeting asking about their background." });
            else if (mode === 'curriculum') parts.push({ text: `Start Daily Lesson for Week ${currentWeek}, Day ${currentDay}. Give them a custom written homework exercise to do on paper.` });
            else if (mode === 'typing') parts.push({ text: "Welcome to Typing Practice. Give them a short sentence to type out." });
            else parts.push({ text: "I am ready to help with your English questions or homework!" });
         }
         
         if (image) {
             const currentImageMatch = image.match(/^data:(image\/.*?);base64,(.*)$/);
             if (currentImageMatch) {
                 parts.push({ inlineData: { mimeType: currentImageMatch[1], data: currentImageMatch[2] } });
             }
             parts.push({ text: "Please read this handwritten image. Grade this handwriting, explicitly state a score from 1-100, correct the syntax, and explain any errors." });
         }
         
         if (audio && mode !== 'typing') {
            const audioMatch = audio.match(/^data:(audio\/.*?);base64,(.*)$/);
            if (audioMatch) {
               parts.push({ inlineData: { mimeType: audioMatch[1], data: audioMatch[2] } });
               parts.push({ text: "User sent audio. Analyze grammar, pronunciation, and accent." });
            }
         }
      }
      
      finalContents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: parts
      });
    }

    if (finalContents.length === 0) {
       finalContents.push({ role: 'user', parts: [{ text: "Hello" }] });
    }

    let response: any = null;
    let lastError: any = null;

    for (const key of apiKeys) {
      const ai = new GoogleGenAI({ apiKey: key.trim() });
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
    return NextResponse.json({ 
      success: true,
      feedback: `[SYSTEM ERROR]: ${error.message || "Unknown error occurred"}.`,
      progressBump: 0 
    });
  }
}
