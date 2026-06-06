# LaunchReady

**Turn your AI-built app into a production-ready project.**

LaunchReady scans your GitHub repository for missing production setup, scores it, and creates pull requests that fix the gaps — in one click.

Built for developers shipping with Cursor, Bolt, Copilot, and other AI tools.

---

## What it does

1. **Connect** your GitHub account
2. **Scan** any repo — LaunchReady checks for missing tests, CI/CD, env config, error handling, and more
3. **Review** a scored report with prioritised issues
4. **Fix** — pick issues and LaunchReady opens a pull request with real code changes

AI-powered fixes (Vitest suites, Playwright flows, API tests) are generated on demand and charged against your credit balance.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) (React 19, SSR) |
| Routing | TanStack Router |
| Database | Supabase (PostgreSQL) |
| Auth | GitHub OAuth (custom session cookies) |
| Payments | Stripe |
| AI | DeepSeek V3 · Claude · OpenAI · Gemini (provider abstraction) |
| Styling | Tailwind CSS v4 + Radix UI |

---

## Getting started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- A [GitHub OAuth App](https://github.com/settings/developers)
- A [DeepSeek](https://platform.deepseek.com) API key (Phase 1)

### 1. Clone and install

```bash
git clone https://github.com/your-username/launch-ready.git
cd launch-ready
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in the values:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# GitHub OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Session
SESSION_SECRET=           # openssl rand -hex 32

# App URL
APP_URL=http://localhost:5174

# AI provider (deepseek | claude | openai | gemini)
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
```

### 3. Set up the database

Paste the contents of [`supabase/schema.sql`](supabase/schema.sql) into the [Supabase SQL Editor](https://supabase.com/dashboard) and run it.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:5174](http://localhost:5174).

---

## Project structure

```
src/
├── ai/                          # AI abstraction layer
│   ├── providers/               # deepseek · claude · openai · gemini
│   ├── router.ts                # Task → provider routing + in-memory cache
│   ├── types.ts                 # AIProvider interface, TaskType, RouterContext
│   └── index.ts                 # aiService.generate() / .analyze() / .fix()
│
├── lib/
│   ├── scanner.server.ts        # Repo scanning logic
│   ├── credits.server.ts        # Plan enforcement, credit deduction
│   ├── ai-tests.server.ts       # AI fix generation (Vitest, Playwright, API)
│   ├── arch-scanner.server.ts   # Architecture analysis
│   ├── supabase.server.ts       # Supabase client (SSR-aware + service role)
│   └── plans.ts                 # Plan definitions and limits
│
├── routes/
│   ├── index.tsx                # Landing page
│   ├── dashboard.tsx            # Repo list + plan overview
│   ├── repo.$repoId.tsx         # Scan results + issue list
│   ├── repo.$repoId.fix.tsx     # Fix selection + job creation
│   ├── repo.$repoId.job.$jobId.tsx  # Job status + PR link
│   ├── repo.$repoId.arch.tsx    # Architecture analysis
│   └── pricing.tsx              # Plans + upgrade
│
└── components/                  # UI components (Radix + Tailwind)
```

---

## Plans

| | Free | Starter | Pro | Agency |
|---|---|---|---|---|
| Price | ¥0 | ¥490 / mo | ¥980 / mo | ¥2,980 / mo |
| Repositories | 1 | 3 | 10 | 50 |
| Scans / month | 3 | 20 | 100 | 500 |
| AI credits / month | — | 10 | 50 | 250 |
| Template fixes | ✓ | ✓ | ✓ | ✓ |
| AI-generated fixes | — | ✓ | ✓ | ✓ |
| Architecture analysis | — | — | ✓ | ✓ |
| Priority processing | — | — | ✓ | ✓ |
| Team dashboard | — | — | — | ✓ |

**AI credit costs:**

| Fix type | Credits |
|---|---|
| Vitest test suite | 1 |
| Playwright E2E tests | 2 |
| API test generation | 2 |
| Architecture analysis | 3 |

---

## AI provider architecture

All AI calls go through `aiService` — never call a provider directly from business logic.

```ts
import { aiService } from "~/ai";

// Generate code (tests, README, etc.)
await aiService.generate(prompt, { taskType: "vitest_generation" });

// Analyse architecture
await aiService.analyze(prompt, { taskType: "architecture_analysis" });

// Targeted fix or refactor
await aiService.fix(prompt, { taskType: "refactoring_suggestions" });
```

**Phase 1 (current):** everything routes to DeepSeek.

**Phase 2 (50+ paying users):** `architecture_analysis` and `refactoring_suggestions` route to Claude; everything else stays on DeepSeek.

Switch providers by setting `AI_PROVIDER` in `.env` — no code changes required.

---

## Database

Eight tables — see [`supabase/schema.sql`](supabase/schema.sql) for the full definition.

| Table | Purpose |
|---|---|
| `repos` | GitHub repos saved by users |
| `scans` | Scan results (score) per repo |
| `issues` | Individual issues found per scan |
| `fix_requests` | Async PR-generation jobs |
| `user_credits` | Per-user plan, credit balance, quota |
| `credit_transactions` | Append-only credit ledger |
| `ai_test_cache` | Cached AI results (retry = free) |
| `arch_scans` | Architecture analysis results |

---

## Scripts

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # ESLint
npm run format     # Prettier
```
