import { Hourglass } from "lucide-react";

/** Shared placeholder for sections that are planned but not built yet. No fake data. */
export function ComingSoon({ title, line }: { title: string; line?: string | undefined }) {
  return (
    <div className="erp-card mx-auto flex max-w-xl flex-col items-center gap-2 p-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Hourglass className="size-6" aria-hidden="true" />
      </span>
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{line ?? "This section is coming soon."}</p>
      <span className="mt-1 rounded-full bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Coming soon</span>
    </div>
  );
}
