"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyButton({ value, label = "Copy", size = "md" }: { value: string; label?: string; size?: "sm" | "md" }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 1800);
  }
  return (
    <Button type="button" variant="outline" size={size} onClick={copy} aria-live="polite">
      {state === "copied" ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {state === "copied" ? "Copied" : state === "error" ? "Copy failed" : label}
    </Button>
  );
}
