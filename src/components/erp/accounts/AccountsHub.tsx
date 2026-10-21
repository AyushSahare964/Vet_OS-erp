import { Link } from "@tanstack/react-router";
import { ChevronRight, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { BookView, DailySummaryView, PaymentRegisterView } from "./MoneyViews";
import { ChartOfAccountsView, BalanceSheetView } from "./PositionViews";
import { ProfitLossView, TaxView } from "./StatementViews";
import {
  ACCOUNT_REPORTS,
  DEFAULT_ACCOUNT_REPORT,
  isAccountReport,
  type AccountReportId,
} from "./reports";

function Report({ id }: { id: AccountReportId }) {
  switch (id) {
    case "cash-book":
      return <BookView scope="CASH" />;
    case "business-book":
      return <BookView scope="BUSINESS" />;
    case "payment-paid":
      return <PaymentRegisterView direction="OUT" />;
    case "payment-received":
      return <PaymentRegisterView direction="IN" />;
    case "daily-summary":
      return <DailySummaryView />;
    case "gst":
      return <TaxView />;
    case "profit-loss":
      return <ProfitLossView />;
    case "chart-of-accounts":
      return <ChartOfAccountsView />;
    case "balance-sheet":
      return <BalanceSheetView />;
  }
}

/** Accounts module: nine reports, all derived live from billing, purchases, payments, expenses and stock. */
export function AccountsHub({ report }: { report?: string | undefined }) {
  const active = isAccountReport(report) ? report : DEFAULT_ACCOUNT_REPORT;
  const current = ACCOUNT_REPORTS.find((r) => r.id === active);

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Landmark className="size-3.5 text-primary" />
        <span>Accounts</span>
        <ChevronRight className="size-3" />
        <span className="font-semibold text-foreground">{current?.label}</span>
      </nav>

      {/* Report picker: the floating side bars have no sub-menu. */}
      <nav className="flex flex-wrap gap-1.5 pb-1" aria-label="Accounts reports">
        {ACCOUNT_REPORTS.map((r) => (
          <Link
            key={r.id}
            to="/m/$moduleId"
            params={{ moduleId: "accounts" }}
            search={{ tab: "statements", sub: r.id } as never}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium",
              r.id === active
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {r.label}
          </Link>
        ))}
      </nav>

      <Report key={active} id={active} />
    </div>
  );
}
