// Module 4: refunds. Copper hands refund requests to the Refund agent; code
// refunds anything at or under the limit, and a person approves or rejects
// the rest in the Refund Console. Mock models, so no key and no cost.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { LanguageModelV4StreamPart as ModelStreamPart } from "@ai-sdk/provider";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { finalValue } from "@/lib/ai/live";
import {
  autoDecision,
  findOrder,
  issueRefund,
  lookUpOrder,
  type Refund,
  type RefundDesk,
} from "@/lib/copper/orders";
import {
  addRefund,
  clearRefunds,
  getRefundState,
  setLimit,
} from "@/lib/copper/refund-store";

let model: MockLanguageModelV4;
vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: () => () => model,
}));

const usage = {
  inputTokens: {
    total: 300,
    noCache: 300,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 30, text: 30, reasoning: undefined },
};

type Generated = Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>;
type StreamPart = Parameters<
  typeof convertArrayToReadableStream<ModelStreamPart>
>[0][number];

/** One Refund agent step: a tool call, or the final report. */
const agentCalls = (toolName: string, input: unknown): Generated => ({
  content: [
    {
      type: "tool-call",
      toolCallId: `call-${toolName}`,
      toolName,
      input: JSON.stringify(input),
    },
  ],
  finishReason: { unified: "tool-calls", raw: undefined },
  usage,
  warnings: [],
});
const agentSays = (text: string): Generated => ({
  content: [{ type: "text", text }],
  finishReason: { unified: "stop", raw: undefined },
  usage,
  warnings: [],
});

/** Copper (streamed) calls the hand-off tool, then replies. */
const copperCalls = (input: unknown): StreamPart[] => [
  {
    type: "tool-call",
    toolCallId: "handoff-1",
    toolName: "hand_off_to_refund_agent",
    input: JSON.stringify(input),
  },
  {
    type: "finish",
    finishReason: { unified: "tool-calls", raw: undefined },
    usage,
  },
];
const copperSays = (text: string): StreamPart[] => [
  { type: "text-start", id: "t1" },
  { type: "text-delta", id: "t1", delta: text },
  { type: "text-end", id: "t1" },
  { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
];

/** Copper streams `copper`; the Refund agent generates `agent`, step by step. */
function mockModel(copper: StreamPart[][], agent: Generated[]) {
  let streamStep = 0;
  let generateStep = 0;
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: convertArrayToReadableStream(
        copper[streamStep++] ?? copperSays(""),
      ),
    }),
    doGenerate: async () => agent[generateStep++] ?? agentSays(""),
  });
}

const desk = (limitUsd: number, refunds: RefundDesk["refunds"] = []) => ({
  limitUsd,
  refunds,
});
const made = { id: "R-test", at: "2026-11-19T17:00:00.000Z" };

beforeEach(() => {
  vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-key");
  vi.spyOn(console, "info").mockImplementation(() => {});
  localStorage.clear();
  clearRefunds();
  setLimit(100);
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the refund rule (code)", () => {
  it("refunds at or under the limit automatically and holds anything over it for a person", () => {
    expect(autoDecision(99.99, 100)).toBe("refunded");
    expect(autoDecision(100, 100)).toBe("refunded");
    expect(autoDecision(100.01, 100)).toBe("pending");

    const small = issueRefund(
      { orderId: "CSL-1001", amountUsd: 7.99, reason: "Not using it" },
      desk(100),
      made,
    );
    expect(small).toMatchObject({
      status: "ok",
      refund: { status: "refunded", decidedBy: "code", amountUsd: 7.99 },
    });

    const large = issueRefund(
      { orderId: "csl 1004", amountUsd: 149, reason: "Cracked" },
      desk(100),
      made,
    );
    expect(large).toMatchObject({
      status: "ok",
      refund: { orderId: "CSL-1004", status: "pending", decidedBy: null },
    });
  });

  it("won't refund a missing order, more than was paid, or the same order twice", () => {
    expect(findOrder("1003")?.id).toBe("CSL-1003");
    expect(lookUpOrder("CSL-9999", desk(100)).status).toBe("not_found");
    expect(
      issueRefund(
        { orderId: "CSL-1003", amountUsd: 500, reason: "x" },
        desk(1000),
        made,
      ).status,
    ).toBe("error");
    const taken = desk(1000, [
      { orderId: "CSL-1003", amountUsd: 129, status: "pending" },
    ]);
    expect(lookUpOrder("CSL-1003", taken)).toMatchObject({
      status: "found",
      refundableUsd: 0,
    });
    expect(
      issueRefund(
        { orderId: "CSL-1003", amountUsd: 129, reason: "x" },
        taken,
        made,
      ).status,
    ).toBe("error");
    // A rejected refund leaves the money refundable again.
    expect(
      lookUpOrder(
        "CSL-1003",
        desk(1000, [
          { orderId: "CSL-1003", amountUsd: 129, status: "rejected" },
        ]),
      ),
    ).toMatchObject({ refundableUsd: 129 });
  });
});

