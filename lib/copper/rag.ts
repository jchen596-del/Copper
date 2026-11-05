// The searchable copy of Copper's customer PDFs.
//
// scripts/build-rag-index.mts splits each PDF page into short passages and
// embeds them; this file is what the app reads. The import below runs once,
// when the app starts, so the passages and their vectors sit in memory and a
// search costs nothing but arithmetic.
//
// Rebuild it with `npm run rag:build` after changing a PDF.
import index from "@/lib/copper/data/rag-index.json";

export type RagPassage = {
  id: string;
  documentId: string;
  documentTitle: string;
  page: number;
  /** The text that was embedded: the document title, then the passage. */
  text: string;
};

export type RagMatch = RagPassage & {
  /** How close the passage is to the question, from -1 to 1. Higher is closer. */
  score: number;
};

type StoredPassage = RagPassage & { embedding: number[] };

const PASSAGES: StoredPassage[] = index.passages;

/** Which embedding model built the index: a question must use the same one. */
export const RAG_INDEX = {
  model: index.model,
  dimensions: index.dimensions,
  builtAt: index.builtAt,
  count: PASSAGES.length,
} as const;

/** How many passages came from each document. */
export function passageCounts(): { documentTitle: string; passages: number }[] {
  const counts = new Map<string, number>();
  for (const passage of PASSAGES) {
    counts.set(
      passage.documentTitle,
      (counts.get(passage.documentTitle) ?? 0) + 1,
    );
  }
  return [...counts].map(([documentTitle, passages]) => ({
    documentTitle,
    passages,
  }));
}

/**
 * How alike two vectors are. Gemini returns vectors of uneven length when it's
 * asked for fewer than 3072 numbers, so dividing by both lengths is what makes
 * the comparison fair.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let aLength = 0;
  let bLength = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aLength += a[i] * a[i];
    bLength += b[i] * b[i];
  }
  const size = Math.sqrt(aLength) * Math.sqrt(bLength);
  return size === 0 ? 0 : dot / size;
}

/**
 * The passages closest in meaning to an embedded question, best first. Embed
 * the question with callEmbed(..., "RETRIEVAL_QUERY") to get `queryEmbedding`.
 */
export function searchPassages(
  queryEmbedding: number[],
  limit = 5,
): RagMatch[] {
  return PASSAGES.map(({ embedding, ...passage }) => ({
    ...passage,
    score: cosineSimilarity(queryEmbedding, embedding),
  }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
