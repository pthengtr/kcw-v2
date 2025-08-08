import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useId, useState } from "react";

import { BranchType, UUID } from "@/lib/types/models";
import { FieldValues } from "react-hook-form";

type ExpenseBranchSelectInput = { field: FieldValues };

export default function ExpenseBranchSelectInput({
  field,
}: ExpenseBranchSelectInput) {
  const [branches, setBranches] = useState<BranchType[]>([]);

  const supabase = createClient();

  const id = useId();

  const getBranches = useCallback(
    async function () {
      const query = supabase
        .from("branch")
        .select("*")
        .order("branch_uuid", { ascending: false })
        .limit(500);

      const { data, error } = await query;

      if (error) {
        console.log(error);
        return;
      }

      if (data) {
        setBranches(data);
      }
    },
    [supabase]
  );

  useEffect(() => {
    getBranches();
  }, [getBranches]);

  function handleValueChanage(branch_uuid: UUID) {
    field.onChange(branch_uuid);
  }

  return (
    <div className="flex flex-col gap-1">
      <Select
        value={field.value ? field.value : ""}
        onValueChange={(value) => handleValueChanage(value)}
      >
        <SelectTrigger className="">
          <SelectValue placeholder="เลือกสาขา" />
        </SelectTrigger>
        <SelectContent>
          {branches.map((branch, index) => (
            <SelectItem key={`${id}-${index}`} value={branch.branch_uuid}>
              {branch.branch_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
