import { createClient } from "@supabase/supabase-js";

export default function ResetPassword() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const adminAuthClient = supabase.auth.admin;

  async function updatePassword() {
    const { data: user, error } = await adminAuthClient.updateUserById(
      "3c2c7a17-ef66-42bc-a29f-2524a30a600a",
      {
        password: "123456",
      }
    );

    if (!!error) console.log(error);
    if (!!user) console.log(user);
  }

  updatePassword();

  return <main>Reset Password</main>;
}
