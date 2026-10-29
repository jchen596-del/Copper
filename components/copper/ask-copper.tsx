"use client";

// Ask Copper: the floating chat panel. Tools on and tools off are two separate
// conversations, so the tools-off model can't copy an answer the tools worked
// out. The server action streams each step back as a live value.
import { ArrowUpIcon, MessageCircleIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { SetupRequired } from "@/components/setup-required";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { askCopper } from "@/lib/copper/assistant/ask";
import { readLive } from "@/lib/ai/live";
import type { Progress } from "@/lib/copper/assistant/progress";
import { Answer } from "@/components/copper/ask-copper-steps";

const STARTERS = [
  "How much is Copper Home with Copper Plus, paid yearly, for 2 years?",
  "Is Copper Notes in Night Sky in stock?",
  "Is Copper Plus cheaper monthly or yearly?",
];

type Turn = { id: number; question: string; progress: Progress };
type Chats = { on: Turn[]; off: Turn[] };

const SORRY: Progress = {
  steps: [],
  reply: "Sorry, I couldn't answer that just now. Please try again.",
  status: "error",
};

export function AskCopper({ aiConfigured }: { aiConfigured: boolean }) {
  const [open, setOpen] = useState(false);
  const [useTools, setUseTools] = useState(true);
  const [chats, setChats] = useState<Chats>({ on: [], off: [] });
  const [input, setInput] = useState("");
  const nextId = useRef(0);
  const body = useRef<HTMLDivElement>(null);

  // Open from the header link, or when the site loads at /#ask. Clicking the
  // link again fires no hashchange, so listen for the click too.
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === "#ask") setOpen(true);
    };
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.('a[href$="#ask"]');
      if (link) setOpen(true);
    };
    // A site loaded at /#ask opens on the first tick after mounting.
    const first = setTimeout(onHash, 0);
    window.addEventListener("hashchange", onHash);
    document.addEventListener("click", onClick);
    return () => {
      clearTimeout(first);
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onClick);
    };
  }, []);

  const mode = useTools ? "on" : "off";
  const chat = chats[mode];
  const working = chat.some((turn) => turn.progress.status === "working");

  // Keep the newest step in view as the answer streams in.
  useEffect(() => {
    body.current?.scrollTo?.({ top: body.current.scrollHeight });
  }, [chats, mode]);

  function setOpenState(next: boolean) {
    setOpen(next);
    if (!next && window.location.hash === "#ask")
      window.history.replaceState(null, "", window.location.pathname);
  }

  function update(chatMode: keyof Chats, id: number, progress: Progress) {
    setChats((all) => ({
      ...all,
      [chatMode]: all[chatMode].map((turn) =>
        turn.id === id ? { ...turn, progress } : turn,
      ),
    }));
  }

  async function send(question: string) {
    const text = question.trim();
    if (!text || working) return;
    const chatMode = mode;
    const tools = useTools;
    // Each chat sends only its own finished turns.
    const history = chat
      .filter((turn) => turn.progress.status === "done")
      .flatMap((turn) => [
        { role: "user" as const, content: turn.question },
        { role: "assistant" as const, content: turn.progress.reply },
      ]);
    const id = nextId.current++;
    setChats((all) => ({
      ...all,
      [chatMode]: [
        ...all[chatMode],
        {
          id,
          question: text,
          progress: { steps: [], reply: "", status: "working" },
        },
      ],
    }));
    setInput("");
    try {
      const { progress } = await askCopper({
        messages: [...history, { role: "user", content: text }],
        useTools: tools,
      });
      for await (const value of readLive(progress)) update(chatMode, id, value);
    } catch {
      update(chatMode, id, SORRY);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  return (
    <>
      <Button
        type="button"
        data-testid="ask-copper-launcher"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-40 h-12 gap-2 rounded-full px-5 shadow-lg"
      >
        <MessageCircleIcon />
        Ask Copper
      </Button>

      <Sheet open={open} onOpenChange={setOpenState}>
        <SheetContent
          data-testid="ask-copper"
          showCloseButton={false}
          className="data-[side=right]:sm:max-w-lg data-[side=right]:w-full gap-0 p-0"
        >
          <div className="bg-chart-5 text-secondary">
            <div className="flex items-center gap-3 p-4">
              <span className="bg-primary relative size-10 shrink-0 overflow-hidden rounded-full">
                <Image
                  src="/assets/brand/copper-mascot.png"
                  alt=""
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              </span>
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-secondary">Ask Copper</SheetTitle>
                <SheetDescription className="text-secondary/70 text-xs">
                  Prices, totals and stock, checked with tools.
                </SheetDescription>
              </div>
              <SheetClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="hover:text-secondary text-secondary hover:bg-white/10"
                >
                  <XIcon />
                  <span className="sr-only">Close</span>
                </Button>
              </SheetClose>
            </div>
            <div className="flex items-center gap-3 bg-white/10 px-4 py-2">
              <span className="text-sm font-medium">Use tools</span>
              <span className="text-secondary/70 flex-1 text-xs">
                {useTools ? "Checks every answer" : "Model guesses alone"}
              </span>
              <Switch
                aria-label="Use tools"
                checked={useTools}
                onCheckedChange={setUseTools}
              />
            </div>
          </div>

          {aiConfigured ? (
            <>
              <div
                ref={body}
                className="bg-secondary min-h-0 flex-1 space-y-5 overflow-y-auto p-4"
              >
                {chat.length === 0 && (
                  <p className="text-muted-foreground text-sm">
                    Ask about Copper products, prices, totals and stock.
                  </p>
                )}
                {chat.map((turn) => (
                  <div key={turn.id} className="space-y-3">
                    <div className="bg-card ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm border px-3 py-2 text-sm">
                      {turn.question}
                    </div>
                    <Answer progress={turn.progress} useTools={useTools} />
                  </div>
                ))}
                {!working && (
                  <div className="flex flex-col items-start gap-2">
                    {STARTERS.map((starter) => (
                      <Button
                        key={starter}
                        type="button"
                        variant="outline"
                        onClick={() => void send(starter)}
                        className="bg-card h-auto rounded-xl px-3 py-2 text-left text-sm whitespace-normal"
                      >
                        {starter}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              <form
                onSubmit={onSubmit}
                className="bg-background flex items-center gap-2 border-t p-3"
              >
                <Input
                  aria-label="Your question"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask about prices or stock…"
                  className="h-10 rounded-full px-4"
                />
                <Button
                  type="submit"
                  aria-label="Send"
                  size="icon"
                  disabled={working || input.trim() === ""}
                  className="size-10 shrink-0 rounded-full"
                >
                  <ArrowUpIcon />
                </Button>
              </form>
            </>
          ) : (
            <div className="bg-secondary flex-1 overflow-y-auto p-4">
              <SetupRequired service="ai" />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
