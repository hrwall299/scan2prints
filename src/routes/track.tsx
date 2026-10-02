import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/track")({
  head: () => ({ meta: [{ title: "Track order — PRINTORA" }, { name: "description", content: "Check your print order status." }, { property: "og:title", content: "Track order — PRINTORA" }, { property: "og:description", content: "Check your print order status." }] }),
  component: () => <ComingSoon title="Track your order" />,
});
