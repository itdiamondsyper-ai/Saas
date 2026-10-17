import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  format,
  change,
  positiveIsGood = true,
  hint,
  footnote,
}: {
  label: string;
  value: number;
  format: "currency" | "number" | "percent";
  change?: number | null;
  positiveIsGood?: boolean;
  hint?: string;
  footnote?: string;
}) {
  const formatted =
    format === "currency" ? formatCurrency(value) : format === "percent" ? `${value.toFixed(1)}%` : formatNumber(value);
  const good = change === null || change === undefined ? null : change === 0 ? null : change > 0 === positiveIsGood;
  return (
    <div className="min-w-0 rounded-xl border bg-card p-3 sm:p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tracking-tight tabular sm:text-2xl">{formatted}</p>
      <div className="mt-1.5 flex min-h-5 items-center gap-1.5 text-xs">
        {change !== undefined && change !== null ? (
          <>
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 font-medium tabular",
                good === null ? "bg-muted text-muted-foreground" : good ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
              )}
            >
              {change > 0 ? <ArrowUpRight className="size-3" aria-hidden /> : change < 0 ? <ArrowDownRight className="size-3" aria-hidden /> : null}
              {formatPercent(change)}
            </span>
            {hint && <span className="text-muted-foreground max-sm:hidden">{hint}</span>}
          </>
        ) : (
          <span className="text-muted-foreground">{footnote ?? (hint ? `No data to compare ${hint.replace("vs. ", "with ")}` : "")}</span>
        )}
      </div>
    </div>
  );
}
