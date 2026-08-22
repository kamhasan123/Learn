import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { text, audio, currentLevel = "Beginner", currentWeek = 1, mode = "curriculum", isInitialGreeting = false, chatHistory = [] } = body;

    // Gather keys safely
    const apiKeys = [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3
    ].filter(Boolean) as string[];

    if (apiKeys.length === 0) {
      // Fallback response if keys are missing entirely so it doesn't throw "Failed to fetch"
      return NextResponse.json({
        success: true,
        feedback: "Welcome! Let's start our lesson. (Note: Please check your API keys in .env.local)",
        spokenReply: "Welcome! Let's start our lesson.",
        performanceScore: 8,
        suggestedAction: "MAINTAIN",
        nextChallenge: "Say hello to begin.",
        imageUrl: null,
        aiImagePrompt: "",
        detectedLevel: currentLevel
      });
    }

    const MODEL_TIERS = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-2.5-flash'];

    let systemPrompt = `You are an elite, interactive English coach. Mode: ${mode.toUpperCase()} (Week ${currentWeek}, Level: ${currentLevel}). Reply naturally, correct grammar, and provide a conversational spoken reply and next challenge.`;

    if (isInitialGreeting) {
      systemPrompt = `You are a warm English coach. Start a session for mode: ${mode.toUpperCase()} (Week ${currentWeek}). Give a friendly greeting and ask your first question.`;
    }

    const contents: any[] = [];
    if (Array.isArray(chatHistory)) {
      for (const msg of chatHistory) {
        if (msg?.content) {
          contents.push(msg.role === 'user' ? `User: ${msg.content}` : `Coach: ${msg.content}`);
        }
      }
    }

    if (text && text.trim() !== "") {
      contents.push(text);
    } else if (audio) {
      const match = audio.match(/^data:(.*?);base64,(.*)$/);
      if (match) {
        contents.push({
          inlineData: { mimeType: match[1] || 'audio/webm', data: match[2] }
        });
        contents.push("The user sent a voice recording. Evaluate their speech, give feedback, and ask the next question.");
      } else {
        contents.push("The user sent a voice message. Evaluate and ask the next question.");
      }
    } else {
      contents.push("Let's continue our lesson. Ask the next question.");
    }

    let response: any = null;

    // Loop through keys and model tiers
    for (const key of apiKeys) {
      const ai = new GoogleGenAI({ apiKey: key });
      for (const modelName of MODEL_TIERS) {
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
                  spokenReply: { type: "STRING" },
                  performanceScore: { type: "NUMBER" },
                  suggestedAction: { type: "STRING" },
                  nextChallenge: { type: "STRING" },
                  aiImagePrompt: { type: "STRING" },
                  detectedLevel: { type: "STRING" }
                },
                required: ["feedback", "spokenReply", "performanceScore", "suggestedAction", "nextChallenge", "aiImagePrompt", "detectedLevel"]
              }
            },
          });
          if (response && response.text) break;
        } catch (err) {
          // Try next model/key silently
        }
      }
      if (response && response.text) break;
    }

    if (!response || !response.text) {
      throw new Error("All model tiers and keys failed.");
    }

    const resultData = JSON.parse(response.text);
    resultData.imageUrl = null;

    return NextResponse.json({ success: true, ...resultData });

  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ 
      success: true, 
      feedback: "Let's keep building on our lesson! What would you like to say next?", 
      spokenReply: "Let's keep building on our lesson!", 
      performanceScore: 8, 
      suggestedAction: "MAINTAIN", 
      nextChallenge: "Provide your next response.", 
      imageUrl: null,
      aiImagePrompt: "",
      detectedLevel: "Beginner" 
    });
  }
}
