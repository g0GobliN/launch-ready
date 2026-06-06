import type { AIProvider } from "../types";

// Placeholder — activate when needed.
// Set AI_PROVIDER=openai and OPENAI_API_KEY in your .env to enable.
export class OpenAIProvider implements AIProvider {
  constructor(private readonly apiKey: string) {}

  async generate(prompt: string, _maxTokens = 2048): Promise<string> {
    throw new Error(
      "OpenAI provider is not yet active. Set AI_PROVIDER=openai once OPENAI_API_KEY is configured.",
    );
  }

  async analyze(prompt: string, _maxTokens = 1024): Promise<string> {
    throw new Error(
      "OpenAI provider is not yet active. Set AI_PROVIDER=openai once OPENAI_API_KEY is configured.",
    );
  }
}
