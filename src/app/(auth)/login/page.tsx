import LoginForm from "@/components/auth/LoginForm";

type LoginPageProps = {
  searchParams?: Promise<{ next?: string }>;
};

export default async function Login({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};

  return (
    <main className="h-full grid place-content-center">
      <header className="flex flex-col gap-2 items-center justify-center ">
        <h1 className="text-4xl text-gray-800">K C W</h1>
        <p className="text-xs text-gray-600">เกียรติชัยอะไหล์ยนต์</p>
      </header>

      <LoginForm next={params.next} />
    </main>
  );
}
