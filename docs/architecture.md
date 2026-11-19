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

## Data flow

1. A user opens a page in `app/`.
2. Server code checks what's configured (`isAiConfigured()`). If the key is
   missing, the page renders `<SetupRequired />` instead of crashing.
3. Data comes from files under `lib/copper/data/`.
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

## Module 3 starter: Ask Copper

**Summary:** Ask Copper, the Module 2 shopping chatbot, finished: a floating
chat panel that answers prices, totals and stock with four tools and shows
each step. Module 3 teaches it to answer from the customer documents.

| Piece | Where | What it does |
|---|---|---|
| Component | `components/copper/ask-copper.tsx` | The launcher and chat panel, mounted from `app/page.tsx` and opened by the header's `#ask` link. Draws each answer as stations: the tools on offer, thinking, each tool call, then the reply |
| Server Action | `lib/copper/assistant/ask.ts` | `askCopper()`: streams the conversation with `callStream`, up to 5 steps, and sends each step back as a live `Progress` |
| Tools | `lib/copper/assistant/tools.ts` | `copperTools`: `get_products`, `get_prices`, `calculate_cost`, `check_availability` |
| Instructions | `lib/copper/assistant/instructions.ts` | `COPPER_INSTRUCTIONS`. Copper says it can't help yet with warranty, setup, troubleshooting or privacy |
| Data | `lib/copper/inventory.ts`, `lib/copper/documents.ts` | Stock from `lib/copper/data/inventory.json`; `DOCUMENTS`: the four customer documents and their PDF paths under `public/docs/`. The PDFs are added in class |
| AI calls | `{ module: 2, feature: "ask-copper" }` | One streamed call per question |

## Module 3: Document passages and embeddings

**Summary:** The four customer PDFs in `public/docs/` are split into passages
of a few sentences and embedded with Gemini, so Ask Copper can find the
passages that answer a question and cite their page.

| Piece | Where | What it does |
|---|---|---|
| Build script | `scripts/embed-docs.mjs` (`npm run embed-docs`) | Reads each PDF in `DOCUMENTS` page by page (with `unpdf`), splits pages with `splitPage()`, embeds every passage and writes the JSON. Re-run it when a PDF changes |
| Splitter | `lib/copper/split-passages.ts` | `splitPage()`: drops the footer lines, then groups sentences three at a time (at most ~600 characters) |
| Data | `lib/copper/data/passages.json`, `lib/copper/passages.ts` | `PASSAGES`: `documentId`, `title`, `page`, `text` (starts with the document title) and `embedding`. Importing it loads every passage into memory once per server |
| Tool | `lib/copper/assistant/tools.ts` | `search_docs`: embeds the question, ranks every passage by cosine similarity and returns the 5 closest with title, page, a `/docs/<file>.pdf#page=N` link and a score. The tool card lists them with links; the instructions tell Copper to use it for setup, troubleshooting, warranty and policy questions and to cite the page |
| Citations | `lib/copper/assistant/citations.ts`, `lib/copper/assistant/instructions.ts` | Copper answers document questions only from `search_docs`, ends every sentence with `[Title, p. N]`, and says "I couldn't find that in our support docs" otherwise. `splitCitations()` lets the panel link each citation to that PDF page; unknown titles stay plain text |
| AI calls | `callEmbedMany` in `lib/ai/call.ts`, `{ module: 3, feature: "embed-docs" }` | `gemini-embedding-2` at 768 dimensions. One call per run of the script, plus one `{ module: 3, feature: "search-docs" }` call per search. Google doesn't report embedding tokens, so the log's tokens and cost are null |

**Data flow:** PDF → pages → passages → Gemini embeddings → `passages.json` →
`PASSAGES` in memory. Question → `search_docs` → question embedding → 5
closest passages → Copper answers from them and cites the page.

**Decisions and trade-offs:** A JSON file in memory instead of a vector
database: about 120 passages is under 1 MB, so searching all of them is
instant and needs no new service. 768 dimensions instead of 3072 keeps the
file small with little loss in accuracy. The title goes at the start of each
passage so similar passages from different documents (Copper Home vs. Copper
Notes) embed differently.

**Risks and open questions:** Questions must be embedded with the same model
and dimensions (`EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`) or the search
returns nonsense. Tables lose their columns when turned into text. Embeddings match meaning
better than exact strings, so an error code like C-47 can rank below other
error-code passages (it was third in testing); keyword search alongside would fix that.

