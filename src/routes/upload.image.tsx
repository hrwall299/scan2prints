import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/upload/image")({
  head: () => ({ meta: [{ title: "Photo printing — PRINTORA" }, { name: "description", content: "Arrange photos on an A4 page." }, { property: "og:title", content: "Photo printing — PRINTORA" }, { property: "og:description", content: "Arrange photos on an A4 page." }] }),
  component: () => <ComingSoon title="Photo printing" />,
});
