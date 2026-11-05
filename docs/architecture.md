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

## Module 3: document search index (RAG)

**Summary:** Copper's four customer PDFs are turned into 95 short passages,
each embedded with Gemini so it can be found by meaning rather than by keyword.
The passages and their vectors are saved to one JSON file that the app loads
into memory at startup, ready for Ask Copper to search.

| Piece | Where | What it does |
|---|---|---|
| Build script | `scripts/build-rag-index.mts` (`npm run rag:build`) | Reads every PDF in `public/docs/`, drops the header and footer lines that repeat across pages, splits each page into passages of up to 3 sentences or 700 characters, prefixes each with its document title, embeds them all and writes the index |
| Data | `lib/copper/data/rag-index.json` | 95 passages (0.73 MB): id, document id and title, page number, the embedded text and a 768-number vector |
| Loader | `lib/copper/rag.ts` | Imports the JSON once at startup, so searching is pure arithmetic. `searchPassages(queryEmbedding)` ranks passages by cosine similarity; `passageCounts()` reports how many came from each document |
| Tool | `lib/copper/assistant/tools.ts` → `search_documents` | Embeds the shopper's question as a query, returns the closest passages above 0.58 with their document and page, or `nothing_found` / `unavailable` |
| Lab page | `app/rag/page.tsx` (`/rag`) | Type a question, see the passages and scores that come back. A teaching view of the index, not a customer page |
| AI calls | `lib/ai/call.ts` → `callEmbed`: `{ module: 3, feature: "rag-index" }` at build, `"rag-search"` on `/rag`, `"ask-copper-search"` from the tool | One batched `gemini-embedding-001` call per build (~1s for 95 passages) and one per question (~300ms). Google reports no token usage for embeddings, so the `ai_calls` line logs a null cost |

**Data flow:** `npm run rag:build` → pdf.js text per page → passages → one
batched embedding call → `rag-index.json` → imported into memory at startup →
`searchPassages()` at question time.

**Decisions and trade-offs:**

- **768 dimensions, not the model's full 3072.** Keeps the file at 0.73 MB
  instead of ~3 MB for a handful of pages, with no noticeable loss in ranking.
  Shorter Gemini vectors come back un-normalized, so the search divides by both
  vector lengths rather than assuming a length of 1.
- **A JSON file in the repo, not a vector database.** 95 passages fit in memory
  with room to spare, the whole index is readable and diffable, and there is no
  service to set up. A database only starts to pay off in the thousands.
- **Passage text starts with the document title.** A passage read on its own
  still says where it came from, which helps both the ranking and the model's
  citation of it.
- **Repeated lines are dropped by shape, not by a hard-coded list.** Page
  numbers differ per page, so lines are compared with their digits blanked out:
  "Page 1 of 6" and "Page 2 of 6" count as the same line and are removed when
  they appear on most pages.

**Risks and open questions:**

- The index is a snapshot. Change a PDF and `npm run rag:build` has to run
  again, or answers quietly go stale. The `builtAt` field records when.
- Sentence splitting is a regex, so an unusual abbreviation can split a
  sentence in the wrong place. It only affects passage edges, not correctness.
- The 0.58 score floor was measured against these four documents, not derived.
  Questions they answer score 0.63 and up; off-topic ones peak near 0.52.
  Replace the PDFs with very different ones and that gap should be re-checked.
- Copper is told to answer only from the passages it gets back and to name the
  document and page. That is an instruction, not a guarantee: the documents
  contain deliberate contradictions, so answers still need spot-checking.
