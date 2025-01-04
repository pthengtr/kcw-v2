import LoginForm from "@/components/auth/LoginForm";

export default function Login() {
  return (
    <main className="h-full grid place-content-center">
      <header className="flex flex-col gap-2 items-center justify-center ">
        <h1 className="text-4xl text-gray-800">K C W</h1>
        <p className="text-xs text-gray-600">เกียรติชัยอะไหล์ยนต์</p>
      </header>

      <LoginForm />
    </main>
  );
}
