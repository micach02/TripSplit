import { Link } from "react-router";
import { ChevronRight, MapPin } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/cn";
import { tripPath } from "@/routes/paths";
import type { DashboardTrip } from "@/services/dashboardService";
import {
  budgetTone,
  getBudgetUsage,
} from "@/utils/calculations/budgetCalculator";
import { formatMoney } from "@/utils/calculations/money";
import { coverEmoji, coverGradient } from "@/utils/coverStyle";
import { timeframe } from "@/utils/tripKind";

/** One trip or monthly budget with its spend against budget; links to it. */
export function TripBudgetRow({ trip }: { trip: DashboardTrip }) {
  const usage = getBudgetUsage(trip.spent, trip.budget);
  const tone = budgetTone(usage);

  return (
    <Link
      to={tripPath(trip.id)}
      className="-mx-2 block rounded-xl px-2 py-4 transition-colors first:pt-2 last:pb-2 hover:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-xl",
              coverGradient(trip.id),
            )}
          >
            {coverEmoji(trip.kind)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-bold text-slate-900">{trip.name}</p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-slate-500">
              {trip.destination && (
                <>
                  <MapPin className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{trip.destination}</span>
                  <span aria-hidden>·</span>
                </>
              )}
              <span className="shrink-0">
                {trip.kind === "budget"
                  ? "This month"
                  : timeframe({
                      kind: trip.kind,
                      startDate: trip.start_date,
                      endDate: trip.end_date,
                    })}
              </span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right">
            <p className="font-bold text-slate-900 tabular-nums">
              {formatMoney(trip.spent, trip.currency)}
            </p>
            <p className="text-xs text-slate-500 tabular-nums">
              {trip.budget > 0
                ? `of ${formatMoney(trip.budget, trip.currency)}`
                : "No budget"}
            </p>
          </div>
          <ChevronRight className="size-5 text-slate-300" aria-hidden />
        </div>
      </div>

      {usage.percentUsed !== null && (
        <div className="mt-3">
          <ProgressBar
            value={usage.percentUsed}
            tone={tone}
            label={`${trip.name}: ${usage.percentUsed}% of budget spent`}
          />
          <p
            className={cn(
              "mt-1.5 text-xs font-semibold tabular-nums",
              tone === "danger"
                ? "text-red-600"
                : tone === "warning"
                  ? "text-orange-700"
                  : "text-slate-500",
            )}
          >
            {usage.overBy > 0
              ? `${formatMoney(usage.overBy, trip.currency)} over budget`
              : `${usage.percentUsed}% spent · ${formatMoney(usage.remaining, trip.currency)} left`}
          </p>
        </div>
      )}
    </Link>
  );
}
