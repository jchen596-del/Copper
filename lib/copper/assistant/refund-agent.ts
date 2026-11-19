// The Refund agent (Module 4): a second AI agent with its own instructions and
// tools. Copper doesn't refund anything itself. It hands the request over
// with hand_off_to_refund_agent, the Refund agent looks up the order and
// issues the refund, and its report goes back to Copper.
//
// Who decides what:
// - The Refund agent (AI) reads the request and fills in the order and amount.
// - issue_refund (code) compares the amount with the auto-refund limit.
// - A person approves or rejects anything over the limit in the Refund Console.
import { hasToolCall, stepCountIs, tool } from "ai";
import { z } from "zod";
import { callText } from "@/lib/ai/call";
import { formatUsd } from "@/lib/copper/catalog";
import {
  issueRefund,
  type IssueRefundResult,
  lookUpOrder,
  type Refund,
  type RefundDesk,
} from "@/lib/copper/orders";

export const REFUND_AGENT_INSTRUCTIONS = `You are the Refund agent for Copper State Labs.
Copper, the customer chat assistant, hands you one refund request at a time. You never talk to the customer: you do the work and report back to Copper.

1. Always call look_up_order first.
2. If the order isn't found, or nothing is left to refund, don't call issue_refund. Report why.
3. Otherwise call issue_refund once. Use the amount the customer asked for; if they didn't name one, use the order's refundableUsd (the whole remaining amount).
4. issue_refund decides by itself whether the money goes back now or waits for a person to approve it. Never decide that yourself, and never say a refund went through unless issue_refund says so.

Then report back in one or two plain sentences: the order, the amount, and exactly what issue_refund decided.`;

/** One tool call the Refund agent made, for the chat to show. */
export type RefundAgentStep = { tool: string; input: unknown; output: unknown };

export type RefundAgentReport = {
  /** The Refund agent's report to Copper. */
  report: string;
  /** The refund it created, if any (the Refund Console picks it up). */
  refund: Refund | null;
  steps: RefundAgentStep[];
};

export type RefundRequest = {
  orderId: string;
  amountUsd?: number;
  reason: string;
};

/** Runs the Refund agent on one request. */
export async function runRefundAgent(
  request: RefundRequest,
  desk: RefundDesk,
): Promise<RefundAgentReport> {
  const made: { refund: Refund | null } = { refund: null };
  const steps: RefundAgentStep[] = [];
  const record = <T>(name: string, input: unknown, output: T): T => {
    steps.push({ tool: name, input, output });
    return output;
  };

  const tools = {
    look_up_order: tool({
      description:
        "Looks up an order: who bought it, what, when, the total, and how much can still be refunded (refundableUsd).",
      inputSchema: z.object({
        orderId: z.string().min(1).describe("The order number, like CSL-1004."),
      }),
      execute: async ({ orderId }) =>
        record("look_up_order", { orderId }, lookUpOrder(orderId, desk)),
    }),
    issue_refund: tool({
      description:
        "Issues a refund on an order. Code then compares the amount with the auto-refund limit: at or under it, the money goes back now; over it, the refund waits for a person to approve or reject it.",
      inputSchema: z.object({
        orderId: z.string().min(1),
        amountUsd: z
          .number()
          .positive()
          .describe("How much to refund, in US dollars."),
        reason: z
          .string()
          .min(1)
          .describe("Why the customer wants the refund."),
      }),
      execute: async (input) => {
        if (made.refund)
          return record("issue_refund", input, {
            status: "error" as const,
            message: "A refund was already issued for this request.",
          });
        const result = issueRefund(input, desk, {
          id: `R-${crypto.randomUUID().slice(0, 8)}`,
          at: new Date().toISOString(),
        });
        if (result.status === "ok") made.refund = result.refund;
        return record("issue_refund", input, result);
      },
    }),
  };

  const amount =
    request.amountUsd === undefined
      ? "not named (refund the whole remaining amount)"
      : formatUsd(request.amountUsd);
  const { text } = await callText(
    { module: 4, feature: "refund-agent" },
    {
      instructions: REFUND_AGENT_INSTRUCTIONS,
      prompt: `Refund request from Copper.\nOrder: ${request.orderId}\nAmount: ${amount}\nCustomer's reason: ${request.reason}`,
      tools,
      // Stop as soon as the refund is issued: the code's decision is the
      // report, which saves a model call (the free tier allows few a day).
      stopWhen: [hasToolCall("issue_refund"), stepCountIs(4)],
    },
  );

  const refund = made.refund as Refund | null;
  const issued = steps.findLast((s) => s.tool === "issue_refund")?.output as
    IssueRefundResult | undefined;
  const report =
    issued?.status === "ok"
      ? `Order ${issued.refund.orderId}, ${formatUsd(issued.refund.amountUsd)}. ${issued.decision}`
      : issued?.status === "error"
        ? `No refund issued: ${issued.message}`
        : text.trim() ||
          "The Refund agent couldn't issue a refund for this request.";
  return { report, refund, steps };
}

const deskSchema = z.object({
  limitUsd: z.number().min(0).max(100_000),
  refunds: z
    .array(
      z.object({
        orderId: z.string(),
        amountUsd: z.number(),
        status: z.enum(["refunded", "pending", "rejected"]),
      }),
    )
    .max(500),
});

/** Checks what the browser sent, so a bad value can't reach the tools. */
export function parseDesk(desk: unknown): RefundDesk | null {
  const parsed = deskSchema.safeParse(desk);
  return parsed.success ? parsed.data : null;
}

/** Copper's tool for handing a refund request to the Refund agent. */
export function refundHandoffTools(desk: RefundDesk) {
  return {
    hand_off_to_refund_agent: tool({
      description:
        "Hands a customer's refund request to the Refund agent, a separate AI agent that looks up the order and issues the refund. Refunds at or under the auto-refund limit go through right away; larger ones wait for a person to approve or reject them in the Refund Console. Returns the Refund agent's report and the refund it made, if any.",
      inputSchema: z.object({
        orderId: z.string().min(1).describe("The order number, like CSL-1004."),
        amountUsd: z
          .number()
          .positive()
          .optional()
          .describe(
            "Only if the customer asked for a specific amount; leave out to refund the whole order.",
          ),
        reason: z
          .string()
          .min(1)
          .describe("Why the customer wants a refund, in their words."),
      }),
      execute: async (input) => runRefundAgent(input, desk),
    }),
  };
}
