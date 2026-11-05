// A lab page for seeing the document search index work: type a question and
// see which passages come back and how close each one scored. It's here to
// make embeddings visible, not to answer customers — that belongs in Ask
// Copper as a tool.
import { FileTextIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { SetupRequired } from "@/components/setup-required";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { callEmbed, isAiConfigured } from "@/lib/ai/call";
import { DOCUMENTS } from "@/lib/copper/documents";
import { passageCounts, RAG_INDEX, searchPassages } from "@/lib/copper/rag";

export const metadata = {
  title: "Document search",
  description: "Search Copper's customer documents by meaning.",
};

const EXAMPLES = [
  "How long is the warranty?",
  "Can I cancel Copper Plus and get a refund?",
  "How do I pair Copper Notes with my phone?",
  "What does Copper do with my recordings?",
];

export default function DocumentSearchPage({
  searchParams,
}: PageProps<"/rag">) {
  const counts = passageCounts();
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        &larr; Back to Copper State Labs
      </Link>

      <h1 className="font-heading mt-4 text-3xl font-bold sm:text-4xl">
        Document search
      </h1>
      <p className="text-muted-foreground mt-3 text-lg">
        Copper&apos;s {counts.length} customer documents are split into{" "}
        {RAG_INDEX.count} passages. Each one was turned into a list of{" "}
        {RAG_INDEX.dimensions} numbers that stands for its meaning, so a
        question can find the right passage even when they share no words.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {counts.map((row) => (
          <Badge key={row.documentTitle} variant="secondary">
            {row.documentTitle}: {row.passages}
          </Badge>
        ))}
      </div>

      <Suspense fallback={<SearchSkeleton />}>
        <Search searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function SearchSkeleton() {
  return (
    <div className="mt-8 space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}

/**
 * The form and its results both depend on the request (the question comes in
 * as `?q=`, and answering it calls the model), so they live behind Suspense
 * while the rest of the page prerenders.
 */
async function Search({
  searchParams,
}: Pick<PageProps<"/rag">, "searchParams">) {
  await connection();
  const { q } = await searchParams;
  const question = (typeof q === "string" ? q : "").trim();

  return (
    <>
      <form method="get" className="mt-8 flex gap-2">
        <Input
          name="q"
          defaultValue={question}
          placeholder="Ask something about Copper's products or terms..."
          aria-label="Your question"
          autoFocus
        />
        <Button type="submit">
          <SearchIcon aria-hidden className="size-4" />
          Search
        </Button>
      </form>

      {question ? (
        <Matches question={question} />
      ) : (
        <div className="mt-8">
          <p className="text-muted-foreground text-sm">
            Try one of these, or type your own:
          </p>
          <ul className="mt-3 space-y-2">
            {EXAMPLES.map((example) => (
              <li key={example}>
                <Link
                  href={{ pathname: "/rag", query: { q: example } }}
                  className="text-primary text-sm underline underline-offset-4"
                >
                  {example}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

async function Matches({ question }: { question: string }) {
  if (!isAiConfigured()) return <SetupRequired service="ai" />;

  // The question is embedded as a query, not as a document: Gemini places the
  // two slightly differently, and saying which is which improves the match.
  const { embeddings } = await callEmbed(
    { module: 3, feature: "rag-search" },
    [question],
    "RETRIEVAL_QUERY",
  );
  const matches = searchPassages(embeddings[0], 5);

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-muted-foreground text-sm">
        Closest passages to &ldquo;{question}&rdquo;
      </h2>
      {matches.map((match) => {
        const document = DOCUMENTS.find((d) => d.id === match.documentId);
        // Every passage is stored with its title in front; that repeats the
        // heading above it, so show just the passage here.
        const text = match.text
          .slice(match.documentTitle.length)
          .replace(/^\.\s*/, "");
        return (
          <Card key={match.id}>
            <CardHeader className="gap-1">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <FileTextIcon aria-hidden className="size-4 shrink-0" />
                {document ? (
                  <Link
                    href={`${document.file}#page=${match.page}`}
                    className="underline underline-offset-4"
                  >
                    {match.documentTitle}
                  </Link>
                ) : (
                  match.documentTitle
                )}
                <span className="text-muted-foreground font-normal">
                  page {match.page}
                </span>
                <Badge variant="outline" className="ml-auto font-mono">
                  {match.score.toFixed(3)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed">
              {text}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
