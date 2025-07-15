import { ReminderType } from "./ReminderColumn";
import { fieldLabel } from "./CreateReminderForm";
import React from "react";
import ImageCarousel from "../common/ImageCarousel";
import { Button } from "../ui/button";

type ReminderDetailProps = {
  selectedRow: ReminderType;
};

export default function ReminderDetail({ selectedRow }: ReminderDetailProps) {
  function getKeyValue(key: string) {
    switch (key) {
      case "start_date":
      case "end_date":
      case "due_date":
      case "payment_date":
      case "created_at":
      case "last_modified":
        return !!selectedRow[key as keyof typeof selectedRow]
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
        return !!selectedRow[key as keyof typeof selectedRow]
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
        return selectedRow[key as keyof typeof selectedRow];
    }
  }

  console.log(selectedRow);
  return (
    <div className="flex flex-col items-center gap-6 p-2">
      <div className="flex w-full">
        <div className="flex-1"></div>
        <h2 className="text-xl">{!!selectedRow && `${selectedRow.note_id}`}</h2>
        <div className="flex-1 flex justify-end">
          <Button>Test message</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 w-[80%]">
        {Object.keys(selectedRow).map((key) => (
          <React.Fragment key={key}>
            <span>{fieldLabel[key as keyof typeof selectedRow]}</span>
            <span>{getKeyValue(key)}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="flex flex-col items-center gap-3">
        <h3>รูปบิล/ใบวางบิล</h3>
        <div className="w-96">
          <ImageCarousel
            imageFolder="reminder_bill"
            imageId={`${selectedRow.supplier_name.toString()}_${selectedRow.note_id.toString()}_${selectedRow.id.toString()}`}
          />
        </div>
      </div>
      <div className="flex flex-col items-center gap-3">
        <h3>รูปหลักฐานการชำระเงิน</h3>
        <div className="w-96">
          <ImageCarousel
            imageFolder="reminder_payment"
            imageId={`${selectedRow.supplier_name.toString()}_${selectedRow.note_id.toString()}_${selectedRow.id.toString()}`}
          />
        </div>
      </div>
    </div>
  );
}
