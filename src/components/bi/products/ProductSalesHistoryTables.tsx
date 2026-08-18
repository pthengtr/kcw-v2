"use client";

import type {
  BiProductPurchaseHistoryRow,
  BiProductSalesHistoryRow,
} from "@/lib/bi/product-sales-types";
import { PURCHASE_BILLTYPE_LABELS } from "@/lib/bi/product-sales-types";
import {
  BILLTYPE_LABELS,
  BRANCH_LABELS,
  formatBaht,
  formatCount,
  labelFor,
} from "@/lib/bi/sales-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  sales: BiProductSalesHistoryRow[];
  purchases: BiProductPurchaseHistoryRow[];
};

export default function ProductSalesHistoryTables({ sales, purchases }: Props) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          ประวัติในช่วงที่เลือก
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          แสดงรายการล่าสุดในหน้าต่างวันที่ · กำไรคิดจาก LAST_PURCHASE_COST
          ของบรรทัดขาย ไม่ใช่ยอดซื้อช่วงนี้
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="sales">
          <TabsList>
            <TabsTrigger value="sales">ขาย ({sales.length})</TabsTrigger>
            <TabsTrigger value="purchase">
              ซื้อเข้า ({purchases.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="sales" className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">วันที่</th>
                  <th className="py-2 pr-3 font-medium">สาขา</th>
                  <th className="py-2 pr-3 font-medium">บิล</th>
                  <th className="py-2 pr-3 text-right font-medium">จำนวน</th>
                  <th className="py-2 pr-3 text-right font-medium">ยอดสุทธิ</th>
                  <th className="py-2 pr-3 text-right font-medium">ต้นทุน/หน่วย</th>
                  <th className="py-2 text-right font-medium">ขั้นต้น</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 text-center text-muted-foreground"
                    >
                      ไม่มีรายการขาย
                    </td>
                  </tr>
                ) : (
                  sales.map((row) => (
                    <tr
                      key={`${row.store_branch}-${row.bill_no}-${row.bill_date}-${row.base_qty}`}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="whitespace-nowrap py-2.5 pr-3">
                        {row.bill_date}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3">
                        {labelFor(BRANCH_LABELS, row.reporting_branch)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="font-medium">{row.bill_no}</div>
                        <div className="text-xs text-muted-foreground">
                          {labelFor(BILLTYPE_LABELS, row.billtype)}
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                        {formatCount(row.base_qty)}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                        {formatBaht(row.revenue_net)}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                        {row.unit_cost == null
                          ? "—"
                          : formatBaht(row.unit_cost, true)}
                      </td>
                      <td className="whitespace-nowrap py-2.5 text-right tabular-nums">
                        {row.gross_profit == null
                          ? "—"
                          : formatBaht(row.gross_profit)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TabsContent>
          <TabsContent value="purchase" className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">วันที่</th>
                  <th className="py-2 pr-3 font-medium">บิลซื้อ</th>
                  <th className="py-2 pr-3 font-medium">ประเภท</th>
                  <th className="py-2 pr-3 text-right font-medium">จำนวน</th>
                  <th className="py-2 pr-3 text-right font-medium">ราคา/หน่วย</th>
                  <th className="py-2 text-right font-medium">ยอดสุทธิ</th>
                </tr>
              </thead>
              <tbody>
                {purchases.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-muted-foreground"
                    >
                      ไม่มีรายการซื้อเข้า HQ
                    </td>
                  </tr>
                ) : (
                  purchases.map((row) => (
                    <tr
                      key={`${row.bill_no}-${row.bill_date}-${row.base_qty}`}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="whitespace-nowrap py-2.5 pr-3">
                        {row.bill_date}
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="font-medium">{row.bill_no}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.acctno ? `ผู้ขาย ${row.acctno}` : "—"}
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3">
                        {labelFor(PURCHASE_BILLTYPE_LABELS, row.billtype)}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                        {formatCount(row.base_qty)}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                        {formatBaht(row.unit_price, true)}
                      </td>
                      <td className="whitespace-nowrap py-2.5 text-right tabular-nums">
                        {formatBaht(row.amount_net)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
