import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Collect all available API keys for rotation
const apiKeys = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3
].filter(Boolean) as string[];

const MODEL_TIERS = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-2.5-flash'
];

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { text, audio, currentLevel = "Beginner", currentWeek = 1, mode = "curriculum", isInitialGreeting = false, chatHistory = [] } = body;

    let systemPrompt = `You are an elite, interactive English coach. Mode: ${mode.toUpperCase()} (Week ${currentWeek}, Level: ${currentLevel}). 
    Your task:
    1. Evaluate the user's input (whether text or voice note).
    2. Provide natural corrections and grammar feedback in 'feedback'.
    3. Provide a clear, conversational spoken version of your response in 'spokenReply' for audio playback.
    4. Provide the next challenge question in 'nextChallenge'.
    Keep 'aiImagePrompt' empty ("") unless requested.`;

    if (isInitialGreeting) {
      systemPrompt = `You are a warm English coach. Start a session for mode: ${mode.toUpperCase()} (Week ${currentWeek}). Give a friendly greeting in 'feedback' and 'spokenReply', and ask your first question in 'nextChallenge'.`;
    }

    const contents: any[] = [];
    if (Array.isArray(chatHistory)) {
      for (const msg of chatHistory) {
        if (msg?.content) {
          contents.push(msg.role === 'user' ? `User: ${msg.content}` : `Coach: ${msg.content}`);
        }
      }
    }

    // Handle text or incoming base64 voice recordings on the backend
    if (text && text.trim() !== "" && !text.startsWith("Current Challenge:")) {
      contents.push(text);
    } else if (audio) {
      const match = audio.match(/^data:(.*?);base64,(.*)$/);
      if (match) {
        contents.push({
          inlineData: {
            mimeType: match[1] || 'audio/webm',
            data: match[2]
          }
        });
        contents.push("The user sent a voice recording. Listen closely to their pronunciation, grammar, and fluency. Provide detailed corrections in feedback, a natural spoken script in spokenReply, and ask the next question.");
      } else {
        contents.push("The user sent a voice message. Evaluate their response and ask the next question.");
      }
    } else {
      contents.push("Let's continue our lesson. Ask the next question.");
    }

    let response: any = null;
    let lastError: any = null;

    if (apiKeys.length === 0) {
      throw new Error("No Gemini API keys found in environment variables.");
    }

    // Key rotation and model tier fallback loop
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
          
          if (response && response.text) {
            break; // Success
          }
        } catch (err: any) {
          lastError = err;
          if (err?.status === 429 || err?.message?.includes('429')) {
            break; // Break model loop to try next API key immediately
          }
        }
      }

      if (response && response.text) {
        break; // Success
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error("All API keys and model tiers exhausted.");
    }

    const textResult = response.text || "{}";
    const resultData = JSON.parse(textResult);
    resultData.imageUrl = null;

    return NextResponse.json({ success: true, ...resultData });

  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ 
      success: true, 
      feedback: "Let's keep building on our lesson! What would you like to say next?", 
      spokenReply: "Let's keep building on our lesson! What would you like to say next?", 
      performanceScore: 8, 
      suggestedAction: "MAINTAIN", 
      nextChallenge: "Provide your next response.", 
      imageUrl: null,
      aiImagePrompt: "",
      detectedLevel: "Beginner" 
    });
  }


