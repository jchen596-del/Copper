// @vitest-environment node
import { describe, expect, it } from "vitest";
import { searchDocuments } from "@/lib/copper/assistant/tools";
import index from "@/lib/copper/data/rag-index.json";
import { DOCUMENTS } from "@/lib/copper/documents";
import { passageCounts, RAG_INDEX, searchPassages } from "@/lib/copper/rag";

describe("the document search index", () => {
  it("has passages from every customer document", () => {
    const titles = passageCounts().map((row) => row.documentTitle);
    for (const document of DOCUMENTS) {
      expect(titles).toContain(document.title);
    }
    for (const row of passageCounts()) {
      expect(row.passages).toBeGreaterThan(0);
    }
  });

  it("gives every passage a vector of the size it claims", () => {
    expect(RAG_INDEX.count).toBe(index.passages.length);
    for (const passage of index.passages) {
      expect(passage.embedding).toHaveLength(RAG_INDEX.dimensions);
    }
  });

  it("starts each passage with its document title and a real page number", () => {
    for (const passage of index.passages) {
      expect(passage.text.startsWith(passage.documentTitle)).toBe(true);
      expect(passage.text.length).toBeGreaterThan(
        passage.documentTitle.length + 1,
      );
      expect(passage.page).toBeGreaterThanOrEqual(1);
    }
  });

  it("drops the footer that repeats on every page", () => {
    const boilerplate = index.passages.filter((passage) =>
      /Fictional company and documents/i.test(passage.text),
    );
    expect(boilerplate).toHaveLength(0);
  });

  it("ranks a passage first when searched with its own vector", () => {
    // No model call needed: a passage is the closest thing to itself, so this
    // checks the ranking maths rather than the quality of the embeddings.
    for (const n of [0, 40, index.passages.length - 1]) {
      const passage = index.passages[n];
      const [best] = searchPassages(passage.embedding, 1);
      expect(best.id).toBe(passage.id);
      expect(best.score).toBeCloseTo(1, 5);
    }
  });

  it("tells Copper the documents are unreadable rather than throwing when AI isn't set up", async () => {
    // No key is set in tests, so the embedding call can't run. Copper must get
    // a plain "unavailable" back, not an exception that breaks the answer.
    const result = await searchDocuments({ question: "warranty length" });
    expect(result.status).toBe("unavailable");
  });

  it("returns as many matches as asked for, best first", () => {
    const matches = searchPassages(index.passages[5].embedding, 3);
    expect(matches).toHaveLength(3);
    expect(matches[0].score).toBeGreaterThanOrEqual(matches[1].score);
    expect(matches[1].score).toBeGreaterThanOrEqual(matches[2].score);
    // The caller gets the passage, not the raw numbers behind it.
    expect(matches[0]).not.toHaveProperty("embedding");
  });
});
