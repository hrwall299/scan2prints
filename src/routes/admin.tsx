import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Shop dashboard — PRINTORA" }, { name: "description", content: "Manage print orders." }, { property: "og:title", content: "Shop dashboard — PRINTORA" }, { property: "og:description", content: "Manage print orders." }] }),
  component: () => <ComingSoon title="Shop dashboard" />,
});
