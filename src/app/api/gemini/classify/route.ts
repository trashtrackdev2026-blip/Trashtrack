import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { authenticatedAi } from "@/lib/ai-access";
import { staffApiError } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const maxDuration = 90;

const SCAN_PROMPT = `Analyze this waste item image and respond ONLY in this exact format:
ITEM: [name of the detected item]
TYPE: [Recyclable / Biodegradable / Residual / Special]
CONFIDENCE: [0-100]%
STEPS:
- [disposal step 1]
- [disposal step 2]
- [disposal step 3]

Keep steps short and practical. Base your answer on Philippine waste segregation standards (RA 9003).`;

export async function POST(req: NextRequest) {
  try { await authenticatedAi(req); } catch (error) { return staffApiError(error); }
  try {
    const { imageBase64 } = await req.json();

    if (typeof imageBase64 !== "string" || !imageBase64.trim() || imageBase64.length > 4_000_000) {
      return NextResponse.json({ error: "Provide a valid image smaller than 3 MB" }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // We expect the client to send a base64 string (without the data URL prefix if possible, or we handle both)
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: base64Data, mimeType: "image/jpeg" } },
            { text: SCAN_PROMPT }
          ]
        }
      ],
      config: {
        temperature: 0.2,
        httpOptions: { timeout: 55_000 },
      }
    });

    const text = response.text?.trim() || "";
    if (!text) {
      throw new Error("Empty response from AI");
    }

    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: "The AI service is temporarily unavailable. Please try again." }, { status: 502 });
  }
}
