import Link from "next/link";
import { ArcLogo } from "./ArcLogo";

/** Top bar. The arc logo sits at the top right on every page. */
export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-4 px-4 py-3 sm:px-8 sm:py-5">
      <div className="flex items-center gap-3 font-mono text-xs text-slate-300">{children}</div>
      <Link href="/" aria-label="arc home" className="rounded-xl outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#3ca6ff]">
        <ArcLogo />
      </Link>
    </header>
  );
}
