import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-11 w-full rounded-lg border border-[#3ca6ff]/30 bg-black/50 px-3 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#3ca6ff] focus:outline-none aria-[invalid=true]:border-red-400",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
