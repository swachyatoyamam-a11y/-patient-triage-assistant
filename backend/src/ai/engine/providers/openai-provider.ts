import OpenAI from "openai";
import { env } from "@/config/env";
import type { AiProvider } from "@/ai/engine/provider.interface";

const MODEL = "gpt-4.1";

export class OpenAiProvider implements AiProvider {
  readonly modelName = MODEL;
  private client: OpenAI;

  constructor() {
    if (!env.OPENAI_API_KEY) {
      throw new Error(
        "OPENAI_API_KEY is not set — required to use the OpenAI provider. " +
          "See backend/.env.example."
      );
    }
    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  async complete(system: string, user: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      throw new Error("OpenAI response contained no content");
    }
    return text;
  }
}
