import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function ErrorPage() {
  return (
    <main className="h-full grid place-content-center">
      <header className="flex flex-col gap-2 items-center justify-center ">
        <h1 className="text-4xl text-gray-800">K C W</h1>
        <p className="text-xs text-gray-600">เกียรติชัยอะไหล์ยนต์</p>
      </header>

      <div className="text-red-600 p-8 text-sm text-center">
        ชื่อบัญชีและรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง
      </div>

      <Link href="/" passHref className="w-fit justify-self-center">
        <Button>เข้าสู่ระบบ</Button>
      </Link>
    </main>
  );
}
