"use client";

import * as z from "zod";

import { createClient } from "@/lib/supabase/client";

import Form from "@/components/common/Form";
import { Input } from "@/components/ui/input";
import { FieldValues, UseFormReturn } from "react-hook-form";
import { useContext } from "react";
import { Search } from "lucide-react";
import MonthPickerInput from "@/components/common/MonthPickerInput";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { BILL_CYCLE_DATE } from "@/lib/utils";
import { useParams } from "next/navigation";
import { UUID } from "crypto";

const searchFormFieldLabel = {
  tax_report_month: "สร้างบิลหลังวันที่ 10",
};

function getFieldLabel(field: FieldValues) {
  return searchFormFieldLabel[field.name as keyof typeof searchFormFieldLabel]
    ? searchFormFieldLabel[field.name as keyof typeof searchFormFieldLabel]
    : field.name;
}

function getFormInput(
  field: FieldValues,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  form: UseFormReturn<z.infer<typeof formSchema>>
) {
  switch (field.name) {
    //month picker
    case "tax_report_month":
      return <MonthPickerInput field={field} includeAllOption={false} />;
      break;

    //simple text
    default:
      return <Input type="text" {...field} />;
  }
}

const formSchema = z.object({
  tax_report_month: z.string(),
});

type TaxReportSearchFormDefaultType = {
  tax_report_month: string;
};

type TaxReportSearchFormProps = {
  defaultValues: TaxReportSearchFormDefaultType;
};

export default function TaxReportSearchForm({
  defaultValues,
}: TaxReportSearchFormProps) {
  const { setExpenseTaxReport, setTotalTaxReport } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  const { branch }: { branch: UUID } = useParams();

  async function searchTaxReceipt(formData: FormData) {
    // type-casting here for convenience
    // in practice, you should validate your inputs
    const searchData = {
      voucher_month: formData.get("tax_report_month") as string,
    };

    const supabase = createClient();

    const date = new Date(searchData.voucher_month);
    // 10th of the same month
    const fromDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      BILL_CYCLE_DATE
    ).toLocaleString("en-US");

    // 10th of the next month
    const toDate = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      BILL_CYCLE_DATE
    ).toLocaleString("en-US");

    const { data, error } = await supabase.rpc("fn_tax_report", {
      from_date: fromDate,
      to_date: toDate,
      in_branch: branch,
      limit_count: 500,
      offset_count: 0,
    });

    if (error) {
      console.error(error);
      return;
    }

    if (data && data.length > 0) {
      setExpenseTaxReport(data); // keep context flexible or change context type to TaxReportRow[]
      setTotalTaxReport(data[0].total_count ?? data.length);
    } else {
      setExpenseTaxReport([]);
      setTotalTaxReport(0);
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const { tax_report_month } = values;

    const formData = new FormData();
    formData.append("tax_report_month", tax_report_month);

    await searchTaxReceipt(formData);
  }
  return (
    <Form
      schema={formSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      getFieldLabel={getFieldLabel}
      getFormInput={getFormInput}
      className="flex justify-start items-end gap-4 px-12"
      submitLabel={<Search />}
    />
  );
}
