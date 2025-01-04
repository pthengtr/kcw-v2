import { logout } from "@/app/(auth)/action";
import { Button } from "../ui/button";
import { LogOutIcon } from "lucide-react";

export default function LogoutButton() {
  return (
    <>
      <Button onClick={logout}>
        <LogOutIcon />
      </Button>
    </>
  );
}
