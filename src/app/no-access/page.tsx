import LogoutButton from "@/components/auth/LogoutButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NoAccessPage() {
  return (
    <main className="grid min-h-[calc(100vh-3.5rem)] place-content-center px-4">
      <Card className="w-full max-w-md border-slate-200/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">ยังไม่มีสิทธิ์ใช้งาน</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            บัญชีนี้เข้าสู่ระบบได้แล้ว แต่ยังไม่ถูกจัดเข้ากลุ่มสิทธิ์ (role)
            จึงเข้าใช้งานระบบไม่ได้
          </p>
          <p>
            ติดต่อผู้ดูแลระบบเพื่อเพิ่มคุณเข้ากลุ่ม เช่น{" "}
            <span className="font-medium text-slate-800">normal</span> หรือ{" "}
            <span className="font-medium text-slate-800">admin</span>
          </p>
          <LogoutButton />
        </CardContent>
      </Card>
    </main>
  );
}
