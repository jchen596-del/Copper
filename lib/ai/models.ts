// The course's approved models. Calls go straight to Google with a Google AI
// Studio key, which is free and needs no credit card.
export const MODELS = [
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash (fast, shows its thinking)",
    // Google's own name for it, used when calling Google.
    googleId: "gemini-2.5-flash",
  },
  {
    id: "google/gemini-3-flash",
    label: "Gemini 3 Flash (newer, thinks out loud less often)",
    googleId: "gemini-3-flash-preview",
  },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

/**
 * Gemini's embedding model. It turns a piece of text into a list of numbers (a
 * "vector") that stands for its meaning, so two passages about the same thing
 * end up with similar numbers. That's what makes search by meaning possible.
 *
 * The model can return up to 3072 numbers per passage; 768 is plenty for a few
 * dozen pages and keeps the saved index about a quarter of the size.
 */
export const EMBEDDING_MODEL = {
  id: "google/gemini-embedding-001",
  googleId: "gemini-embedding-001",
  dimensions: 768,
} as const;

export type EmbeddingModelId = typeof EMBEDDING_MODEL.id;

/**
 * The model used when a call doesn't name one. 2.5 Flash writes a summary of
 * its thinking for every question, which Ask Copper shows students.
 */
export const DEFAULT_MODEL: ModelId = "google/gemini-2.5-flash";

/** AI_MODEL if it names an approved model, otherwise the default. */
export function defaultModel(): ModelId {
  const id = process.env.AI_MODEL;
  return MODELS.find((m) => m.id === id)?.id ?? DEFAULT_MODEL;
}
