"use client";

import { useContext } from "react";
import { PosContext, PosContextType } from "./PosProvider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PosHeader() {
  const {
    locations,
    priceLists,
    loadingInit,
    locationUuid,
    setLocationUuid,
    priceListUuid,
    setPriceListUuid,
    receiptNumber,
    setReceiptNumber,
    customerRef,
    setCustomerRef,
    headerDiscount,
    setHeaderDiscount,
    freightAmount,
    setFreightAmount,
    otherCharge,
    setOtherCharge,
  } = useContext(PosContext) as PosContextType;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <Label>สาขา</Label>
        <Select
          value={locationUuid}
          onValueChange={setLocationUuid}
          disabled={loadingInit}
        >
          <SelectTrigger>
            <SelectValue placeholder="เลือกสาขา" />
          </SelectTrigger>
          <SelectContent>
            {locations.map((l) => (
              <SelectItem key={l.location_uuid} value={l.location_uuid}>
                {l.location_code} — {l.location_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>ราคา (Price List)</Label>
        <Select
          value={priceListUuid}
          onValueChange={setPriceListUuid}
          disabled={loadingInit}
        >
          <SelectTrigger>
            <SelectValue placeholder="เลือกราคา" />
          </SelectTrigger>
          <SelectContent>
            {priceLists.map((p) => (
              <SelectItem key={p.price_list_uuid} value={p.price_list_uuid}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>เลขที่ใบเสร็จ (ถ้ามี)</Label>
        <Input
          value={receiptNumber}
          onChange={(e) => setReceiptNumber(e.target.value)}
        />
      </div>

      <div>
        <Label>ลูกค้าอ้างอิง (ถ้ามี)</Label>
        <Input
          value={customerRef ?? ""}
          onChange={(e) => setCustomerRef(e.target.value || undefined)}
        />
      </div>
      <div>
        <Label>ส่วนลดท้ายบิล</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={headerDiscount}
          onChange={(e) => setHeaderDiscount(Number(e.target.value || 0))}
        />
      </div>
      <div>
        <Label>ค่าขนส่ง</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={freightAmount}
          onChange={(e) => setFreightAmount(Number(e.target.value || 0))}
        />
      </div>
      <div>
        <Label>ค่าใช้จ่ายอื่น ๆ</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={otherCharge}
          onChange={(e) => setOtherCharge(Number(e.target.value || 0))}
        />
      </div>
    </div>
  );
}
