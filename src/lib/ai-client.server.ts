// Calls whichever AI provider has a key configured.
// Anthropic (ANTHROPIC_API_KEY) takes priority; OpenAI (OPENAI_API_KEY) is the fallback.

export async function callAI(prompt: string, maxTokens = 2048): Promise<string> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!anthropicKey && !openaiKey) {
    throw new Error("No AI API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in your .env file.");
  }

  if (anthropicKey) {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: anthropicKey });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });
    return msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
  }

  // OpenAI fallback
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: openaiKey });
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}
