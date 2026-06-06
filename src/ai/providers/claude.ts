import type { AIProvider } from "../types";

// Placeholder — activate in Phase 2 (50+ paying users).
// Set AI_PROVIDER=claude and CLAUDE_API_KEY in your .env to enable.
export class ClaudeProvider implements AIProvider {
  constructor(private readonly apiKey: string) {}

  async generate(prompt: string, _maxTokens = 2048): Promise<string> {
    throw new Error(
      "Claude provider is not yet active. Set AI_PROVIDER=claude once CLAUDE_API_KEY is configured.",
    );
  }

  async analyze(prompt: string, _maxTokens = 1024): Promise<string> {
    throw new Error(
      "Claude provider is not yet active. Set AI_PROVIDER=claude once CLAUDE_API_KEY is configured.",
    );
  }
}
