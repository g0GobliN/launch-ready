import type { AIProvider, RouterContext, TaskType } from "./types";
import { DeepSeekProvider } from "./providers/deepseek";
import { ClaudeProvider } from "./providers/claude";
import { OpenAIProvider } from "./providers/openai";
import { GeminiProvider } from "./providers/gemini";
import { CursorProvider } from "./providers/cursor";

// ─── Provider singletons ──────────────────────────────────────────────────────

let _deepseek: DeepSeekProvider | null = null;
let _claude: ClaudeProvider | null = null;
let _openai: OpenAIProvider | null = null;
let _gemini: GeminiProvider | null = null;
let _cursor: CursorProvider | null = null;

function getProvider(name: string): AIProvider {
  switch (name) {
    case "deepseek": {
      const key = process.env.DEEPSEEK_API_KEY;
      if (!key) throw new Error("DEEPSEEK_API_KEY is not set in your .env file.");
      return (_deepseek ??= new DeepSeekProvider(key));
    }
    case "claude": {
      const key = process.env.CLAUDE_API_KEY ?? process.env.ANTHROPIC_API_KEY;
      if (!key) {
        throw new Error("CLAUDE_API_KEY (or ANTHROPIC_API_KEY) is not set in your .env file.");
      }
      return (_claude ??= new ClaudeProvider(key));
    }
    case "openai": {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error("OPENAI_API_KEY is not set in your .env file.");
      return (_openai ??= new OpenAIProvider(key));
    }
    case "gemini": {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new Error("GEMINI_API_KEY is not set in your .env file.");
      return (_gemini ??= new GeminiProvider(key));
    }
    case "cursor": {
      const key = process.env.CURSOR_API_KEY;
      if (!key) throw new Error("CURSOR_API_KEY is not set in your .env file.");
      return (_cursor ??= new CursorProvider(key));
    }
    default:
      throw new Error(
        `Unknown AI provider: "${name}". Valid options: deepseek, claude, openai, gemini, cursor.`,
      );
  }
}

// ─── Task → provider routing ──────────────────────────────────────────────────

const FAST_GENERATION_TASKS = new Set<TaskType>([
  "vitest_generation",
  "playwright_generation",
  "api_test_generation",
  "readme_improvements",
  "ci_generation",
  "env_example_generation",
]);

const SIMPLE_FILL_TASKS = new Set<TaskType>([
  "readme_improvements",
  "ci_generation",
  "env_example_generation",
]);

const HAIKU_MODEL = process.env.CLAUDE_FAST_MODEL ?? "claude-haiku-4-5-20251001";
const SONNET_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";

function hasProviderKey(name: string): boolean {
  switch (name) {
    case "deepseek":
      return Boolean(process.env.DEEPSEEK_API_KEY);
    case "claude":
      return Boolean(process.env.CLAUDE_API_KEY ?? process.env.ANTHROPIC_API_KEY);
    case "openai":
      return Boolean(process.env.OPENAI_API_KEY);
    case "gemini":
      return Boolean(process.env.GEMINI_API_KEY);
    case "cursor":
      return Boolean(process.env.CURSOR_API_KEY);
    default:
      return false;
  }
}

// Cloud Agents need minutes to boot; chat APIs finish test generation in seconds.
function fastGenerationProvider(): string {
  if (hasProviderKey("claude")) return "claude";
  if (hasProviderKey("deepseek")) return "deepseek";
  if (hasProviderKey("openai")) return "openai";
  throw new Error(
    "AI test generation needs a chat provider (Claude/DeepSeek/OpenAI). " +
      "Set ANTHROPIC_API_KEY or DEEPSEEK_API_KEY.",
  );
}

function selectProviderName(ctx: RouterContext): string {
  const configured = (process.env.AI_PROVIDER ?? "deepseek").toLowerCase();

  if (configured === "cursor" && FAST_GENERATION_TASKS.has(ctx.taskType)) {
    return fastGenerationProvider();
  }

  if (FAST_GENERATION_TASKS.has(ctx.taskType)) {
    return fastGenerationProvider();
  }

  if (configured !== "deepseek") return configured;
  return "deepseek";
}

function selectModel(providerName: string, taskType: TaskType): string | undefined {
  if (providerName !== "claude") return undefined;
  return SIMPLE_FILL_TASKS.has(taskType) ? HAIKU_MODEL : SONNET_MODEL;
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

const responseCache = new Map<string, string>();

function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function buildCacheKey(providerName: string, method: string, prompt: string, model?: string): string {
  return `${providerName}:${model ?? "default"}:${method}:${djb2(prompt)}`;
}

// ─── Public router ────────────────────────────────────────────────────────────

export type RouterMethod = "generate" | "analyze";

export async function route(
  ctx: RouterContext,
  method: RouterMethod,
  prompt: string,
  maxTokens?: number,
  explicitCacheKey?: string,
  repoUrl?: string,
): Promise<string> {
  const providerName = selectProviderName(ctx);
  const model = selectModel(providerName, ctx.taskType);
  const cacheKey = explicitCacheKey ?? buildCacheKey(providerName, method, prompt, model);

  const cached = responseCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const provider = getProvider(providerName);
  const result =
    method === "analyze"
      ? await provider.analyze(prompt, maxTokens, repoUrl, model)
      : await provider.generate(prompt, maxTokens, repoUrl, model);

  responseCache.set(cacheKey, result);
  return result;
}
