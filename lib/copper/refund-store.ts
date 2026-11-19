// The Refund Console's state in the browser: the auto-refund limit and every
// refund so far. The chat panel and the console share it, and it's saved in
// localStorage so a page reload keeps it. When a person approves or rejects a
// refund, the chat hears about it through onNotice() and tells the customer.
import { useSyncExternalStore } from "react";
import {
  decisionNotice,
  DEFAULT_LIMIT_USD,
  type Refund,
  type RefundDesk,
} from "./orders";

export type RefundState = { limitUsd: number; refunds: Refund[] };

const KEY = "copper-refund-console";
const START: RefundState = { limitUsd: DEFAULT_LIMIT_USD, refunds: [] };

let state: RefundState = START;
let loaded = false;
const listeners = new Set<() => void>();
const noticeListeners = new Set<(text: string) => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (
      saved &&
      typeof saved.limitUsd === "number" &&
      Array.isArray(saved.refunds)
    )
      state = { limitUsd: saved.limitUsd, refunds: saved.refunds };
  } catch {
    // Nothing saved, or storage is blocked: start fresh.
  }
}

function save(next: RefundState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: it still works until the page reloads.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRefundState(): RefundState {
  load();
  return state;
}

/** The limit and refunds, kept up to date in a component. */
export function useRefundState(): RefundState {
  return useSyncExternalStore(subscribe, getRefundState, () => START);
}

/** What the server's Refund agent needs from here. */
export function refundDesk(): RefundDesk {
  const { limitUsd, refunds } = getRefundState();
  return {
    limitUsd,
    refunds: refunds.map(({ orderId, amountUsd, status }) => ({
      orderId,
      amountUsd,
      status,
    })),
  };
}

export function setLimit(limitUsd: number) {
  save({ ...getRefundState(), limitUsd });
}

/** Adds a refund the Refund agent made (once, even if seen twice). */
export function addRefund(refund: Refund) {
  const current = getRefundState();
  if (current.refunds.some((r) => r.id === refund.id)) return;
  save({ ...current, refunds: [refund, ...current.refunds] });
}

/** A person approves or rejects a refund that was waiting; the chat tells the customer. */
export function decideRefund(id: string, approved: boolean) {
  const current = getRefundState();
  const refund = current.refunds.find((r) => r.id === id);
  if (!refund || refund.status !== "pending") return;
  const decided: Refund = {
    ...refund,
    status: approved ? "refunded" : "rejected",
    decidedBy: "person",
  };
  save({
    ...current,
    refunds: current.refunds.map((r) => (r.id === id ? decided : r)),
  });
  const text = decisionNotice(decided, approved);
  noticeListeners.forEach((listener) => listener(text));
}

/** Clears every refund (keeps the limit), to run the demo again. */
export function clearRefunds() {
  save({ ...getRefundState(), refunds: [] });
}

/** Calls `listener` with a message for the customer after each decision. */
export function onNotice(listener: (text: string) => void) {
  noticeListeners.add(listener);
  return () => {
    noticeListeners.delete(listener);
  };
}
