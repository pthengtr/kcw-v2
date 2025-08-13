"use client";

import { useContext } from "react";
import { PurchaseContext, PurchaseContextType } from "./PurchaseProvider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PurchaseHeader() {
  const {
    locations,
    loadingLocations,
    selectedLocation,
    setSelectedLocation,
    supplierName,
    setSupplierName,
    docNumber,
    setDocNumber,

    // header adjustments
    headerDiscount,
    setHeaderDiscount,
    freightAmount,
    setFreightAmount,
    otherCharge,
    setOtherCharge,
  } = useContext(PurchaseContext) as PurchaseContextType;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <Label>ผู้ขาย (Supplier)</Label>
        <Input
          value={supplierName}
          onChange={(e) => setSupplierName(e.target.value)}
        />
      </div>

      <div>
        <Label>สาขา (Location)</Label>
        <Select
          value={selectedLocation}
          onValueChange={(v) => setSelectedLocation(v)}
          disabled={loadingLocations}
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
        <Label>เลขที่เอกสาร (ถ้ามี)</Label>
        <Input
          value={docNumber}
          onChange={(e) => setDocNumber(e.target.value)}
        />
      </div>

      {/* Header adjustments */}
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
