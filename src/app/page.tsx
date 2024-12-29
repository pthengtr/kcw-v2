"use client";

import { Session } from "@supabase/supabase-js";
import LoginPage from "@/components/user/LoginPage";
import { useEffect } from "react";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import ProductPage from "@/components/product/ProductPage";

export default function Home() {
  const [session, setSession] = useState<Session | null>();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log(session);
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log(session);
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!session) {
    return <LoginPage />;
  } else {
    return <ProductPage />;
  }
}
