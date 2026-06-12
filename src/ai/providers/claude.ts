import type { AIProvider } from "../types";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_VERSION = "2023-06-01";

// Set AI_PROVIDER=claude and CLAUDE_API_KEY (or ANTHROPIC_API_KEY) in your .env.
export class ClaudeProvider implements AIProvider {
  constructor(private readonly apiKey: string) {}

  async generate(prompt: string, maxTokens = 2048, _repoUrl?: string, model?: string): Promise<string> {
    return this.call(prompt, maxTokens, model);
  }

  async analyze(prompt: string, maxTokens = 1024, _repoUrl?: string, model?: string): Promise<string> {
    return this.call(prompt, maxTokens, model);
  }

  private async call(prompt: string, maxTokens: number, modelOverride?: string): Promise<string> {
    const model = modelOverride ?? process.env.CLAUDE_MODEL ?? DEFAULT_MODEL;

    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Claude API error ${res.status}: ${body}`);
    }

    const data = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
    };

    return data.content
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("")
      .trim();
  }
}
