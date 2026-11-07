import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { createSignupClient } from "@/lib/supabase/signup";
import { signupRedirect } from "@/lib/auth/signup-confirmation";

export function useAccount(onAuthenticated: () => void) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [mode, setMode] = useState<"login" | "signup">("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [resendSeconds, setResendSeconds] = useState(0),
    [notice, setNotice] = useState<
      "sent" | "error" | "unconfirmed" | "rate" | "logout" | null
    >(null);
  const lock = useRef(false);
  useEffect(() => {
    if (!resendSeconds) return;
    const timer = setTimeout(() => setResendSeconds((n) => Math.max(0, n - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendSeconds]);
  function confirmationRedirect() {
    let storage: Storage | null = null;
    try { storage = localStorage; } catch { /* Only optional same-browser login is affected. */ }
    return signupRedirect(location.origin, email, storage, crypto.randomUUID());
  }
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
          ? await createSignupClient().auth.signUp({
              email: email.trim(),
              password,
              options: {
                emailRedirectTo: confirmationRedirect(),
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
        } else {
          setNotice("sent");
          setResendSeconds(60);
        }
        setPassword("");
      }
    } catch {
      setNotice("error");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function resendConfirmation() {
    if (lock.current || resendSeconds || !email.trim()) return;
    lock.current = true;
    setBusy(true);
    try {
      const { error } = await createSignupClient().auth.resend({
        type: "signup", email: email.trim(),
        options: { emailRedirectTo: confirmationRedirect() },
      });
      setNotice(error ? error.code?.includes("rate_limit") ? "rate" : "error" : "sent");
      setResendSeconds(60);
    } catch { setNotice("error"); }
    finally { lock.current = false; setBusy(false); }
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
    resendSeconds,
    resendConfirmation,
  };
}
export type Account = ReturnType<typeof useAccount>;
