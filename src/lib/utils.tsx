import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { HeaderContext } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/common/DataTableColumnHeader";
import { storageObjectType } from "@/components/common/ImageCarousel";

export const imageRegex = /[^A-Za-z0-9ก-ฮ]/g;

export const thaiConsonantRegex = /[ก-ฮ]/g;

export const thaiConsonantMap = {
  ก: "k",
  ข: "kh",
  ฃ: "kh",
  ค: "kh",
  ฅ: "kh",
  ฆ: "kh",
  ง: "ng",
  จ: "ch",
  ฉ: "ch",
  ช: "ch",
  ซ: "s",
  ฌ: "ch",
  ญ: "y",
  ฎ: "d",
  ฏ: "t",
  ฐ: "th",
  ฑ: "th",
  ฒ: "th",
  ณ: "n",
  ด: "d",
  ต: "t",
  ถ: "th",
  ท: "th",
  ธ: "th",
  น: "n",
  บ: "b",
  ป: "p",
  ผ: "ph",
  ฝ: "f",
  พ: "ph",
  ฟ: "f",
  ภ: "ph",
  ม: "m",
  ย: "y",
  ร: "r",
  ล: "l",
  ว: "w",
  ศ: "s",
  ษ: "s",
  ส: "s",
  ห: "h",
  ฬ: "l",
  อ: "o",
  ฮ: "h",
};

// Replace function
export function transliterateThaiConsonants(text: string) {
  return text.replace(
    thaiConsonantRegex,
    (char) => thaiConsonantMap[char as keyof typeof thaiConsonantMap] || char
  );
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type commonUploadFileProps = {
  picture: File;
  imageId: string;
  imageFolder: string;
};

export type commonUploadFileReturn = Promise<
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

export function sanitizeFilename(filename: string) {
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
  const safeImageId = transliterateThaiConsonants(imageId);

  const temp_imageFilename =
    safeImageId +
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

export async function getImageArray(
  imageFolder: string,
  imageId: string,
  setImageArray: (imageArray: storageObjectType[]) => void
) {
  const safeImageId = transliterateThaiConsonants(imageId);

  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from("pictures")
    .list(`public/${imageFolder}`, {
      limit: 100,
      offset: 0,
      search: safeImageId,
      sortBy: { column: "updated_at", order: "asc" },
    });

  if (!!error) console.log(error);
  if (!!data) {
    setImageArray(data);
    //setCount(data.length + 1);
  }
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

export async function checkImageExist(imageFolder: string, imageId: string) {
  const safeImageId = transliterateThaiConsonants(imageId);

  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from("pictures")
    .list(`public/${imageFolder}`, {
      limit: 100,
      offset: 0,
      search: safeImageId,
      sortBy: { column: "updated_at", order: "asc" },
    });

  if (!!error) console.log(error);
  if (!!data) {
    return data.length > 0;
  }
  return false;
}
