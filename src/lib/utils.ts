import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function commonUploadFile(
  picture: File,
  imageId: string,
  imageFolder: string
): Promise<
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
> {
  const temp_imageFilename =
    imageId +
    "_" +
    Math.random().toString().substring(4, 12) +
    "." +
    picture.name.split(".")[1];

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