describe("the Refund agent", () => {
  it("is a separate agent: Copper hands off, the Refund agent looks up the order and issues the refund", async () => {
    model = mockModel(
      [
        copperCalls({ orderId: "CSL-1004", reason: "Arrived cracked" }),
        copperSays("A person on our team will review your $149 refund."),
      ],
      [
        agentCalls("look_up_order", { orderId: "CSL-1004" }),
        agentCalls("issue_refund", {
          orderId: "CSL-1004",
          amountUsd: 149,
          reason: "Arrived cracked",
        }),
        agentSays("CSL-1004: $149 is waiting for a person to approve it."),
      ],
    );
    const { askCopper } = await import("@/lib/copper/assistant/ask");
    const progress = await finalValue(
      (
        await askCopper({
          messages: [{ role: "user", content: "Refund CSL-1004 please" }],
          useTools: true,
          refundDesk: desk(100),
        })
      ).progress,
    );
    const handoff = progress.steps.find(
      (s) => s.type === "tool" && s.name === "hand_off_to_refund_agent",
    );
    expect(handoff).toMatchObject({ state: "done" });
    const output = (handoff as { output: { refund: Refund; steps: unknown[] } })
      .output;
    expect(output.refund).toMatchObject({
      orderId: "CSL-1004",
      amountUsd: 149,
      status: "pending",
    });
    expect(output.steps).toHaveLength(2);
    expect(progress.reply).toContain("review");
    const features = vi
      .mocked(console.info)
      .mock.calls.map(([, row]) => JSON.parse(String(row)).feature);
    expect(features).toEqual(
      expect.arrayContaining(["refund-agent", "ask-copper"]),
    );
  });

  it("is only offered on the Support page", async () => {
    const seen: string[][] = [];
    model = new MockLanguageModelV4({
      doStream: async (options) => {
        seen.push((options.tools ?? []).map((t) => t.name));
        return { stream: convertArrayToReadableStream(copperSays("Hi")) };
      },
    });
    const { askCopper } = await import("@/lib/copper/assistant/ask");
    const ask = (refundDesk?: RefundDesk) =>
      askCopper({
        messages: [{ role: "user", content: "Hi" }],
        useTools: true,
        refundDesk,
      }).then((r) => finalValue(r.progress));
    await ask();
    await ask(desk(50));
    expect(seen[0]).not.toContain("hand_off_to_refund_agent");
    expect(seen[1]).toContain("hand_off_to_refund_agent");
  });
});

const pendingRefund = (orderId: string, amountUsd: number): Refund => ({
  id: `R-${orderId}`,
  orderId,
  customer: "Test Customer",
  items: "Copper Home, Polished Copper",
  amountUsd,
  reason: "Arrived cracked",
  status: "pending",
  decidedBy: null,
  limitUsd: 100,
  requestedAt: "2026-11-19T17:00:00.000Z",
});

describe("the Refund Console", () => {
  async function renderSupport() {
    const { default: Support } = await import("@/app/support/page");
    render(<Support />);
    return {
      console: within(screen.getByTestId("refund-console")),
      chat: within(await screen.findByTestId("ask-copper")),
    };
  }

  it("shows the orders and lets you change the auto-refund limit", async () => {
    const { console } = await renderSupport();
    expect(
      within(console.getByTestId("orders")).getByText("CSL-1005"),
    ).toBeVisible();
    fireEvent.change(console.getByLabelText(/New limit/), {
      target: { value: "200" },
    });
    fireEvent.click(console.getByRole("button", { name: "Save limit" }));
    expect(getRefundState().limitUsd).toBe(200);
    expect(
      within(console.getByTestId("refund-limit")).getByText("$200"),
    ).toBeVisible();
  });

  it("Approve refunds it, and Copper tells the customer in the chat", async () => {
    const { console, chat } = await renderSupport();
    act(() => addRefund(pendingRefund("CSL-1004", 149)));
    const card = within(console.getByTestId("pending-refund"));
    fireEvent.click(card.getByRole("button", { name: "Approve" }));
    expect(getRefundState().refunds[0]).toMatchObject({
      status: "refunded",
      decidedBy: "person",
    });
    expect(console.queryByTestId("pending-refund")).toBeNull();
    expect(chat.getByTestId("refund-update")).toHaveTextContent(
      /approved your refund. \$149 has been refunded/,
    );
  });

  it("Reject keeps the money, and Copper tells the customer in the chat", async () => {
    const { console, chat } = await renderSupport();
    act(() => addRefund(pendingRefund("CSL-1005", 278)));
    fireEvent.click(
      within(console.getByTestId("pending-refund")).getByRole("button", {
        name: "Reject",
      }),
    );
    expect(getRefundState().refunds[0]).toMatchObject({
      status: "rejected",
      decidedBy: "person",
    });
    expect(chat.getByTestId("refund-update")).toHaveTextContent(
      /didn't approve it, so the \$278 was not refunded/,
    );
  });
});

describe("routing a refund request (code, not the model)", () => {
  it("spots a refund request that names an order", async () => {
    const { isRefundRequest } = await import("@/lib/copper/orders");
    expect(
      isRefundRequest(
        "I'd like a refund for order CSL-1001. I don't use Copper Plus anymore.",
      ),
    ).toBe(true);
    expect(isRefundRequest("Please refund order csl 1004")).toBe(true);
    expect(isRefundRequest("What is your refund policy?")).toBe(false);
    expect(isRefundRequest("Where is order CSL-1004?")).toBe(false);
  });

  it("forces the hand-off as Copper's first step on the Support page", async () => {
    const choices: unknown[] = [];
    let step = 0;
    model = new MockLanguageModelV4({
      doStream: async (options) => {
        choices.push(options.toolChoice);
        return {
          stream: convertArrayToReadableStream(
            step++ === 0
              ? copperCalls({ orderId: "CSL-1001", reason: "Not using it" })
              : copperSays("Refunded."),
          ),
        };
      },
      doGenerate: async () => agentSays("Done."),
    });
    const { askCopper } = await import("@/lib/copper/assistant/ask");
    await finalValue(
      (
        await askCopper({
          messages: [
            { role: "user", content: "I'd like a refund for order CSL-1001." },
          ],
          useTools: true,
          refundDesk: desk(100),
        })
      ).progress,
    );
    expect(choices[0]).toEqual({
      type: "tool",
      toolName: "hand_off_to_refund_agent",
    });
    expect(choices[1]).not.toEqual(choices[0]);
  });
});
