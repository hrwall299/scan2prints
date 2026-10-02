import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/upload/")({
  head: () => ({ meta: [{ title: "Upload files — PRINTORA" }, { name: "description", content: "Upload documents or photos to print." }, { property: "og:title", content: "Upload files — PRINTORA" }, { property: "og:description", content: "Upload documents or photos to print." }] }),
  component: () => <ComingSoon title="Upload files" />,
});
