import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/config/env";
import type { AiProvider } from "@/ai/engine/provider.interface";

const MODEL = "claude-sonnet-5";

export class AnthropicProvider implements AiProvider {
  readonly modelName = MODEL;
  private client: Anthropic;

  constructor() {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set — required to use the Anthropic provider. " +
          "See backend/.env.example."
      );
    }
    this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }

  async complete(system: string, user: string): Promise<string> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: user }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Anthropic response contained no text content");
    }
    return textBlock.text;
  }
}
