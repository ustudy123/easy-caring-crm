import { Smartphone, Store as StoreIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InstanceInfo {
  id: string;
  name: string;
  instance_type: "store" | "seller";
}

// Stable color hash → semantic chip backgrounds
const PALETTE = [
  "bg-brand-500/10 text-brand-500 border-brand-500/20",
  "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20",
  "bg-sky-500/10 text-sky-600 border-sky-500/20",
  "bg-rose-500/10 text-rose-600 border-rose-500/20",
];

function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function InstanceBadge({
  instance,
  size = "sm",
  className,
}: {
  instance?: InstanceInfo | null;
  size?: "xs" | "sm";
  className?: string;
}) {
  if (!instance) return null;
  const Icon = instance.instance_type === "store" ? StoreIcon : Smartphone;
  const palette = colorFor(instance.id);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold shrink-0",
        size === "xs" ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-0.5",
        palette,
        className
      )}
      title={`${instance.instance_type === "store" ? "Loja" : "Vendedor"} · ${instance.name}`}
    >
      <Icon className={size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      <span className="truncate max-w-[120px]">{instance.name}</span>
    </span>
  );
}