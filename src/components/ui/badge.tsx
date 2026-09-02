import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "muted",
  children,
}: {
  className?: string;
  tone?: "muted" | "ok" | "warn" | "accent" | "danger";
  children: ReactNode;
}) {
  const tones = {
    muted: "bg-elevated text-muted border-border",
    ok: "bg-ok/12 text-ok border-ok/25",
    warn: "bg-warn/12 text-warn border-warn/25",
    accent: "bg-accent/12 text-accent border-accent/25",
    danger: "bg-danger/12 text-danger border-danger/25",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
