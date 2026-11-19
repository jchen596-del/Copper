"use client";

// The Refund Console (Module 4): the auto-refund limit, the refunds waiting
// for a person, and every order and refund so far. Refunds arrive from the
// chat beside it, where Copper hands them to the Refund agent.
import { CheckIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatUsd } from "@/lib/copper/catalog";
import { ORDERS, type Refund } from "@/lib/copper/orders";
import {
  clearRefunds,
  decideRefund,
  setLimit,
  useRefundState,
} from "@/lib/copper/refund-store";
import { cn } from "@/lib/utils";

const STATUS: Record<Refund["status"], { label: string; className: string }> = {
  refunded: { label: "Refunded", className: "bg-accent text-white" },
  pending: { label: "Waiting", className: "bg-chart-4 text-chart-5" },
  rejected: { label: "Rejected", className: "bg-chart-3 text-white" },
};

function StatusBadge({ status }: { status: Refund["status"] }) {
  return (
    <Badge className={STATUS[status].className}>{STATUS[status].label}</Badge>
  );
}

function decidedBy(refund: Refund) {
  if (refund.decidedBy === "code")
    return `Code: at or under the ${formatUsd(refund.limitUsd)} limit`;
  if (refund.decidedBy === "person")
    return refund.status === "refunded"
      ? "A person approved"
      : "A person rejected";
  return `Over the ${formatUsd(refund.limitUsd)} limit`;
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

export function RefundConsole() {
  const { limitUsd, refunds } = useRefundState();
  const pending = refunds.filter((r) => r.status === "pending");

  return (
    <div className="mt-6 space-y-6">
      <p className="text-muted-foreground">
        Customers ask Copper for refunds in the chat. Copper hands each one to
        the <strong className="text-foreground">Refund agent</strong>. Refunds
        at or under the limit go through automatically; bigger ones wait here
        for you.
      </p>

      <LimitCard limitUsd={limitUsd} />

      <Card data-testid="approval-queue">
        <CardHeader>
          <CardTitle>Waiting for approval ({pending.length})</CardTitle>
          <CardDescription>
            Over the auto-refund limit, so a person decides.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pending.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing waiting. Refunds over {formatUsd(limitUsd)} show up here.
            </p>
          ) : (
            pending.map((refund) => (
              <div
                key={refund.id}
                data-testid="pending-refund"
                className="border-chart-4 bg-chart-4/10 flex flex-wrap items-center gap-4 rounded-xl border-2 p-4"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-semibold">
                    {refund.orderId} · {refund.customer}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {refund.items}
                  </p>
                  <p className="text-sm">
                    &ldquo;{refund.reason}&rdquo;{" "}
                    <span className="text-muted-foreground">
                      · {time(refund.requestedAt)}
                    </span>
                  </p>
                </div>
                <p className="text-2xl font-bold">
                  {formatUsd(refund.amountUsd)}
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => decideRefund(refund.id, true)}>
                    <CheckIcon /> Approve
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => decideRefund(refund.id, false)}
                  >
                    <XIcon /> Reject
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
          <CardDescription>
            Ask Copper to refund any of these by its order number.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table data-testid="orders">
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Refund</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ORDERS.map((order) => {
                const refund = refunds.find((r) => r.orderId === order.id);
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono">{order.id}</TableCell>
                    <TableCell>{order.customer}</TableCell>
                    <TableCell className="max-w-48 truncate">
                      {order.items.map((i) => i.name).join(" + ")}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatUsd(order.totalUsd)}
                    </TableCell>
                    <TableCell>
                      {refund ? (
                        <StatusBadge status={refund.status} />
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Refund history</CardTitle>
          <CardDescription>Every refund, and who decided it.</CardDescription>
          {refunds.length > 0 && (
            <CardAction>
              <Button variant="ghost" size="sm" onClick={clearRefunds}>
                <RotateCcwIcon /> Clear
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {refunds.length === 0 ? (
            <p className="text-muted-foreground text-sm">No refunds yet.</p>
          ) : (
            <Table data-testid="refund-history">
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Decided by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {refunds.map((refund) => (
                  <TableRow key={refund.id}>
                    <TableCell className="font-mono">
                      {refund.orderId}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatUsd(refund.amountUsd)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={refund.status} />
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-sm",
                        refund.decidedBy === null && "text-muted-foreground",
                      )}
                    >
                      {decidedBy(refund)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LimitCard({ limitUsd }: { limitUsd: number }) {
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? String(limitUsd);
  const amount = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(amount) && amount >= 0;
  return (
    <Card data-testid="refund-limit">
      <CardHeader>
        <CardTitle>Auto-refund limit</CardTitle>
        <CardDescription>
          Code checks every refund against this. At or under it: refunded
          automatically. Over it: waits for a person.
        </CardDescription>
        <CardAction>
          <span className="text-primary text-3xl font-bold">
            {formatUsd(limitUsd)}
          </span>
        </CardAction>
      </CardHeader>
      <CardContent>
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!valid) return;
            setLimit(Math.round(amount * 100) / 100);
            setDraft(null);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="refund-limit">New limit (US dollars)</Label>
            <Input
              id="refund-limit"
              type="number"
              min={0}
              step="0.01"
              value={value}
              onChange={(event) => setDraft(event.target.value)}
              className="w-36"
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            disabled={!valid || amount === limitUsd}
          >
            Save limit
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
