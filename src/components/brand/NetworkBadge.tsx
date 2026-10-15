export function NetworkBadge({ cluster = "devnet" }: { cluster?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#3ca6ff]/40 bg-black/50 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-[#8fd0ff]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#3ca6ff]" aria-hidden /> {cluster}
    </span>
  );
}
