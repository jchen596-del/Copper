// Module 2: the four tools Ask Copper can use. Products and prices come from
// lib/copper/catalog.ts and stock from lib/copper/inventory.ts, so the
// chatbot never has to make them up.
// Each tool returns plain data; the model writes the reply around it.
import { tool } from "ai";
import { z } from "zod";
import { callEmbed } from "@/lib/ai/call";
import {
  getPlans,
  getProducts,
  type Plan,
  type ProductId,
} from "@/lib/copper/catalog";
import { DOCUMENTS } from "@/lib/copper/documents";
import { readInventory } from "@/lib/copper/inventory";
import { searchPassages } from "@/lib/copper/rag";

export type ProductList = {
  products: {
    id: ProductId;
    name: string;
    type: string;
    priceUsd: number;
    colors: string[];
  }[];
};

export type Prices = {
  products: { id: ProductId; name: string; priceUsd: number }[];
  plans: {
    id: Plan["id"];
    name: string;
    monthlyUsd: number;
    annualUsd: number;
  }[];
};

export type CalculateCostInput = {
  products: ProductId[];
  plan: Plan["id"];
  billing: "monthly" | "annual";
  years: number;
};

export type CostBreakdown = {
  lines: { item: string; usd: number }[];
  totalUsd: number;
};

export type CheckAvailabilityInput = { product: ProductId; color?: string };

export type Stock = "in_stock" | "low_stock" | "backordered";

export type Availability =
  | {
      status: "ok";
      product: string;
      colors: { color: string; stock: Stock; restockDate: string | null }[];
    }
  | { status: "not_a_color"; product: string; color: string; colors: string[] }
  | { status: "unavailable"; message: string };

/** get_products: what Copper sells and which colors each one comes in. */
export function listProducts(): ProductList {
  return {
    products: getProducts().map(({ id, name, type, priceUsd, colors }) => ({
      id,
      name,
      type,
      priceUsd,
      colors,
    })),
  };
}

/** get_prices: every product and plan price, read from the catalog. */
export function getPrices(): Prices {
  return {
    products: getProducts().map(({ id, name, priceUsd }) => ({
      id,
      name,
      priceUsd,
    })),
    plans: getPlans().map(({ id, name, monthlyUsd, annualUsd }) => ({
      id,
      name,
      monthlyUsd,
      annualUsd,
    })),
  };
}

const productId = z.enum(["copper-home", "copper-notes"]);

export const calculateCostInput = z.object({
  products: z.array(productId).max(5),
  plan: z.enum(["free", "copper-plus"]),
  billing: z.enum(["monthly", "annual"]),
  years: z.number().int().min(1).max(5),
}) satisfies z.ZodType<CalculateCostInput>;

const cents = (usd: number) => Math.round(usd * 100) / 100;

/** calculate_cost: the total cost of devices plus a plan over some years. */
export function calculateCost(input: CalculateCostInput): CostBreakdown {
  const products = getProducts();
  const lines = input.products.map((id) => {
    const product = products.find((p) => p.id === id)!;
    return { item: product.name, usd: cents(product.priceUsd) };
  });
  const plan = getPlans().find((p) => p.id === input.plan)!;
  const planUsd =
    input.billing === "monthly"
      ? plan.monthlyUsd * 12 * input.years
      : plan.annualUsd * input.years;
  // The free plan costs nothing, so it adds no line.
  if (planUsd > 0) {
    const years = input.years === 1 ? "1 year" : `${input.years} years`;
    lines.push({
      item: `${plan.name}, ${input.billing}, ${years}`,
      usd: cents(planUsd),
    });
  }
  return { lines, totalUsd: cents(lines.reduce((sum, l) => sum + l.usd, 0)) };
}

export const checkAvailabilityInput = z.object({
  product: productId,
  color: z.string().optional(),
}) satisfies z.ZodType<CheckAvailabilityInput>;

function stockOf(units: number): Stock {
  if (units === 0) return "backordered";
  return units < 10 ? "low_stock" : "in_stock";
}

