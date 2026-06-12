import type { AIProvider } from "../types";

// DeepSeek exposes an OpenAI-compatible REST API.
// Model: "deepseek-chat" → DeepSeek-V3 (latest stable).
// Update the model constant below when DeepSeek V4 Flash becomes available.
const DEEPSEEK_MODEL = "deepseek-chat";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

export class DeepSeekProvider implements AIProvider {
  constructor(private readonly apiKey: string) {}

  async generate(prompt: string, maxTokens = 2048, _repoUrl?: string, _model?: string): Promise<string> {
    return this.call(prompt, maxTokens);
  }

  async analyze(prompt: string, maxTokens = 1024, _repoUrl?: string, _model?: string): Promise<string> {
    return this.call(prompt, maxTokens);
  }

  private async call(prompt: string, maxTokens: number): Promise<string> {
    const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`DeepSeek API error ${res.status}: ${body}`);
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0]?.message?.content?.trim() ?? "";
  }
}