## Module 4 starter: Support page

**Summary:** An empty Support page titled "Refund Console", with Ask Copper
(as finished in Module 3) docked on the right. Module 4 builds refunds here: a
second agent, and a person approving the large ones.

| Piece | Where | What it does |
|---|---|---|
| Page | `app/support/page.tsx` | The "Refund Console" title and nothing else yet, linked from the header as Support |
| Chat panel | `components/copper/ask-copper.tsx` | With the `docked` prop it starts open and the page beside it stays clickable. It is the same single agent and tools as on the home page |

## Module 4: Refunds with a second agent and a person in the loop

**Summary:** On the Support page, Copper hands refund requests to a separate
**Refund agent**. Code refunds anything at or under the auto-refund limit
($100 by default, changeable in the Refund Console); a person approves or
rejects anything over it, and Copper tells the customer in the chat.

| Piece | Where | What it does |
|---|---|---|
| Page | `app/support/page.tsx` | Renders `<RefundConsole />` and Ask Copper with the `refunds` prop |
| Refund Console | `components/copper/refund-console.tsx` | The limit (with Save), the "Waiting for approval" queue with **Approve** / **Reject**, the orders and the refund history with who decided each one |
| Chat panel | `components/copper/ask-copper.tsx` | With `refunds`: refund starter questions, sends the limit and refunds with each question, adds the refund the Refund agent made to the console, shows the Refund agent's steps, and posts a "refund update" when a person decides |
| Hand-off tool | `lib/copper/assistant/refund-agent.ts` | `hand_off_to_refund_agent` (Copper's tool, Support page only) runs the Refund agent and returns its report, its steps and the refund |
| Refund agent | `lib/copper/assistant/refund-agent.ts` | Its own instructions and two tools: `look_up_order` and `issue_refund`, up to 4 steps |
| Refund rule | `lib/copper/orders.ts` | `autoDecision()`: at or under the limit → `refunded`; over → `pending`. `issueRefund()` also refuses unknown orders, amounts over what's left, and orders already refunded or waiting |
| Data | `lib/copper/data/orders.json`, `lib/copper/refund-store.ts` | Six sample orders (CSL-1001 to CSL-1006). The limit and refunds live in the browser (`localStorage`), shared by the chat and the console |
| Instructions | `lib/copper/assistant/instructions.ts` | `REFUND_INSTRUCTIONS`, added to Copper's on the Support page: hand refunds off, ask for the order number, never claim a refund the Refund agent didn't report |
| AI calls | `{ module: 2, feature: "ask-copper" }` and `{ module: 4, feature: "refund-agent" }` | Gemini 2.5 Flash. A refund question takes about 3 model requests: Copper calls the hand-off tool and then replies (2), and the Refund agent calls look_up_order and issue_refund (it stops there, so its report is the code's decision). The Gemini free tier allows 20 requests a day per model; set `AI_MODEL=google/gemini-3-flash` to use the second approved model's quota |

**Data flow:** customer asks in the chat → `askCopper()` with the refund desk
(limit + refunds) → Copper calls `hand_off_to_refund_agent` → the Refund agent
calls `look_up_order`, then `issue_refund` → code compares the amount with the
limit → `refunded` or `pending` → report back to Copper, which replies → the
panel adds the refund to the console. A pending refund waits for **Approve** or
**Reject** → the store updates it and the chat posts the update.

**Who decides what:** the AI agents understand the request (which order, how
much, why). Code decides whether a refund is small enough to go through on its
own. A person decides every refund over the limit.

**Decisions and trade-offs:** Refunds and the limit live in the browser instead
of a database, so the page works on Vercel with no new service; the trade-off
is that each browser has its own refunds and the server trusts the limit the
browser sends (it validates the shape and range). The approve/reject message is
a fixed template rather than a model call: it's free, instant and can't
misstate the decision. The Refund agent is a separate model call with its own
instructions and tools, so Copper never touches `issue_refund` directly.

**Risks and open questions:** Anyone using the page can change the limit or
approve refunds: a real console needs sign-in and roles, and the limit and
refunds should move to a server-side table. The return window (30 days) and
Copper Plus refund terms aren't enforced by `issue_refund` yet. A model could
claim a refund it didn't make; the instructions forbid it and the console shows
the real status.
