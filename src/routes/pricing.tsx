import { createFileRoute } from "@tanstack/react-router";
import Pricing from "@/components/landing/Pricing";
import { landingHeadLinks } from "@/components/landing/landingHead";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [{ title: "Pricing — VetechIQ" }, { name: "description", content: "Simple plans for every veterinary clinic. Start a free trial today." }],
    links: landingHeadLinks,
  }),
  component: Pricing,
});
