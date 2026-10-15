"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ClientApiError } from "@/lib/client/api";
import { signinSchema, signupSchema } from "@/lib/validation-auth";

type Mode = "login" | "signup";

const FIELDS: Record<Mode, { name: string; label: string; type: string; autoComplete: string }[]> = {
  signup: [
    { name: "username", label: "Username", type: "text", autoComplete: "username" },
    { name: "email", label: "Email", type: "email", autoComplete: "email" },
    { name: "password", label: "Password", type: "password", autoComplete: "new-password" },
    { name: "confirmPassword", label: "Confirm password", type: "password", autoComplete: "new-password" },
  ],
  login: [
    { name: "identifier", label: "Email or username", type: "text", autoComplete: "username" },
    { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
  ],
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isSignup = mode === "signup";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const values = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const parsed = (isSignup ? signupSchema : signinSchema).safeParse(values);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) fe[String(i.path[0] ?? "_")] ??= i.message;
      setErrors(fe);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await api(isSignup ? "/api/v1/signup" : "/api/v1/signin", { method: "POST", body: values });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      if (err instanceof ClientApiError) {
        if (err.error.details) setErrors(err.error.details);
        setFormError(err.error.message);
      } else setFormError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-24">
      <form onSubmit={onSubmit} noValidate className="surface w-full max-w-sm space-y-5 p-6 sm:p-8" aria-busy={busy}>
        <div>
          <h1 className="font-mono text-2xl font-semibold text-white">{isSignup ? "Create your wallet" : "Sign in"}</h1>
          <p className="mt-1 text-sm text-slate-400">{isSignup ? "A Devnet Solana wallet, ready in seconds." : "Welcome back to arc."}</p>
        </div>
        {FIELDS[mode].map((f) => (
          <div key={f.name} className="space-y-1.5">
            <Label htmlFor={f.name}>{f.label}</Label>
            <Input id={f.name} name={f.name} type={f.type} autoComplete={f.autoComplete} aria-invalid={!!errors[f.name]} aria-describedby={errors[f.name] ? `${f.name}-err` : undefined} />
            {errors[f.name] && <p id={`${f.name}-err`} role="alert" className="text-xs text-red-300">{errors[f.name]}</p>}
          </div>
        ))}
        {formError && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{formError}</p>}
        <Button type="submit" className="w-full" size="lg" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {isSignup ? "Create wallet" : "Sign in"}
        </Button>
        <p className="text-center text-sm text-slate-400">
          {isSignup ? "Already have an account? " : "New to arc? "}
          <Link href={isSignup ? "/login" : "/signup"} className="text-[#3ca6ff] underline-offset-4 hover:underline">
            {isSignup ? "Sign in" : "Create a wallet"}
          </Link>
        </p>
      </form>
    </main>
  );
}
