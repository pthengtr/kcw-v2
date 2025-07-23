import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { HeaderContext } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/common/DataTableColumnHeader";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type commonUploadFileProps = {
  picture: File;
  imageId: string;
  imageFolder: string;
};

type commonUploadFileReturn = Promise<
  | {
      data: {
        id: string;
        path: string;
        fullPath: string;
      };
    }
  | {
      data: null;
    }
>;

function sanitizeFilename(filename: string) {
  const lastDotIndex = filename.lastIndexOf(".");

  if (lastDotIndex === -1) {
    // No extension found, remove all non-alphanumeric characters
    return filename.replace(/[^A-Za-z0-9]/g, "");
  } else {
    // Split into name and extension
    const namePart = filename.substring(0, lastDotIndex);
    const extension = filename.substring(lastDotIndex); // includes the dot

    // Clean filename part
    const cleanedName = namePart.replace(/[^A-Za-z0-9]/g, "");

    // Return combined filename
    return cleanedName + extension;
  }
}

export async function commonUploadFile({
  picture,
  imageId,
  imageFolder,
}: commonUploadFileProps): commonUploadFileReturn {
  const temp_imageFilename =
    imageId +
    "_" +
    Math.random().toString().substring(4, 12) +
    "." +
    sanitizeFilename(picture.name).split(".")[1];

  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from("pictures")
    .upload(`public/${imageFolder}/${temp_imageFilename}`, picture);

  if (!!error) {
    console.log(error);
    toast.error(`เกิดข้อผิดพลาด ไม่สามารถอัพโหลด ${picture.name}`);
  }

  return { data };
}

export function simpleText(fieldLabel: Record<string, string>, key: string) {
  const id = fieldLabel[key] ?? key;
  return {
    id: id,
    accessorKey: key,
    header: ({ column }: HeaderContext<Record<string, string>, undefined>) => (
      <DataTableColumnHeader column={column} title={id} />
    ),
  };
}
