"use client";

import { useState } from "react";
import { PartyKind, useParty } from "./PartyProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import PartyFormDialog from "./PartyFormDialog";
import TaxInfoList from "./TaxInfoList";
import BankInfoList from "./BankInfoList";
import PartyTable from "./PartyTable";

export default function PartyScreen() {
  const { state, actions } = useParty();
  // string holds party_uuid when editing, or "create"
  const [editing, setEditing] = useState<null | "create" | string>(null);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <label className="text-xs text-muted-foreground">ค้นหา</label>
          <Input
            value={state.q}
            onChange={(e) => actions.setQ(e.target.value)}
            placeholder="ชื่อ / โค้ด"
          />
        </div>

        <div className="min-w-[180px]">
          <label className="text-xs text-muted-foreground">ประเภท</label>
          <Select
            value={state.kind}
            onValueChange={(v) => actions.setKind(v as PartyKind | "ANY")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ANY">ทั้งหมด</SelectItem>
              <SelectItem value="SUPPLIER">ผู้ขาย (รวม BOTH)</SelectItem>
              <SelectItem value="CUSTOMER">ลูกค้า (รวม BOTH)</SelectItem>
              <SelectItem value="BOTH">BOTH เท่านั้น</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={state.activeOnly}
            onCheckedChange={actions.setActiveOnly}
          />
          <span className="text-sm">Active เท่านั้น</span>
        </div>

        <Button
          variant="outline"
          onClick={() => actions.refresh()}
          disabled={state.loading}
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          รีเฟรช
        </Button>

        <Button onClick={() => setEditing("create")}>
          <Plus className="h-4 w-4 mr-1" />
          เพิ่มคู่ค้า
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PartyTable
          items={state.items}
          loading={state.loading}
          page={state.page}
          pageSize={state.pageSize}
          total={state.total}
          onPageChange={actions.setPage}
          onEdit={(party) => setEditing(party.party_uuid)}
          onSelect={(party) => actions.setSelected(party)}
          onDelete={async (party) => {
            if (confirm(`ลบ "${party.party_name}" ?`)) {
              await actions.deleteParty(party.party_uuid);
            }
          }}
        />

        <div className="border rounded-lg p-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">รายละเอียด</h3>
            {state.selected && (
              <Button
                size="sm"
                variant="destructive"
                onClick={async () => {
                  if (confirm(`ลบ "${state.selected?.party_name}" ?`)) {
                    await actions.deleteParty(state.selected!.party_uuid);
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                ลบ
              </Button>
            )}
          </div>

          {!state.selected ? (
            <p className="text-sm text-muted-foreground mt-2">
              เลือกคู่ค้าจากตารางด้านซ้าย…
            </p>
          ) : (
            <div className="space-y-6 mt-3">
              <div>
                <div className="text-lg font-medium">
                  {state.selected.party_name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {state.selected.party_code || "—"} · {state.selected.kind} ·{" "}
                  {state.selected.is_active ? "Active" : "Inactive"}
                </div>
              </div>

              {/* TAX INFO */}
              <TaxInfoList
                party={state.selected}
                onAdd={async (payload) =>
                  actions.addTaxInfo(state.selected!.party_uuid, payload)
                }
                onUpdate={actions.updateTaxInfo}
                onDelete={actions.deleteTaxInfo}
              />

              {/* BANK INFO */}
              <BankInfoList
                party={state.selected}
                onAdd={async (payload) =>
                  actions.addBank(state.selected!.party_uuid, payload)
                }
                onDelete={actions.deleteBank}
                onMakeDefault={(bank_info_uuid) =>
                  actions.setDefaultBank(
                    state.selected!.party_uuid,
                    bank_info_uuid
                  )
                }
              />
            </div>
          )}
        </div>
      </div>

      <PartyFormDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        mode={editing === "create" ? "create" : "edit"}
        party={
          editing && editing !== "create"
            ? state.items.find((p) => p.party_uuid === editing)
            : undefined
        }
        onSubmit={async (values) => {
          if (editing === "create") {
            await actions.createParty(values);
          } else if (editing) {
            await actions.updateParty(editing, values);
          }
          setEditing(null);
        }}
      />
    </div>
  );
}
