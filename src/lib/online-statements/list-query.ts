export const ONLINE_PAYOUT_SORTS = [
  "payout_at",
  "platform",
  "shop",
  "amount",
  "order_count",
  "expense_amount",
  "matched_order_count",
] as const;

export type OnlinePayoutSort = (typeof ONLINE_PAYOUT_SORTS)[number];

export type OnlinePayoutListQuery = {
  platform: string;
  status: string;
  shop: string;
  from: string;
  to: string;
  sort: OnlinePayoutSort;
  ascending: boolean;
  limit: number;
};

const RECENT_LIMIT = 500;
const RANGED_LIMIT = 5000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SHOP = /^[A-Za-z0-9_-]{1,32}$/;

function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

function addIsoDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function parseOnlinePayoutListQuery(params: URLSearchParams): OnlinePayoutListQuery {
  const platform = params.get("platform")?.trim() || "all";
  const status = params.get("status")?.trim() || "transferred";
  const shopRaw = params.get("shop")?.trim() || "";
  const shop = shopRaw && shopRaw !== "all" && SHOP.test(shopRaw) ? shopRaw : "";

  let from = params.get("from")?.trim() || "";
  let to = params.get("to")?.trim() || "";
  if (!isIsoDate(from)) from = "";
  if (!isIsoDate(to)) to = "";
  if (from && to && from > to) {
    const swap = from;
    from = to;
    to = swap;
  }

  const sortRaw = params.get("sort")?.trim() || "";
  const sort = (ONLINE_PAYOUT_SORTS as readonly string[]).includes(sortRaw)
    ? (sortRaw as OnlinePayoutSort)
    : "payout_at";
  const ascending = params.get("dir")?.trim() === "asc";

  return {
    platform,
    status,
    shop,
    from,
    to,
    sort,
    ascending,
    limit: from || to ? RANGED_LIMIT : RECENT_LIMIT,
  };
}

/** Inclusive Bangkok-day start for `payout_at`. */
export function payoutAtLowerBound(from: string): string {
  return `${from}T00:00:00+07:00`;
}

/** Exclusive Bangkok-day end (start of the next day) for `payout_at`. */
export function payoutAtUpperBound(to: string): string {
  return `${addIsoDays(to, 1)}T00:00:00+07:00`;
}

export function defaultSortAscending(sort: OnlinePayoutSort): boolean {
  return sort === "platform" || sort === "shop";
}
