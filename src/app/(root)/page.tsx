import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function Home() {
  redirect("/home");

  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
