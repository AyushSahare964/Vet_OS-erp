import { createFileRoute } from "@tanstack/react-router";
import { RequestDemoPage } from "@/components/landing/RequestDemoPage";
import { landingHeadLinks } from "@/components/landing/landingHead";

export const Route = createFileRoute("/request-demo")({
  validateSearch: (s: Record<string, unknown>): { interest?: string } => (typeof s["interest"] === "string" ? { interest: s["interest"].slice(0, 20) } : {}),
  head: () => ({
    meta: [{ title: "Request a Demo — VetechIQ" }],
    links: landingHeadLinks,
  }),
  component: RequestDemoPage,
});
