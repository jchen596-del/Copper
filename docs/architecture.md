# Architecture

How the Copper State Labs app fits together. Each module adds a section at the
end (see [Adding a module](#adding-a-module)) when it changes how the app
works: new pages, tables or AI calls.

_Fictional — for educational use._

## The starter app (Module 0)

A Next.js app that builds, runs and deploys with **no environment variables**.
A Google AI Studio key is optional until a module needs one.

| Piece | Where | What it does |
|---|---|---|
| Pages | `app/` | `layout.tsx` sets the fonts and theme; `page.tsx` is the placeholder home page |
| Brand components | `components/copper/` | `Logo`, `SiteHeader`, `SiteFooter`, `ModeToggle` |
| UI kit | `components/ui/` (shadcn), `components/ai-elements/` (AI Elements) | The only UI libraries the app uses |
| Setup card | `components/setup-required.tsx` | `<SetupRequired service="ai" />`, shown instead of a page whose service isn't configured |
| Company catalog | `lib/copper/catalog.ts`, `lib/copper/data/catalog.json` | Product, plan and privacy facts from the Product Bible (Sections 3, 4, 8 and 10). Pages read prices and plan details from here instead of typing them (added in the Module 1 starter) |
| AI wrapper | `lib/ai/call.ts` | `callText` and `callObject`: every model call goes through these and is logged to the terminal |
| Models and prices | `lib/ai/models.ts`, `lib/ai/pricing.ts` | The approved Gemini models and their token prices |
| Module checks | `specs/module-N/`, `scripts/check.mjs` | Each module's spec, instructions, rubric and acceptance tests; `npm run check` runs them |

## Data flow

1. A user opens a page in `app/`.
2. Server code checks what's configured (`isAiConfigured()`). If the key is
   missing, the page renders `<SetupRequired />` instead of crashing.
3. Data comes from files under `lib/copper/data/`, except where a module has
   moved it to a database: Module 2 part 2 moves stock to a Supabase
   `inventory` table, read through `lib/copper/inventory.ts`. Facts that don't
   change daily (prices, colors) stay in the files.
4. AI requests go through `callText` / `callObject` in `lib/ai/call.ts`, which
   calls Google and then prints one `[ai_calls]` line: `module`, `feature`,
   `model`, tokens, `cost_usd`, `latency_ms`, `ok`.

```ts
const { text } = await callText(
  { module: 2, feature: "ask-copper" },
  { prompt },
);
```

## Two kinds of "AI tiers"

Don't mix these up:

- **Copper State Labs' product tiers** (On-device, Raw Ore, Refined, the
  Copper Cloud) are part of the fictional company. They are facts in the
  [Product Bible](copper-state-labs/product-bible.md) and rows in the `ai_tiers`
  table.
- **The models this app calls** are real Claude models listed in
  `lib/ai/models.ts`. Their cost is logged in `ai_calls`.

## Decisions

- **No environment variables required.** Every service is optional, so a fresh
  clone builds and deploys before any accounts are set up.
- **One AI wrapper.** Routing every call through `lib/ai/call.ts` gives one
  place to log cost and latency per module and feature.
- **No authentication or row-level security yet.** They arrive in a later
  module.

## Adding a module

When a module changes how the app fits together, add a section here:

```md
## Module N: <feature name>

**Summary:** one or two sentences: what this adds and why.

| Piece | Where | What it does |
|---|---|---|
| Page / route | `app/...` | |
| Components | `components/...` | |
| Data | `lib/copper/data/...` | Data files added |
| AI calls | `lib/ai/call.ts` (module, feature) | Model, prompt purpose, expected cost per call |

**Data flow:** user action → page → server code → database / model → response.

**Decisions and trade-offs:** what you chose, the alternatives, and why.

**Risks and open questions:** cost, privacy, accuracy or safety risks, and how
you handle them.
```

## Module 2: Ask Copper, the shopping chatbot

**Summary:** A floating chat panel on the landing page answers price, total and
stock questions by calling tools instead of guessing, and shows each step as it
happens.

| Piece | Where | What it does |
|---|---|---|
| Page / route | `app/page.tsx` | Mounts the panel and passes `isAiConfigured()` to it. No new routes |
| Components | `components/copper/ask-copper.tsx`, `ask-copper-steps.tsx` | The panel, two separate chats (tools on / off), and the stations that draw each answer |
| Tools | `lib/copper/assistant/tools.ts` | `get_products`, `get_prices`, `calculate_cost`, `check_availability`: read-only, with zod input contracts |
| Instructions | `lib/copper/assistant/instructions.ts` | Copper's system prompt, sent only when tools are on |
| Server Action | `lib/copper/assistant/ask.ts` | `askCopper()` streams the answer and returns a live `Progress` |
| Data | `lib/copper/data/inventory.json` | Stock list, read fresh by `check_availability` |
| AI calls | `lib/ai/call.ts` (module 2, `ask-copper`) | Gemini through `callStream`, with thought summaries; up to 5 steps |

**Data flow:** shopper question → panel → `askCopper()` → `callStream` → model
asks for a tool → tool runs in our code (catalog or stock list) → result goes
back to the model → reply. Each stream part updates a `Progress` that the panel
reads with `readLive()`.

**Decisions and trade-offs:** Prices, math and stock come from code, not from
the model, so they can't be invented. With tools off the model gets no
instructions and no tools, which is what makes the comparison honest. The two
chats keep separate histories so the tools-off model can't copy a tools answer.

**Risks and open questions:** Without tools the model invents prices, so that
chat is labeled as possibly made up. The tools only read, so a bad tool call
can't change anything. If the stock list can't be read, the tool says so
instead of guessing. Every question is logged to `ai_calls` for cost.

## Cost logging: the `ai_calls` table

**Summary:** Every model call was already printed to the terminal; now the same
row is also saved to a database table, so cost per module and feature survives
the terminal window closing.

| Piece | Where | What it does |
|---|---|---|
| Table | `supabase/migrations/20261105000000_ai_calls.sql` | `ai_calls`: module, feature, model, tokens, `cost_usd`, `latency_ms`, `ok`, `created_at` |
| Admin client | `lib/supabase/admin.ts` | `createAdminClient()`: a Supabase client holding the secret key; returns `null` when it isn't set |
| Config | `lib/supabase/config.ts` | `supabaseAdminConfig()` reads `SUPABASE_SECRET_KEY` |
| Write | `lib/ai/call.ts` (`logCall`) | Prints the line, then inserts the same row |

**Data flow:** model call finishes → `logCall()` prints `[ai_calls] {...}` →
`createAdminClient()` → insert into `ai_calls`. No key set, no client, no
insert: the call still works and still prints.

**Decisions and trade-offs:** The write uses `SUPABASE_SECRET_KEY`, not the
publishable key, because the publishable key ships to the browser and anyone
holding it could forge cost rows. Row level security is on with **no policies**,
so only the secret key reaches this table. `logCall` awaits the insert rather
than firing and forgetting, because Vercel can end a serverless request before
a detached write lands; the cost is a few milliseconds per answer. A failed
insert is warned about and swallowed, so logging can never break an answer.

**Risks and open questions:** The prompt and the reply are deliberately **not**
stored — only counts, cost and timing — so a leak of this table reveals no
customer questions. The secret key must never get a `NEXT_PUBLIC_` prefix or it
would reach the browser. The table grows one row per call, with no cleanup
policy yet.
