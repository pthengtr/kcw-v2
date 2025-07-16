import { fieldLabel } from "./ReminderForm";
import React, { useContext } from "react";
import ImageCarousel from "../common/ImageCarousel";

import { ReminderContext, ReminderContextType } from "./ReminderProvider";
import ReminderFormDialog from "./ReminderFormDialog";

export default function ReminderDetail() {
  const { selectedRow, openUpdateDialog, setOpenUpdateDialog } = useContext(
    ReminderContext
  ) as ReminderContextType;

  function getKeyValue(key: string) {
    switch (key) {
      case "start_date":
      case "end_date":
      case "due_date":
      case "payment_date":
      case "created_at":
      case "last_modified":
        return selectedRow && !!selectedRow[key as keyof typeof selectedRow]
          ? new Date(
              selectedRow[key as keyof typeof selectedRow]
            ).toLocaleDateString("th-TH", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
          : "";
        break;
      case "kbiz_datetime":
        return selectedRow && !!selectedRow[key as keyof typeof selectedRow]
          ? new Date(
              selectedRow[key as keyof typeof selectedRow]
            ).toLocaleDateString("th-TH", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
        break;
      default:
        return selectedRow && selectedRow[key as keyof typeof selectedRow];
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 px-2 py-8">
      <div className="flex w-full">
        <div className="flex-1"></div>
        <h2 className="text-2xl">
          {!!selectedRow && `${selectedRow.note_id}`}
        </h2>
        <div className="flex-1 flex justify-end">
          {selectedRow && (
            <ReminderFormDialog
              update
              open={openUpdateDialog}
              setOpen={setOpenUpdateDialog}
              dialogTrigger="แก้ไขรายการนี้"
              dialogHeader="แก้ไขรายการเตือนโอน"
              defaultValues={{
                supplier_name: selectedRow.supplier_name,
                note_id: selectedRow.note_id,
                bill_count: selectedRow.bill_count,
                start_date: new Date(selectedRow.start_date),
                end_date: new Date(selectedRow.end_date),
                total_amount: selectedRow.total_amount,
                discount: selectedRow.discount,
                due_date: new Date(selectedRow.due_date),
                kbiz_datetime: selectedRow.kbiz_datetime
                  ? new Date(selectedRow.kbiz_datetime)
                  : null,
                payment_date: selectedRow.payment_date
                  ? new Date(selectedRow.payment_date)
                  : null,
                bank_name: selectedRow.bank_name,
                bank_account_name: selectedRow.bank_account_name,
                bank_account_number: selectedRow.bank_account_number,
                bill_pictures: [],
                payment_pictures: [],
                remark: selectedRow.remark,
              }}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-1 w-[80%]">
        {selectedRow &&
          Object.keys(selectedRow).map((key) => (
            <React.Fragment key={key}>
              <span>{fieldLabel[key as keyof typeof selectedRow]}</span>
              <span>{getKeyValue(key)}</span>
            </React.Fragment>
          ))}
      </div>
      <div className="flex flex-col items-center gap-3">
        <h3>รูปบิล/ใบวางบิล</h3>
        <div className="w-96">
          {selectedRow && (
            <ImageCarousel
              imageFolder="reminder_bill"
              imageId={`${selectedRow.supplier_name
                .toString()
                .replace(/[^A-Za-z0-9\s]/g, "")}_${selectedRow.note_id
                .toString()
                .replace(/[^A-Za-z0-9\s]/g, "")}`}
            />
          )}
        </div>
      </div>
      <div className="flex flex-col items-center gap-3">
        <h3>รูปหลักฐานการชำระเงิน</h3>
        <div className="w-96">
          {selectedRow && (
            <ImageCarousel
              imageFolder="reminder_payment"
              imageId={`${selectedRow.supplier_name
                .toString()
                .replace(/[^A-Za-z0-9\s]/g, "")}_${selectedRow.note_id
                .toString()
                .replace(/[^A-Za-z0-9\s]/g, "")}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
