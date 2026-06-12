import type { AIProvider } from "../types";

// Placeholder — activate when needed.
// Set AI_PROVIDER=gemini and GEMINI_API_KEY in your .env to enable.
export class GeminiProvider implements AIProvider {
  constructor(private readonly apiKey: string) {}

  async generate(prompt: string, _maxTokens = 2048, _repoUrl?: string, _model?: string): Promise<string> {
    throw new Error(
      "Gemini provider is not yet active. Set AI_PROVIDER=gemini once GEMINI_API_KEY is configured.",
    );
  }

  async analyze(prompt: string, _maxTokens = 1024, _repoUrl?: string, _model?: string): Promise<string> {
    throw new Error(
      "Gemini provider is not yet active. Set AI_PROVIDER=gemini once GEMINI_API_KEY is configured.",
    );
  }
}
