"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TigerPayStatusBadge } from "@/components/bank/TigerPayStatusBadge";
import {
  asString,
  buildLifecycleSummary,
  displayValue,
  formatBaht,
  formatBangkokDateTime,
  formatPaymentType,
  getUnknown,
  isRecord,
  maskAccountValue,
  prettyJson,
  redactSensitive,
  shortId,
  getTigerPayEventTitle,
} from "@/lib/bank/tiger-pay-format";
import type {
  TigerPayTransaction,
  TigerPayWebhookEvent,
} from "@/lib/bank/tiger-pay-types";

type ListRow = Omit<TigerPayTransaction, "payload">;

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm break-words">{value}</div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function JsonViewer({ value, collapsedDefault = true }: { value: unknown; collapsedDefault?: boolean }) {
  const [collapsed, setCollapsed] = useState(collapsedDefault);
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => prettyJson(redactSensitive(value)), [value]);

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard failures
    }
  }

  return (
    <div className="rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          {collapsed ? "Show JSON" : "Hide JSON"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={copyJson}
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          Copy JSON
        </Button>
      </div>
      {!collapsed && (
        <div className="max-h-[40vh] overflow-auto sm:max-h-[320px]">
          <pre className="min-w-0 p-3 text-xs whitespace-pre-wrap break-all sm:whitespace-pre sm:break-normal">
            {text}
          </pre>
        </div>
      )}
    </div>
  );
}

