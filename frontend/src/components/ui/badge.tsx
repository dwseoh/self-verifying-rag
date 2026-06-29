import { ReactNode } from "react";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "high" | "medium" | "low" | "info";
}) {
  const tones = {
    neutral: "bg-canvas-soft-2 text-body",
    high: "bg-error-soft text-error",
    medium: "bg-warning-soft text-warning",
    low: "bg-link-bg-soft text-link-deep",
    info: "bg-canvas-soft text-ink border border-hairline",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