/** check_availability: stock for one product (or one of its colors), read fresh each time. */
export async function checkAvailability(
  input: CheckAvailabilityInput,
): Promise<Availability> {
  const product = getProducts().find((p) => p.id === input.product)!;
  const wanted = input.color?.trim().toLowerCase();
  const colors = wanted
    ? product.colors.filter((c) => c.toLowerCase() === wanted)
    : product.colors;
  if (input.color && colors.length === 0) {
    return {
      status: "not_a_color",
      product: product.name,
      color: input.color,
      colors: product.colors,
    };
  }
  const rows = await readInventory();
  if (!rows) {
    return {
      status: "unavailable",
      message: "Stock can't be checked right now. Please try again soon.",
    };
  }
  return {
    status: "ok",
    product: product.name,
    colors: colors.flatMap((color) => {
      const row = rows.find(
        (r) =>
          r.product === product.name &&
          r.color.toLowerCase() === color.toLowerCase(),
      );
      if (!row) return [];
      const stock = stockOf(row.units_in_stock);
      return [
        {
          color,
          stock,
          restockDate: stock === "backordered" ? row.next_shipment : null,
        },
      ];
    }),
  };
}

export type DocumentPassage = {
  document: string;
  page: number;
  text: string;
  /** Where the PDF is served, so a reply can link to the page it used. */
  file: string;
};

export type DocumentSearch =
  | { status: "ok"; passages: DocumentPassage[] }
  | { status: "nothing_found" }
  | { status: "unavailable"; message: string };

export const searchDocumentsInput = z.object({
  question: z.string().min(3).max(300),
});

export type SearchDocumentsInput = z.infer<typeof searchDocumentsInput>;

/**
 * How alike a passage must be to count as worth reading. Measured against
 * these documents: questions they answer score 0.63 and up, while off-topic
 * ones ("what is the capital of France?") peak around 0.52, so 0.58 sits in
 * the gap. Re-check it if the documents change a lot.
 */
const MIN_SCORE = 0.58;
const MOST_PASSAGES = 5;

/**
 * search_documents: the passages of Copper's customer PDFs that come closest
 * in meaning to a question. The question is embedded the same way the passages
 * were (see lib/copper/rag.ts), then compared against every one of them.
 */
export async function searchDocuments(
  input: SearchDocumentsInput,
): Promise<DocumentSearch> {
  let embedding: number[];
  try {
    const { embeddings } = await callEmbed(
      { module: 3, feature: "ask-copper-search" },
      [input.question],
      "RETRIEVAL_QUERY",
    );
    embedding = embeddings[0];
  } catch {
    // Copper should say the documents can't be read right now rather than
    // answer warranty or privacy questions from memory.
    return {
      status: "unavailable",
      message: "The documents can't be searched right now.",
    };
  }

  const matches = searchPassages(embedding, MOST_PASSAGES).filter(
    (match) => match.score >= MIN_SCORE,
  );
  if (matches.length === 0) return { status: "nothing_found" };

  return {
    status: "ok",
    passages: matches.map((match) => ({
      document: match.documentTitle,
      page: match.page,
      // Each passage is stored with its title in front; `document` already
      // says that, so send the passage itself.
      text: match.text.slice(match.documentTitle.length).replace(/^\.\s*/, ""),
      file: DOCUMENTS.find((d) => d.id === match.documentId)?.file ?? "",
    })),
  };
}

export const copperTools = {
  get_products: tool({
    description:
      "Lists every Copper product with its type, price and the colors it comes in.",
    inputSchema: z.object({}),
    execute: async () => listProducts(),
  }),
  get_prices: tool({
    description: "Gets the price of every Copper product and plan.",
    inputSchema: z.object({}),
    execute: async () => getPrices(),
  }),
  calculate_cost: tool({
    description:
      "Works out the total cost of Copper devices plus a plan over 1 to 5 years.",
    inputSchema: calculateCostInput,
    execute: async (input) => calculateCost(input),
  }),
  check_availability: tool({
    description:
      "Checks today's stock for a Copper product, for every color or just one.",
    inputSchema: checkAvailabilityInput,
    execute: async (input) => checkAvailability(input),
  }),
  search_documents: tool({
    description:
      "Searches Copper's customer documents (the user guides, the terms and conditions, and the Copper Plus FAQ) and returns the passages closest to a question, each with its document and page number. Use it for warranty, returns, setup, troubleshooting, privacy, recordings and subscription terms.",
    inputSchema: searchDocumentsInput,
    execute: async (input) => searchDocuments(input),
  }),
};
