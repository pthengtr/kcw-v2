export type BiDeadTier = "yellow" | "orange" | "red";

export type BiProductMovementSummary = {
  sold_sku_count: number;
  sell_qty: number;
  bought_sku_count: number;
  buy_qty: number;
  dead_yellow_count: number;
  dead_orange_count: number;
  dead_red_count: number;
  dead_total_count: number;
};

export type BiStockMoreRow = {
  bcode: string;
  detail: string;
  category_code: string;
  category_name: string;
  code1: string | null;
  code1_name: string | null;
  sell_qty: number;
  sell_bills: number;
  sell_days: number;
  buy_qty: number;
  buy_bills: number;
  on_hand_qty: number;
  last_sale_date: string | null;
  last_purchase_date: string | null;
};

export type BiDeadStockRow = {
  bcode: string;
  detail: string;
  category_code: string;
  category_name: string;
  code1: string | null;
  code1_name: string | null;
  on_hand_qty: number;
  last_purchase_date: string | null;
  last_sale_date: string | null;
  days_since_purchase: number | null;
  days_since_sale: number | null;
  no_move_since_purchase: boolean;
  dead_tier: BiDeadTier;
  sell_qty_period: number;
  buy_qty_period: number;
};

export type BiProductMovement = {
  from: string;
  to: string;
  branch: string | null;
  stock_limit: number;
  dead_limit: number;
  summary: BiProductMovementSummary;
  stock_more: BiStockMoreRow[];
  dead_stock: BiDeadStockRow[];
};
