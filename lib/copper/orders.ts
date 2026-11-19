// Orders customers can ask to refund (Module 4), and the rule that decides
// what happens to a refund. Plain data and code, so both the server (the
// Refund agent's tools) and the browser (the Refund Console) can use it.
import data from "./data/orders.json";
import { formatUsd } from "./catalog";

export type Order = {
  id: string;
  customer: string;
  /** YYYY-MM-DD */
  date: string;
  items: { name: string; usd: number }[];
  totalUsd: number;
};

/** refunded: the money went back. pending: waiting for a person. rejected: a person said no. */
export type RefundStatus = "refunded" | "pending" | "rejected";

export type Refund = {
  id: string;
  orderId: string;
  customer: string;
  /** What was bought, e.g. "Copper Home, Polished Copper". */
  items: string;
  amountUsd: number;
  reason: string;
  status: RefundStatus;
  /** Who made the final call: the limit check in code, or a person. Null while pending. */
  decidedBy: "code" | "person" | null;
  /** The auto-refund limit when the refund was requested. */
  limitUsd: number;
  /** ISO time. */
  requestedAt: string;
};

/** What the Refund agent needs to know from the Refund Console. */
export type RefundDesk = {
  limitUsd: number;
  refunds: Pick<Refund, "orderId" | "amountUsd" | "status">[];
};

export const DEFAULT_LIMIT_USD = 100;

export const ORDERS: Order[] = data;

const cents = (usd: number) => Math.round(usd * 100) / 100;

/** "CSL-1004", "csl 1004" or "1004" → the order, or undefined. */
export function findOrder(orderId: string): Order | undefined {
  const digits = orderId.match(/\d+/)?.[0];
  return digits ? ORDERS.find((o) => o.id === `CSL-${digits}`) : undefined;
}

/** How much of an order can still be refunded: refunds already made or waiting count against it. */
export function remainingUsd(
  order: Order,
  refunds: RefundDesk["refunds"],
): number {
  const taken = refunds
    .filter((r) => r.orderId === order.id && r.status !== "rejected")
    .reduce((sum, r) => sum + r.amountUsd, 0);
  return Math.max(0, cents(order.totalUsd - taken));
}

/**
 * THE decision made by code: at or under the limit is refunded right away;
 * over it waits for a person in the Refund Console.
 */
export function autoDecision(amountUsd: number, limitUsd: number) {
  return amountUsd <= limitUsd ? "refunded" : "pending";
}

export type LookUpOrderResult =
  | {
      status: "found";
      order: Order;
      refundableUsd: number;
      note: string;
    }
  | { status: "not_found"; message: string };

/** look_up_order: the order and how much of it can still be refunded. */
export function lookUpOrder(
  orderId: string,
  desk: RefundDesk,
): LookUpOrderResult {
  const order = findOrder(orderId);
  if (!order)
    return {
      status: "not_found",
      message: `There is no order ${orderId}. Order numbers look like CSL-1001.`,
    };
  const refundableUsd = remainingUsd(order, desk.refunds);
  return {
    status: "found",
    order,
    refundableUsd,
    note:
      refundableUsd > 0
        ? `${formatUsd(refundableUsd)} of this order can be refunded.`
        : "This order has already been refunded, or a refund for it is waiting for approval.",
  };
}

export type IssueRefundInput = {
  orderId: string;
  amountUsd: number;
  reason: string;
};

export type IssueRefundResult =
  | { status: "ok"; refund: Refund; decision: string }
  | { status: "error"; message: string };

/** issue_refund: checks the request, then lets the limit decide. */
export function issueRefund(
  input: IssueRefundInput,
  desk: RefundDesk,
  made: { id: string; at: string },
): IssueRefundResult {
  const order = findOrder(input.orderId);
  if (!order)
    return { status: "error", message: `There is no order ${input.orderId}.` };
  const remaining = remainingUsd(order, desk.refunds);
  const amountUsd = cents(input.amountUsd);
  if (remaining <= 0)
    return {
      status: "error",
      message: `Order ${order.id} has already been refunded, or a refund for it is waiting for approval.`,
    };
  if (amountUsd <= 0)
    return { status: "error", message: "The amount must be more than $0." };
  if (amountUsd > remaining)
    return {
      status: "error",
      message: `Only ${formatUsd(remaining)} of order ${order.id} can be refunded.`,
    };
  const status = autoDecision(amountUsd, desk.limitUsd);
  return {
    status: "ok",
    refund: {
      id: made.id,
      orderId: order.id,
      customer: order.customer,
      items: order.items.map((i) => i.name).join(" + "),
      amountUsd,
      reason: input.reason,
      status,
      decidedBy: status === "refunded" ? "code" : null,
      limitUsd: desk.limitUsd,
      requestedAt: made.at,
    },
    decision:
      status === "refunded"
        ? `Refunded automatically: ${formatUsd(amountUsd)} is at or under the ${formatUsd(desk.limitUsd)} auto-refund limit.`
        : `Waiting for a person: ${formatUsd(amountUsd)} is over the ${formatUsd(desk.limitUsd)} auto-refund limit, so a person must approve or reject it in the Refund Console.`,
  };
}

/** What Copper tells the customer after a person approves or rejects. */
export function decisionNotice(refund: Refund, approved: boolean): string {
  const amount = formatUsd(refund.amountUsd);
  return approved
    ? `Update on order ${refund.orderId}: a person on our team approved your refund. ${amount} has been refunded to your original payment method.`
    : `Update on order ${refund.orderId}: a person on our team reviewed your refund request and didn't approve it, so the ${amount} was not refunded. If you have questions, contact the Copper Crew in the Copper app (Settings > Help).`;
}
