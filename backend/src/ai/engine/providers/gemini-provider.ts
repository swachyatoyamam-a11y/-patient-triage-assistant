import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/config/env";
import type { AiProvider } from "@/ai/engine/provider.interface";

// Pinned to a specific, named GA release rather than the "-latest" rolling
// alias — a production clinical-adjacent tool shouldn't have its model (and
// therefore its output behavior) change out from under it without a
// deliberate version bump. Confirmed reachable with this account's key at
// pin time; if Google retires this model, requests will start failing with
// a 404 and the fix is to re-check available models and update this
// constant, not to silently fall back to "-latest".
const MODEL = "gemini-3.5-flash";

export class GeminiProvider implements AiProvider {
  readonly modelName = MODEL;
  private client: GoogleGenerativeAI;

  constructor() {
    if (!env.GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY is not set — required to use the Gemini provider. " +
          "See backend/.env.example."
      );
    }
    this.client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }

  async complete(system: string, user: string): Promise<string> {
    const model = this.client.getGenerativeModel({
      model: MODEL,
      systemInstruction: system,
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
      },
    });

    const result = await model.generateContent(user);
    const text = result.response.text();
    if (!text) {
      throw new Error("Gemini response contained no text content");
    }
    return text;
  }
}
