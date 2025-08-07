import { EllipsisVertical } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

type ResetTableCookiesDropdownProps = {
  handleResetCookies: () => void;
};
export default function ResetTableCookiesDropdown({
  handleResetCookies,
}: ResetTableCookiesDropdownProps) {
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="hidden h-8 lg:flex">
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={handleResetCookies}>
            ลบความจำรูปแบบตาราง ใช้ค่าเริ่มต้นในครั้งต่อไป
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