function CashDetails({ payment }: { payment: unknown }) {
  const cashList = getUnknown(payment, "cashList");
  const change = getUnknown(payment, "change");
  const list = Array.isArray(cashList) ? cashList : [];

  return (
    <div className="grid gap-4">
      <Section title="Cash inserted">
        {list.length === 0 ? (
          <div className="text-sm text-muted-foreground sm:col-span-2">
            No cash insertion details
          </div>
        ) : (
          list.map((item, index) => (
            <div
              key={index}
              className="rounded-md border p-3 grid gap-2 sm:col-span-2"
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <Field
                  label="Denomination"
                  value={formatBaht(
                    asString(getUnknown(item, "value")) ??
                      asString(getUnknown(item, "denomination"))
                  )}
                />
                <Field
                  label="Quantity"
                  value={displayValue(
                    getUnknown(item, "amount") ?? getUnknown(item, "quantity")
                  )}
                />
                <Field
                  label="Inserted time"
                  value={formatBangkokDateTime(
                    asString(getUnknown(item, "insertedTime")) ??
                      asString(getUnknown(item, "inserted_at"))
                  )}
                />
              </div>
            </div>
          ))
        )}
      </Section>

      {change !== undefined && change !== null && (
        <Section title="Change">
          <Field
            label="Change transaction number"
            value={displayValue(
              getUnknown(change, "changeTxnNo") ??
                getUnknown(change, "transactionNo")
            )}
          />
          <Field
            label="Required change"
            value={formatBaht(
              asString(getUnknown(change, "requiredChange")) ??
                asString(getUnknown(change, "required"))
            )}
          />
          <Field
            label="Dispensed change"
            value={formatBaht(
              asString(getUnknown(change, "dispensedChange")) ??
                asString(getUnknown(change, "dispensed"))
            )}
          />
          <div className="sm:col-span-2 grid gap-2">
            <div className="text-xs text-muted-foreground">
              Change denominations
            </div>
            {Array.isArray(getUnknown(change, "changeList")) ||
            Array.isArray(getUnknown(change, "denominationList")) ? (
              (
                (getUnknown(change, "changeList") as unknown[]) ||
                (getUnknown(change, "denominationList") as unknown[])
              ).map((item, index) => (
                <div key={index} className="text-sm">
                  {formatBaht(
                    asString(getUnknown(item, "value")) ??
                      asString(getUnknown(item, "denomination"))
                  )}{" "}
                  ×{" "}
                  {displayValue(
                    getUnknown(item, "amount") ?? getUnknown(item, "quantity")
                  )}
                </div>
              ))
            ) : (
              <div className="text-sm">—</div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

function PromptPayDetails({ payment }: { payment: unknown }) {
  const promptPay = getUnknown(payment, "promptPay");
  const account = getUnknown(promptPay, "account");
  const approver = getUnknown(promptPay, "approver");

  if (promptPay === undefined || promptPay === null) {
    return (
      <div className="text-sm text-muted-foreground">
        No PromptPay details available
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <Section title="PromptPay transfer">
        <Field
          label="Transaction ID"
          value={displayValue(getUnknown(promptPay, "transactionId"))}
        />
        <Field
          label="Status"
          value={displayValue(getUnknown(promptPay, "status"))}
        />
        <Field
          label="Amount"
          value={formatBaht(asString(getUnknown(promptPay, "amount")))}
        />
        <Field
          label="Reference 1"
          value={displayValue(getUnknown(promptPay, "refNo1"))}
        />
        <Field
          label="Reference 2"
          value={displayValue(getUnknown(promptPay, "refNo2"))}
        />
        <Field
          label="Note"
          value={displayValue(getUnknown(promptPay, "note"))}
        />
        <Field
          label="Transferred time"
          value={formatBangkokDateTime(
            asString(getUnknown(promptPay, "transferredTime"))
          )}
        />
        <Field
          label="Approved time"
          value={formatBangkokDateTime(
            asString(getUnknown(promptPay, "approvedTime"))
          )}
        />
      </Section>

      <Section title="Account">
        <Field
          label="Account name"
          value={displayValue(getUnknown(account, "accountName"))}
        />
        <Field
          label="Account number"
          value={maskAccountValue(
            getUnknown(account, "accountNo") ??
              getUnknown(account, "accountNumber")
          )}
        />
        <Field
          label="Account type"
          value={displayValue(getUnknown(account, "accountType"))}
        />
        <Field
          label="Tag ID"
          value={displayValue(getUnknown(account, "tagId"))}
        />
        <Field
          label="Bank name"
          value={displayValue(getUnknown(account, "bankName"))}
        />
        <Field
          label="Bank code"
          value={displayValue(getUnknown(account, "bankCode"))}
        />
        <Field
          label="Bank symbol"
          value={displayValue(getUnknown(account, "bankSymbol"))}
        />
      </Section>

      <Section title="Approver">
        <Field
          label="Role"
          value={displayValue(getUnknown(approver, "role"))}
        />
        <Field
          label="Username"
          value={displayValue(getUnknown(approver, "username"))}
        />
        <Field
          label="First name"
          value={displayValue(getUnknown(approver, "firstName"))}
        />
        <Field
          label="Last name"
          value={displayValue(getUnknown(approver, "lastName"))}
        />
      </Section>
    </div>
  );
}

function DynamicQrDetails({ payment }: { payment: unknown }) {
  const dynamicQR = getUnknown(payment, "dynamicQR");
  if (dynamicQR === undefined || dynamicQR === null) {
    return (
      <div className="text-sm text-muted-foreground">
        No Dynamic QR details available
      </div>
    );
  }

  const qrImageOmitted = Boolean(getUnknown(dynamicQR, "qrImageOmitted"));

  return (
    <div className="grid gap-4">
      <Section title="Dynamic QR">
        <Field
          label="Transaction ID"
          value={displayValue(getUnknown(dynamicQR, "transactionId"))}
        />
        <Field
          label="Reference 1"
          value={displayValue(getUnknown(dynamicQR, "refNo1"))}
        />
        <Field
          label="Reference 2"
          value={displayValue(getUnknown(dynamicQR, "refNo2"))}
        />
        <Field
          label="QR status"
          value={displayValue(getUnknown(dynamicQR, "qrStatus") ?? getUnknown(dynamicQR, "status"))}
        />
        <Field
          label="Requested amount"
          value={formatBaht(asString(getUnknown(dynamicQR, "requestedAmount")))}
        />
        <Field
          label="Actual paid amount"
          value={formatBaht(asString(getUnknown(dynamicQR, "actualPaidAmount")))}
        />
        <Field
          label="Payer name"
          value={displayValue(getUnknown(dynamicQR, "payerName"))}
        />
        <Field
          label="Payer account"
          value={maskAccountValue(
            getUnknown(dynamicQR, "payerAccountNo") ??
              getUnknown(dynamicQR, "payerAccountNumber")
          )}
        />
        <Field
          label="Sending bank"
          value={displayValue(getUnknown(dynamicQR, "sendingBank"))}
        />
        <Field
          label="Created time"
          value={formatBangkokDateTime(
            asString(getUnknown(dynamicQR, "createdTime"))
          )}
        />
      </Section>
      {qrImageOmitted && (
        <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          QR image was omitted from storage.
        </div>
      )}
    </div>
  );
}

function DropDetails({ payment }: { payment: unknown }) {
  const drop = getUnknown(payment, "drop");
  if (drop === undefined || drop === null) return null;

  return (
    <Section title="Drop">
      <Field
        label="Amount"
        value={formatBaht(asString(getUnknown(drop, "amount")))}
      />
      <Field
        label="Reference 1"
        value={displayValue(getUnknown(drop, "refNo1"))}
      />
      <Field
        label="Reference 2"
        value={displayValue(getUnknown(drop, "refNo2"))}
      />
      <Field label="Note" value={displayValue(getUnknown(drop, "note"))} />
      <Field
        label="User role"
        value={displayValue(getUnknown(drop, "userRole") ?? getUnknown(drop, "role"))}
      />
      <Field
        label="Username"
        value={displayValue(getUnknown(drop, "username"))}
      />
      <Field
        label="First name"
        value={displayValue(getUnknown(drop, "firstName"))}
      />
      <Field
        label="Last name"
        value={displayValue(getUnknown(drop, "lastName"))}
      />
    </Section>
  );
}

function PaymentDetailsPanel({
  payload,
  paymentTypeHint,
}: {
  payload: unknown;
  paymentTypeHint?: string | null;
}) {
  const payment = getUnknown(payload, "payment");
  const shop = getUnknown(payload, "shop");
  const paymentType = (
    asString(getUnknown(payment, "paymentType")) ??
    paymentTypeHint ??
    ""
  ).toLowerCase();

  return (
    <div className="grid gap-6">
      {(paymentType === "cash" || !paymentType) && (
        <CashDetails payment={payment} />
      )}
      {(paymentType === "promptpay" || !paymentType) && (
        <PromptPayDetails payment={payment} />
      )}
      {(paymentType === "qr" || !paymentType) && (
        <DynamicQrDetails payment={payment} />
      )}
      {paymentType &&
        paymentType !== "cash" &&
        paymentType !== "promptpay" &&
        paymentType !== "qr" && (
          <div className="grid gap-6">
            <CashDetails payment={payment} />
            <PromptPayDetails payment={payment} />
            <DynamicQrDetails payment={payment} />
          </div>
        )}
      <DropDetails payment={payment} />

      {(getUnknown(payment, "categoryId") !== undefined ||
        getUnknown(payment, "categoryName") !== undefined ||
        getUnknown(payment, "tagId") !== undefined ||
        getUnknown(payment, "tagName") !== undefined) && (
        <Section title="Additional information">
          <Field
            label="Category ID"
            value={displayValue(getUnknown(payment, "categoryId"))}
          />
          <Field
            label="Category name"
            value={displayValue(getUnknown(payment, "categoryName"))}
          />
          <Field
            label="Tag ID"
            value={displayValue(getUnknown(payment, "tagId"))}
          />
          <Field
            label="Tag name"
            value={displayValue(getUnknown(payment, "tagName"))}
          />
        </Section>
      )}

      {isRecord(shop) && (
        <Section title="Shop payload">
          <Field label="Shop code" value={displayValue(getUnknown(shop, "shopCode"))} />
          <Field label="Shop name" value={displayValue(getUnknown(shop, "shopName"))} />
          <Field
            label="Branch name"
            value={displayValue(getUnknown(shop, "branchName"))}
          />
        </Section>
      )}
    </div>
  );
}

function EventHistoryPanel({
  events,
  lastEventId,
  loading,
  error,
}: {
  events: TigerPayWebhookEvent[];
  lastEventId: string | null;
  loading: boolean;
  error: string | null;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const lifecycle = useMemo(
    () => buildLifecycleSummary(events.map((e) => e.payment_status)),
    [events]
  );

  if (loading) {
    return <div className="text-sm text-muted-foreground">กำลังโหลด...</div>;
  }
  if (error) {
    return <div className="text-sm text-red-600">{error}</div>;
  }
  if (events.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No webhook event history is available for this transaction.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-md border bg-slate-50 p-3 text-sm">
        <div className="text-xs text-muted-foreground mb-1">Lifecycle</div>
        <div className="font-medium">{lifecycle}</div>
      </div>

      <ol className="relative ml-3 border-l pl-5 grid gap-4">
        {events.map((event) => {
          const isCurrent = lastEventId != null && event.id === lastEventId;
          const isOpen = Boolean(expanded[event.id]);
          return (
            <li key={event.id} className="relative grid gap-2">
              <div className="absolute -left-[27px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-slate-400 bg-white" />
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-medium text-sm">
                  {getTigerPayEventTitle(event.payment_status)}
                </div>
                <TigerPayStatusBadge status={event.payment_status} />
                {isCurrent && (
                  <Badge variant="secondary">Current transaction state</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Received {formatBangkokDateTime(event.received_at)} · Tiger
                updated {formatBangkokDateTime(event.tiger_updated_at)} ·{" "}
                {formatPaymentType(event.payment_type)} · Event{" "}
                {shortId(event.id)}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit px-2"
                onClick={() =>
                  setExpanded((prev) => ({
                    ...prev,
                    [event.id]: !prev[event.id],
                  }))
                }
              >
                {isOpen ? "Hide event details" : "View event details"}
              </Button>
              {isOpen && (
                <div className="rounded-md border p-3 grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="Payment number"
                      value={displayValue(event.payment_no)}
                    />
                    <Field
                      label="Event key"
                      value={displayValue(event.event_key)}
                    />
                    <Field
                      label="Processing error"
                      value={displayValue(event.processing_error)}
                    />
                  </div>
                  <JsonViewer value={event.payload} collapsedDefault />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function TigerPayTransactionDetail({
  open,
  onOpenChange,
  selected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: ListRow | null;
}) {
  const [detail, setDetail] = useState<TigerPayTransaction | null>(null);
  const [events, setEvents] = useState<TigerPayWebhookEvent[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !selected) {
      setDetail(null);
      setEvents([]);
      setDetailError(null);
      setEventsError(null);
      return;
    }

    const controller = new AbortController();

    async function loadDetail() {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const res = await fetch(
          `/api/bank/tiger-pay/transactions/${selected!.tiger_payment_id}`,
          { cache: "no-store", signal: controller.signal }
        );
        if (!res.ok) {
          throw new Error("Unable to load transaction details");
        }
        const data = (await res.json()) as { row: TigerPayTransaction };
        setDetail(data.row);
      } catch (e) {
        if (String(e).includes("AbortError")) return;
        setDetailError("Unable to load transaction details");
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    }

    async function loadEvents() {
      setEventsLoading(true);
      setEventsError(null);
      try {
        const res = await fetch(
          `/api/bank/tiger-pay/transactions/${selected!.tiger_payment_id}/events`,
          { cache: "no-store", signal: controller.signal }
        );
        if (!res.ok) {
          throw new Error("Unable to load event history");
        }
        const data = (await res.json()) as { rows: TigerPayWebhookEvent[] };
        setEvents(data.rows ?? []);
      } catch (e) {
        if (String(e).includes("AbortError")) return;
        setEventsError("Unable to load event history");
        setEvents([]);
      } finally {
        setEventsLoading(false);
      }
    }

    loadDetail();
    loadEvents();

    return () => controller.abort();
  }, [open, selected]);

  const row = detail ?? selected;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={[
          "flex flex-col gap-3 overflow-hidden",
          // Mobile: nearly full viewport
          "left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 p-4",
          // Desktop / tablet
          "sm:left-[50%] sm:top-[50%] sm:h-auto sm:max-h-[92vh] sm:w-[96vw] sm:max-w-5xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border sm:p-6",
        ].join(" ")}
      >
        <DialogHeader className="pr-8 text-left">
          <DialogTitle>Tiger Pay transaction</DialogTitle>
          <DialogDescription className="break-words">
            {row
              ? `${row.payment_no} · ${formatPaymentType(row.payment_type)}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {!row ? (
          <div className="text-sm text-muted-foreground">No transaction selected</div>
        ) : detailLoading && !detail ? (
          <div className="text-sm text-muted-foreground">กำลังโหลด...</div>
        ) : detailError && !detail ? (
          <div className="text-sm text-red-600">{detailError}</div>
        ) : (
          <Tabs defaultValue="overview" className="flex-1 min-h-0 flex flex-col">
            <div className="overflow-x-auto -mx-1 px-1">
              <TabsList className="inline-flex h-auto min-w-full w-max justify-start gap-1 p-1">
                <TabsTrigger value="overview" className="shrink-0">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="payment" className="shrink-0">
                  Payment
                </TabsTrigger>
                <TabsTrigger value="events" className="shrink-0">
                  Events
                </TabsTrigger>
                <TabsTrigger value="raw" className="shrink-0">
                  Raw data
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="mt-3 flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 sm:max-h-[65vh]">
              <TabsContent value="overview" className="mt-0 grid gap-6 pb-6">
                <div className="flex flex-wrap items-center gap-2">
                  <TigerPayStatusBadge status={row.status} />
                  <span className="text-sm text-muted-foreground">
                    Last received {formatBangkokDateTime(row.last_received_at)}
                  </span>
                </div>

                <Section title="Transaction">
                  <Field
                    label="Tiger payment ID"
                    value={displayValue(row.tiger_payment_id)}
                  />
                  <Field label="Payment number" value={displayValue(row.payment_no)} />
                  <Field
                    label="Payment type"
                    value={formatPaymentType(row.payment_type)}
                  />
                  <Field
                    label="Current status"
                    value={<TigerPayStatusBadge status={row.status} />}
                  />
                  <Field label="Amount due" value={formatBaht(row.amount)} />
                  <Field label="Total paid" value={formatBaht(row.total_pay)} />
                  <Field
                    label="Change"
                    value={formatBaht(row.change_amount)}
                  />
                  <Field label="Reference 1" value={displayValue(row.ref_no_1)} />
                  <Field label="Reference 2" value={displayValue(row.ref_no_2)} />
                  <Field label="Note" value={displayValue(row.note)} />
                  <Field label="Remark" value={displayValue(row.remark)} />
                </Section>

                <Separator />

                <Section title="Shop">
                  <Field
                    label="Machine / shop code"
                    value={displayValue(row.shop_code)}
                  />
                  <Field label="Shop name" value={displayValue(row.shop_name)} />
                  <Field
                    label="Branch name"
                    value={displayValue(row.branch_name)}
                  />
                </Section>

                <Separator />

                <Section title="Timing">
                  <Field
                    label="Tiger created time"
                    value={formatBangkokDateTime(row.tiger_created_at)}
                  />
                  <Field
                    label="Tiger updated time"
                    value={formatBangkokDateTime(row.tiger_updated_at)}
                  />
                  <Field
                    label="First webhook received"
                    value={formatBangkokDateTime(row.first_received_at)}
                  />
                  <Field
                    label="Last webhook received"
                    value={formatBangkokDateTime(row.last_received_at)}
                  />
                </Section>
              </TabsContent>

              <TabsContent value="payment" className="mt-0 pb-6">
                {detail ? (
                  <PaymentDetailsPanel
                    payload={detail.payload}
                    paymentTypeHint={detail.payment_type}
                  />
                ) : (
                  <div className="text-sm text-muted-foreground">
                    กำลังโหลด...
                  </div>
                )}
              </TabsContent>

              <TabsContent value="events" className="mt-0 pb-6">
                <EventHistoryPanel
                  events={events}
                  lastEventId={row.last_event_id}
                  loading={eventsLoading}
                  error={eventsError}
                />
              </TabsContent>

              <TabsContent value="raw" className="mt-0 grid gap-3 pb-6">
                <p className="text-sm text-muted-foreground">
                  Latest sanitized transaction payload. Sensitive values are
                  redacted.
                </p>
                {detail ? (
                  <JsonViewer value={detail.payload} collapsedDefault={false} />
                ) : (
                  <div className="text-sm text-muted-foreground">
                    กำลังโหลด...
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
