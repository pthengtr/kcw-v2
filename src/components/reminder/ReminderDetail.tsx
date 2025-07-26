import { reminderFieldLabel } from "./ReminderForm";
import React, { useContext, useEffect } from "react";
import ImageCarousel, { getImageArray } from "../common/ImageCarousel";

import { ReminderContext, ReminderContextType } from "./ReminderProvider";
import ReminderFormDialog from "./ReminderFormDialog";
import { Separator } from "../ui/separator";
import { Pencil } from "lucide-react";
import { reminderDefaultValue } from "./ReminderColumn";

export default function ReminderDetail() {
  const {
    selectedRow,
    openUpdateDialog,
    setOpenUpdateDialog,
    setBillImageArray,
    setPaymentImageArray,
    billImageArray,
    paymentImageArray,
    isAdmin,
  } = useContext(ReminderContext) as ReminderContextType;

  useEffect(() => {
    if (selectedRow) {
      getImageArray(
        "reminder_bill",
        `${selectedRow.supplier_code
          .toString()
          .replace(/[^A-Za-z0-9]/g, "")}_${selectedRow.note_id
          .toString()
          .replace(/[^A-Za-z0-9]/g, "")}`,
        setBillImageArray
      );
      getImageArray(
        "reminder_payment",
        `${selectedRow.supplier_code
          .toString()
          .replace(/[^A-Za-z0-9]/g, "")}_${selectedRow.note_id
          .toString()
          .replace(/[^A-Za-z0-9]/g, "")}`,
        setPaymentImageArray
      );
    }
  }, [selectedRow, setBillImageArray, setPaymentImageArray, openUpdateDialog]);

  const section1 = ["id", "user_id", "created_at", "last_modified"];
  const section2 = [
    "supplier_code",
    "note_id",
    "bill_count",
    "start_date",
    "end_date",
    "discount",
    "total_amount",
  ];
  const section3 = [
    "due_date",
    "kbiz_datetime",
    "bank_name",
    "bank_account_name",
    "bank_account_number",
    "payment_date",
  ];

  function getKeyValue(key: string) {
    switch (key) {
      // number
      case "total_amount":
      case "discount":
        return (
          selectedRow &&
          selectedRow[key as keyof typeof selectedRow].toLocaleString("th-TH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        );
        break;
      // date
      case "start_date":
      case "end_date":
      case "due_date":
      case "payment_date":
        return selectedRow && !!selectedRow[key as keyof typeof selectedRow]
          ? new Date(
              selectedRow[key as keyof typeof selectedRow]
            ).toLocaleDateString("th-TH", {
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
            })
          : "";
        break;

      // date time
      case "created_at":
      case "last_modified":
      case "kbiz_datetime":
        return selectedRow && !!selectedRow[key as keyof typeof selectedRow]
          ? new Date(
              selectedRow[key as keyof typeof selectedRow]
            ).toLocaleDateString("th-TH", {
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
        break;
      default:
        return selectedRow && selectedRow[key as keyof typeof selectedRow];
    }
  }

  const updateDefaultValues = selectedRow
    ? {
        supplier_code: selectedRow.supplier_code,
        note_id: selectedRow.note_id,
        bill_count: selectedRow.bill_count,
        start_date: new Date(selectedRow.start_date),
        end_date: new Date(selectedRow.end_date),
        total_amount: Math.round(selectedRow.total_amount * 100) / 100,
        discount: Math.round(selectedRow.discount * 100) / 100,
        due_date: new Date(selectedRow.due_date),
        kbiz_datetime: selectedRow.kbiz_datetime
          ? new Date(selectedRow.kbiz_datetime)
          : null,
        payment_date: selectedRow.payment_date
          ? new Date(selectedRow.payment_date)
          : null,
        bill_pictures: [],
        payment_pictures: [],
        bank_info: null,
        remark: selectedRow.remark,
        agree: false,
      }
    : reminderDefaultValue;

  console.log(selectedRow);
  console.log(updateDefaultValues);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { payment_date, ...nonAdminDefaultValue } = updateDefaultValues;
  const defaultValues = isAdmin ? updateDefaultValues : nonAdminDefaultValue;

  return (
    <div className="flex flex-col items-center gap-6 relative overflow-scroll h-[90vh]">
      <div className="flex w-full sticky top-0 py-4 px-8 shadow-sm bg-white">
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
              dialogTrigger={<Pencil />}
              dialogHeader="แก้ไขรายการเตือนโอน"
              defaultValues={defaultValues}
            />
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-y-1 w-[80%]">
        {selectedRow &&
          section1.map((key) => (
            <React.Fragment key={key}>
              <span>{reminderFieldLabel[key as keyof typeof selectedRow]}</span>
              <span>{getKeyValue(key)}</span>
            </React.Fragment>
          ))}
      </div>
      <Separator />
      <div className="grid grid-cols-2 gap-y-1 w-[80%]">
        {selectedRow &&
          section2.map((key) => (
            <React.Fragment key={key}>
              <span>{reminderFieldLabel[key as keyof typeof selectedRow]}</span>
              <span>{getKeyValue(key)}</span>
            </React.Fragment>
          ))}
      </div>
      <Separator />
      <div className="grid grid-cols-2 gap-y-1 w-[80%]">
        {selectedRow &&
          section3.map((key) => (
            <React.Fragment key={key}>
              <span>{reminderFieldLabel[key as keyof typeof selectedRow]}</span>
              <span>{getKeyValue(key)}</span>
            </React.Fragment>
          ))}
      </div>
      <Separator />
      <div className="flex flex-col items-center gap-3">
        <h3>รูปบิล/ใบวางบิล</h3>
        <div className="w-96">
          {selectedRow && (
            <ImageCarousel
              imageFolder="reminder_bill"
              imageId={`${selectedRow.supplier_code
                .toString()
                .replace(/[^A-Za-z0-9]/g, "")}_${selectedRow.note_id
                .toString()
                .replace(/[^A-Za-z0-9]/g, "")}`}
              imageArray={billImageArray}
              setImageArray={setBillImageArray}
            />
          )}
        </div>
      </div>
      <Separator />
      <div className="flex flex-col items-center gap-3">
        <h3>รูปหลักฐานการชำระเงิน</h3>
        <div className="w-96">
          {selectedRow && (
            <ImageCarousel
              imageFolder="reminder_payment"
              imageId={`${selectedRow.supplier_code
                .toString()
                .replace(/[^A-Za-z0-9]/g, "")}_${selectedRow.note_id
                .toString()
                .replace(/[^A-Za-z0-9]/g, "")}`}
              imageArray={paymentImageArray}
              setImageArray={setPaymentImageArray}
            />
          )}
        </div>
      </div>
    </div>
  );
}
