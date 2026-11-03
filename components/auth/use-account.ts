import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export function useAccount(onAuthenticated: () => void) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [mode, setMode] = useState<"login" | "signup">("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [notice, setNotice] = useState<
      "sent" | "error" | "unconfirmed" | "rate" | "logout" | null
    >(null);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    const client = createClient();
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_e, s) => {
      if (active) {
        setUser(s?.user ?? null);
        if (s?.user) onAuthenticated();
        setLoading(false);
      }
    });
    void client.auth
      .getUser()
      .then(({ data }) => {
        if (active) {
          setUser(data.user);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoading(false);
          setNotice("error");
        }
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [onAuthenticated]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const client = createClient();
      const { data, error } =
        mode === "signup"
          ? await client.auth.signUp({
              email: email.trim(),
              password,
              options: {
                emailRedirectTo: new URL(
                  "/auth/callback",
                  location.origin,
                ).toString(),
              },
            })
          : await client.auth.signInWithPassword({
              email: email.trim(),
              password,
            });
      if (error)
        setNotice(
          error.code === "email_not_confirmed"
            ? "unconfirmed"
            : error.code?.includes("rate_limit")
              ? "rate"
              : "error",
        );
      else {
        if (data.session) {
          setUser(data.user);
          onAuthenticated();
        } else setNotice("sent");
        setPassword("");
      }
    } catch {
      setNotice("error");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function logout() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const { error } = await createClient().auth.signOut();
      if (error) setNotice("error");
      else {
        setUser(null);
        setPassword("");
        setNotice("logout");
      }
    } catch {
      setNotice("error");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return {
    user,
    loading,
    busy,
    mode,
    setMode,
    email,
    setEmail,
    password,
    setPassword,
    notice,
    setNotice,
    submit,
    logout,
  };
}
export type Account = ReturnType<typeof useAccount>;
