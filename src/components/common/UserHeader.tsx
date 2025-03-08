import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserType } from "../user/UserColumns";
import { createClient } from "@/lib/supabase/client";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useState } from "react";
import { Trash, SquareUserRound } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "../ui/button";

type UserAvatarProps = {
  user: UserType;
  size: string;
};

export default function UserHeader({ user, size }: UserAvatarProps) {
  const [rand, setRand] = useState("");

  function handleFileChange(e: React.BaseSyntheticEvent) {
    uploadFile(e.target.files[0]);
  }

  async function deleteFile() {
    const supabase = createClient();

    const { data, error } = await supabase.storage
      .from("pictures")
      .remove([`public/avatar/${user.employeeId}.jpg`]);

    if (!!error) console.log(error);
    if (!!data) {
      setRand(Math.random().toString().substring(4, 12));
    }
  }

  async function uploadFile(picture: File) {
    const temp_imageFilename = user.employeeId + ".jpg";

    const supabase = createClient();

    const { data, error } = await supabase.storage
      .from("pictures")
      .upload(`public/avatar/${temp_imageFilename}`, picture);

    if (!!error) console.log(error);
    if (!!data) {
      setRand(Math.random().toString().substring(4, 12));
    }
  }

  return (
    <div className="flex flex-col gap-2 items-center">
      <Avatar className={`${size} relative`}>
        <AvatarImage
          src={`https://jdzitzsucntqbjvwiwxm.supabase.co/storage/v1/object/public/pictures/public/avatar/${user.employeeId}.jpg?id=${rand}`}
        />
        <AvatarFallback>{user.nickname}</AvatarFallback>
      </Avatar>
      <div className="flex gap-2">
        <AddProfilePictureButton handleFileChange={handleFileChange} />
        <DeleteProfilePictureButton deleteFile={deleteFile} />
      </div>
    </div>
  );
}

type AddProfilePictureButtonProps = {
  handleFileChange: (e: React.BaseSyntheticEvent) => void;
};

function AddProfilePictureButton({
  handleFileChange,
}: AddProfilePictureButtonProps) {
  return (
    <>
      <Input
        id="avatar"
        className="hidden"
        type="file"
        onChange={handleFileChange}
      />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger className="grid place-content-center">
            <Label
              htmlFor="avatar"
              className="rounded-md  p-2 hover:bg-gray-200 hover:cursor-pointer"
            >
              <SquareUserRound size={18} />
            </Label>
          </TooltipTrigger>
          <TooltipContent>
            <p>เปลี่ยนรูปโปรไฟล์</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </>
  );
}

type DeleteProfilePictureButtonProps = {
  deleteFile: () => void;
};

function DeleteProfilePictureButton({
  deleteFile,
}: DeleteProfilePictureButtonProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => setDeleteDialogOpen(true)}
              className="bg-white shadow-none text-neutral-900 hover:bg-gray-200 p-2"
            >
              <Trash size={16} strokeWidth={2.4} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>ลบรูปโปรไฟล์</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการลบรูปโปรไฟล์</DialogTitle>
            <DialogDescription>
              รูปโปรไฟล์ที่ถูกลบไม่สามารถกู้คืนได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-4">
            <DialogClose className="bg-primary text-white p-2 rounded-md hover:bg-blue-500">
              ยกเลิก
            </DialogClose>
            <DialogClose
              className="hover:bg-gray-200 p-2 rounded-md"
              onClick={deleteFile}
            >
              ยืนยัน
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
