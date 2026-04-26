"use client";

import * as z from "zod";

import { createClient } from "@/lib/supabase/client";

import Form from "../common/Form";
import { FieldValues, UseFormReturn } from "react-hook-form";
import { useContext } from "react";
import { ReminderContext, ReminderContextType } from "./ReminderProvider";
import { Search } from "lucide-react";
import { Input } from "../ui/input";
import MonthPickerInput from "../common/MonthPickerInput";

const searchFormFieldLabel = {
  search_supplier_name: "บริษัท",
  note_id: "เลขที่ใบวางบิล",
  due_month: "กำหนดชำระเดือน",
  payment_month: "ชำระแล้วเดือน",
};

const formSchema = z.object({
  search_supplier_name: z.string(),
  note_id: z.string(),
  due_month: z.string(),
  payment_month: z.string(),
});

type ReminderSearchFormValues = z.infer<typeof formSchema>;

type ReminderSearchFormProps = {
  defaultValues: ReminderSearchFormValues;
};

function getFieldLabel(field: FieldValues) {
  return searchFormFieldLabel[field.name as keyof typeof searchFormFieldLabel]
    ? searchFormFieldLabel[field.name as keyof typeof searchFormFieldLabel]
    : field.name;
}

function getFormInput(
  field: FieldValues,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  form: UseFormReturn<ReminderSearchFormValues>,
) {
  switch (field.name) {
    case "payment_month":
    case "due_month":
      return <MonthPickerInput field={field} />;

    default:
      return <Input type="text" {...field} />;
  }
}

function cleanSearchText(value: string) {
  return value.replace(/[(),]/g, " ").trim();
}

export default function ReminderSearchForm({
  defaultValues,
}: ReminderSearchFormProps) {
  const { setReminders, setTotal } = useContext(
    ReminderContext,
  ) as ReminderContextType;

  async function searchReminder(values: ReminderSearchFormValues) {
    const searchData = {
      party_search: values.search_supplier_name.trim(),
      note_id: values.note_id.trim(),
      due_month: values.due_month,
      payment_month: values.payment_month,
    };

    const supabase = createClient();

    let query = supabase
      .from("payment_reminder")
      .select("*, party(*)", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(500);

    if (searchData.party_search) {
      const partySearch = cleanSearchText(searchData.party_search);

      const { data: parties, error: partyError } = await supabase
        .from("party")
        .select("party_uuid")
        .or(
          `party_name.ilike.%${partySearch}%,party_code.ilike.%${partySearch}%`,
        )
        .limit(200);

      if (partyError) {
        console.log(partyError);
        return;
      }

      const partyUuids = (parties ?? []).map((party) => party.party_uuid);

      if (partyUuids.length === 0) {
        setReminders([]);
        setTotal(0);
        return;
      }

      query = query.in("party_uuid", partyUuids);
    }

    if (searchData.note_id) {
      query = query.ilike("note_id", `%${searchData.note_id}%`);
    }

    if (searchData.due_month !== "all") {
      const dueStart = new Date(searchData.due_month).toLocaleString("en-US");

      const dueEndDate = new Date(searchData.due_month);
      dueEndDate.setMonth(dueEndDate.getMonth() + 1);
      const dueEnd = dueEndDate.toLocaleString("en-US");

      query = query.gte("due_date", dueStart).lt("due_date", dueEnd);
    }

    if (searchData.payment_month !== "all") {
      const paymentStart = new Date(searchData.payment_month).toLocaleString(
        "en-US",
      );

      const paymentEndDate = new Date(searchData.payment_month);
      paymentEndDate.setMonth(paymentEndDate.getMonth() + 1);
      const paymentEnd = paymentEndDate.toLocaleString("en-US");

      query = query
        .gte("payment_date", paymentStart)
        .lt("payment_date", paymentEnd);
    }

    const { data, error, count } = await query;

    if (error) {
      console.log(error);
      return;
    }

    if (data) {
      setReminders(data);
    }

    if (count !== null && count !== undefined) {
      setTotal(count);
    }
  }

  async function onSubmit(values: ReminderSearchFormValues) {
    await searchReminder(values);
  }

  return (
    <Form<ReminderSearchFormValues>
      schema={formSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      getFieldLabel={getFieldLabel}
      getFormInput={getFormInput}
      className="flex justify-center items-end gap-4 pxs-12"
      submitLabel={<Search />}
    />
  );
}
