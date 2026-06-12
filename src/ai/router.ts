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

// Phase 1: everything goes to DeepSeek.
//
// Phase 2 routing (uncomment when AI_PROVIDER=claude is active):
//   architecture_analysis    → Claude
//   refactoring_suggestions  → Claude
//   vitest_generation        → DeepSeek
//   playwright_generation    → DeepSeek
//   api_test_generation      → DeepSeek
//   readme_improvements      → DeepSeek

function selectProviderName(_ctx: RouterContext): string {
  const configured = (process.env.AI_PROVIDER ?? "deepseek").toLowerCase();

  // When a specific provider is forced via env, honour it for all tasks.
  if (configured !== "deepseek") return configured;

  // Phase 1: route everything to DeepSeek.
  switch (_ctx.taskType as TaskType) {
    default:
      return "deepseek";
  }

  // ── Phase 2 example (uncomment to enable) ──────────────────────────────────
  // switch (_ctx.taskType) {
  //   case "architecture_analysis":
  //   case "refactoring_suggestions":
  //     return "claude";
  //   default:
  //     return "deepseek";
  // }
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

function buildCacheKey(providerName: string, method: string, prompt: string): string {
  return `${providerName}:${method}:${djb2(prompt)}`;
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
  const cacheKey = explicitCacheKey ?? buildCacheKey(providerName, method, prompt);

  const cached = responseCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const provider = getProvider(providerName);
  const result =
    method === "analyze"
      ? await provider.analyze(prompt, maxTokens, repoUrl)
      : await provider.generate(prompt, maxTokens, repoUrl);

  responseCache.set(cacheKey, result);
  return result;
}
