import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { text, audio, image, currentLevel, currentWeek, currentDay, mode, personalizedPlan, isInitialGreeting, chatHistory } = body;

    const apiKeys = [
      process.env.GEMINI_API_KEY, 
      process.env.GEMINI_API_KEY_2, 
      process.env.GEMINI_API_KEY_3
    ].map(k => k?.trim()).filter(Boolean) as string[];
    
    if (apiKeys.length === 0) {
      throw new Error("Missing GEMINI_API_KEY environment variable in Vercel.");
    }

    const targetModel = 'gemini-3.6-flash';

    let systemPrompt = `You are an elite, stateful English coach named Mr. Handsome.
    CURRENT STATE: Mode: ${mode}, Level: ${currentLevel}, Week: ${currentWeek}, Day: ${currentDay}.
    ${personalizedPlan ? `STUDENT'S CUSTOM ROADMAP: ${personalizedPlan}` : "No custom roadmap yet."}
    
    CORE PEDAGOGICAL RULES FROM SYSTEM ARCHITECTURE:
    1. THE CORRECTION LOOP & 5-TRY LIMIT: If the user makes an error, fully explain the specific error first, provide the correction, and command them to repeat the corrected phrase. Check chat history: if they have failed to repeat it correctly 5 times, abort the loop gracefully, praise their effort, and pivot to an easier question.
    2. LEVEL 12+ ACCENT MASTERY: If currentLevel is 12 or higher, shift grading criteria away from basic vocabulary to heavily enforce American accent rules.
    3. HANDWRITING & SYLLABUS FEEDBACK: When grading handwriting, you must carefully read and transcribe what the user wrote, grade it strictly from 1-100, correct any spelling/syntax errors, and update 'newPersonalizedPlan'.

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

    const contents: any[] = [];
    const recentHistory = Array.isArray(chatHistory) ? chatHistory.slice(-6) : [];
    
    for (let i = 0; i < recentHistory.length; i++) {
      const msg = recentHistory[i];
      if (!msg?.content) continue;
      
      const parts: any[] = [];
      
      if (msg.imageUrl) {
         const match = msg.imageUrl.match(/^data:(image\/.*?);base64,(.*)$/);
         if (match) {
            parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
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
                 parts.push({ inline_data: { mime_type: currentImageMatch[1], data: currentImageMatch[2] } });
             }
             parts.push({ text: "Carefully read and transcribe every word of the handwriting in this image. Grade the handwriting strictly from 1-100, include your transcription in your feedback, correct any spelling or syntax mistakes, and update the personalized plan." });
         }
         
         if (audio && mode !== 'typing') {
            const audioMatch = audio.match(/^data:(audio\/.*?);base64,(.*)$/);
            if (audioMatch) {
               parts.push({ inline_data: { mime_type: audioMatch[1], data: audioMatch[2] } });
               parts.push({ text: "User sent audio. Analyze grammar, pronunciation, and accent." });
            }
         }
      }
      
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: parts
      });
    }

    if (contents.length === 0) {
       contents.push({ role: 'user', parts: [{ text: "Hello" }] });
    }

    const payload = {
      contents,
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        response_mime_type: "application/json",
        response_schema: {
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
      }
    };

    let apiResponse: any = null;
    let data: any = null;
    let lastError: any = null;

    for (const activeApiKey of apiKeys) {
      try {
        apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${activeApiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        data = await apiResponse.json();

        if (apiResponse.ok) {
          break;
        } else {
          lastError = new Error(data.error?.message || `API error status: ${apiResponse.status}`);
          continue;
        }
      } catch (err: any) {
        lastError = err;
        continue;
      }
    }

    if (!apiResponse || !apiResponse.ok || !data) {
      throw lastError || new Error("All API keys failed or exceeded quota limits.");
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error("No response text returned from Gemini API.");
    }

    let cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const resultData = JSON.parse(cleanedText);

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
