type ProductImageFallbackProps = {
  sku: string;
  name: string;
  brand?: string | null;
  compact?: boolean;
  className?: string;
};

function buildShortTitle(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    return "Запчасть";
  }

  const words = normalized.split(/\s+/).slice(0, 3);
  return words.join(" ");
}

export function ProductImageFallback({
  sku,
  name,
  brand,
  compact = false,
  className = "",
}: ProductImageFallbackProps) {
  const title = buildShortTitle(name);

  return (
    <div
      className={`relative flex h-full w-full overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(255,122,0,0.22),_transparent_40%),linear-gradient(135deg,_#1F3B73_0%,_#14294F_55%,_#0F1C35_100%)] text-white ${className}`}
    >
      <div className="absolute inset-0 opacity-20">
        <div className="absolute -left-6 top-5 h-16 w-16 rounded-full border border-white/40" />
        <div className="absolute right-3 top-3 h-8 w-8 rounded-full bg-white/10" />
        <div className="absolute bottom-4 left-4 h-3 w-20 rounded-full bg-white/15" />
        <div className="absolute bottom-8 right-6 h-3 w-12 rounded-full bg-[#FF7A00]/40" />
      </div>

      <div
        className={`relative flex h-full w-full flex-col justify-between ${compact ? "p-3" : "p-5"}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={`font-semibold tracking-[0.18em] text-white/75 ${compact ? "text-[9px]" : "text-[11px]"}`}
          >
            VSE ZAPCHASTI
          </span>
          <span
            className={`rounded-full border border-white/20 bg-white/10 text-white/85 ${compact ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]"}`}
          >
            {brand?.trim() || "PARTS"}
          </span>
        </div>

        <div className="space-y-2">
          <div
            className={`max-w-[12rem] font-semibold leading-tight ${compact ? "text-xs" : "text-lg"}`}
          >
            {title}
          </div>
          <div
            className={`text-white/70 ${compact ? "text-[10px]" : "text-xs"}`}
          >
            Артикул: {sku}
          </div>
        </div>
      </div>
    </div>
  );
}
