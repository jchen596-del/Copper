// Builds the search index Ask Copper reads: every customer PDF in public/docs
// is split into short passages, each passage is embedded with Gemini, and the
// whole lot is saved to lib/copper/data/rag-index.json.
//
//   npm run rag:build
//
// Run it again whenever a PDF changes. It needs GOOGLE_GENERATIVE_AI_API_KEY.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { callEmbed } from "@/lib/ai/call";
import { EMBEDDING_MODEL } from "@/lib/ai/models";
import { DOCUMENTS } from "@/lib/copper/documents";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// .env.local wins over .env, the same order Next.js uses.
for (const file of [".env", ".env.local"]) {
  const path = join(root, file);
  if (existsSync(path)) process.loadEnvFile(path);
}

/** How many sentences go in one passage, and the most characters it may run to. */
const SENTENCES_PER_PASSAGE = 3;
const MAX_PASSAGE_CHARS = 700;
/** A passage shorter than this is folded into the one before it on the page. */
const MIN_PASSAGE_CHARS = 120;

export type Passage = {
  id: string;
  documentId: string;
  documentTitle: string;
  page: number;
  /** The text that was embedded: the document title, then the passage. */
  text: string;
  embedding: number[];
};

export type RagIndex = {
  model: string;
  dimensions: number;
  builtAt: string;
  passages: Passage[];
};

/** Pulls the text off each page, one string per page. */
async function readPages(path: string): Promise<string[]> {
  const task = getDocument({
    data: new Uint8Array(readFileSync(path)),
    useSystemFonts: false,
    // Only the text is wanted, but pdf.js warns on every page without this.
    // It wants forward slashes and a trailing one, even on Windows.
    standardFontDataUrl: `${join(root, "node_modules", "pdfjs-dist", "standard_fonts").replace(/\\/g, "/")}/`,
  });
  const doc = await task.promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    let text = "";
    for (const item of content.items) {
      // The items are either text or marked-content markers; only text has `str`.
      if (!("str" in item)) continue;
      text += item.str;
      if (item.hasEOL) text += "\n";
    }
    pages.push(text);
  }
  await task.destroy();
  return pages;
}

/**
 * Drops the lines that run across most pages: the header, the page number and
 * the copyright footer. Page numbers change, so lines are compared with their
 * digits blanked out ("Page 1 of 6" and "Page 2 of 6" count as the same line).
 */
function stripRepeatedLines(pages: string[]): string[][] {
  const shape = (line: string) => line.replace(/\d+/g, "#");
  const pagesWithLine = new Map<string, number>();
  const lines = pages.map((page) =>
    page
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean),
  );
  for (const page of lines) {
    for (const key of new Set(page.map(shape))) {
      pagesWithLine.set(key, (pagesWithLine.get(key) ?? 0) + 1);
    }
  }
  const threshold = Math.max(2, Math.ceil(pages.length * 0.6));
  const isBoilerplate = (line: string) =>
    line.length <= 120 && (pagesWithLine.get(shape(line)) ?? 0) >= threshold;
  return lines.map((page) => page.filter((line) => !isBoilerplate(line)));
}

// Words that end in a period without ending the sentence.
const ABBREVIATION =
  /(?:\b(?:Inc|Ltd|Co|Corp|No|Fig|vs|etc|Dr|Mr|Mrs|Ms|St|Rev|approx|max|min|Sec|Art)|\b[A-Za-z]|e\.g|i\.e)\.$/;

function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  for (const part of text.split(/(?<=[.!?])\s+/)) {
    const piece = part.trim();
    if (!piece) continue;
    const previous = sentences[sentences.length - 1];
    // "Rev. C" and the like: glue the fragment back onto the sentence before it.
    if (previous && ABBREVIATION.test(previous)) {
      sentences[sentences.length - 1] = `${previous} ${piece}`;
    } else {
      sentences.push(piece);
    }
  }
  return sentences;
}

/** Groups a page's sentences into passages of a few sentences each. */
function toPassages(pageText: string): string[] {
  const passages: string[] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length === 0) return;
    passages.push(current.join(" "));
    current = [];
  };
  for (const sentence of splitSentences(pageText)) {
    const length = current.join(" ").length + sentence.length + 1;
    if (current.length > 0 && length > MAX_PASSAGE_CHARS) flush();
    current.push(sentence);
    if (current.length >= SENTENCES_PER_PASSAGE) flush();
  }
  flush();
  // A stray heading or half-sentence on its own says very little, so attach it
  // to the passage before it rather than indexing it alone.
  return passages.reduce<string[]>((kept, passage) => {
    if (passage.length < MIN_PASSAGE_CHARS && kept.length > 0) {
      kept[kept.length - 1] += ` ${passage}`;
      return kept;
    }
    kept.push(passage);
    return kept;
  }, []);
}

async function main() {
  const built: Omit<Passage, "embedding">[] = [];
  const perDocument: { title: string; pages: number; passages: number }[] = [];

  for (const document of DOCUMENTS) {
    const path = join(root, "public", document.file);
    if (!existsSync(path)) {
      throw new Error(
        `Missing PDF: ${document.file}. Put it in public/docs/ and run this again.`,
      );
    }
    const pages = stripRepeatedLines(await readPages(path));
    let count = 0;
    pages.forEach((lines, index) => {
      const page = index + 1;
      toPassages(lines.join(" ")).forEach((passage, n) => {
        built.push({
          id: `${document.id}-p${page}-${n}`,
          documentId: document.id,
          documentTitle: document.title,
          page,
          // Starting with the title means a passage still says which document
          // it came from when the model reads it on its own.
          text: `${document.title}. ${passage}`,
        });
        count++;
      });
    });
    perDocument.push({
      title: document.title,
      pages: pages.length,
      passages: count,
    });
    console.info(`${document.title}: ${pages.length} pages, ${count} passages`);
  }

  console.info(
    `\nEmbedding ${built.length} passages with ${EMBEDDING_MODEL.googleId}...`,
  );
  const { embeddings } = await callEmbed(
    { module: 3, feature: "rag-index" },
    built.map((passage) => passage.text),
  );
  if (embeddings.length !== built.length) {
    throw new Error(
      `Got ${embeddings.length} embeddings for ${built.length} passages.`,
    );
  }

  const index: RagIndex = {
    model: EMBEDDING_MODEL.id,
    dimensions: EMBEDDING_MODEL.dimensions,
    builtAt: new Date().toISOString(),
    passages: built.map((passage, i) => ({
      ...passage,
      // Six decimals is far more precision than the search needs and keeps the
      // file roughly half the size.
      embedding: embeddings[i].map((value) => Number(value.toFixed(6))),
    })),
  };

  const out = join(root, "lib", "copper", "data", "rag-index.json");
  writeFileSync(out, `${JSON.stringify(index)}\n`);

  const mb = (readFileSync(out).length / 1_000_000).toFixed(2);
  console.info(`\nSaved lib/copper/data/rag-index.json (${mb} MB)\n`);
  console.table(perDocument);
}

await main();
