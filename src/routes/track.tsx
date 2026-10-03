import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { CheckCircle2, Clock, Printer, XCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trackOrder } from "@/lib/orders.functions";

export const Route = createFileRoute("/track")({
  validateSearch: z.object({ n: z.coerce.number().int().positive().optional(), t: z.string().optional() }),
  head: () => ({ meta: [{ title: "Track order — PRINTORA" }, { name: "description", content: "Check your print order status." }, { property: "og:title", content: "Track order — PRINTORA" }, { property: "og:description", content: "Check your print order status." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: TrackPage,
});

const STEPS = [
  { key: "pending", label: "Received", icon: Clock },
  { key: "approved", label: "In queue", icon: Clock },
  { key: "printing", label: "Printing", icon: Printer },
  { key: "completed", label: "Ready", icon: CheckCircle2 },
];

function TrackPage() {
  const { n, t } = Route.useSearch();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const valid = !!n && !!t && /^[0-9a-f]{32}$/.test(t);
  const q = useQuery({
    queryKey: ["track", n, t],
    enabled: valid,
    refetchInterval: 15000,
    queryFn: () => trackOrder({ data: { orderNumber: n!, token: t! } }),
  });
  const o = q.data;
  const link = typeof window !== "undefined" ? window.location.href : "";

  function lookup(e: React.FormEvent) {
    e.preventDefault();
    try {
      const u = new URL(code.trim());
      const nn = Number(u.searchParams.get("n"));
      const tt = u.searchParams.get("t") ?? "";
      navigate({ to: "/track", search: { n: nn, t: tt } });
    } catch {
      toast.error("Paste the full tracking link you got after ordering");
    }
  }

  const idx = o ? STEPS.findIndex((s) => s.key === o.status) : -1;

  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="font-display text-3xl font-bold">Track your order</h1>
        {!valid && (
          <form onSubmit={lookup} className="mt-6 flex gap-2">
            <Input placeholder="Paste your tracking link" value={code} onChange={(e) => setCode(e.target.value)} />
            <Button type="submit">Track</Button>
          </form>
        )}
        {valid && q.isLoading && <p className="mt-6 text-muted-foreground">Loading…</p>}
        {valid && !q.isLoading && !o && <p className="mt-6 text-destructive">Order not found. Check your tracking link.</p>}
        {o && (
          <div className="mt-6 space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Order</p>
                  <p className="font-display text-4xl font-bold text-primary">#{o.order_number}</p>
                  <p className="mt-1 text-sm">{o.customer_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Estimated</p>
                  <p className="font-display text-2xl font-bold">{o.currency}{Number(o.estimated_price).toFixed(2)}</p>
                </div>
              </div>
              {o.status === "rejected" ? (
                <div className="mt-6 flex gap-3 rounded-xl bg-destructive/10 p-4 text-destructive">
                  <XCircle className="h-5 w-5 shrink-0" />
                  <div><p className="font-semibold">Order declined</p>{o.reject_reason && <p className="text-sm">{o.reject_reason}</p>}</div>
                </div>
              ) : (
                <ol className="mt-6 grid grid-cols-4 gap-2">
                  {STEPS.map((s, i) => (
                    <li key={s.key} className="text-center">
                      <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full ${i <= idx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}><s.icon className="h-5 w-5" /></div>
                      <p className={`mt-2 text-xs font-medium ${i <= idx ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</p>
                    </li>
                  ))}
                </ol>
              )}
              {o.status === "completed" && <p className="mt-4 rounded-lg bg-success-soft p-3 text-center font-semibold text-success">Your prints are ready. Show order #{o.order_number} at the counter.</p>}
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 text-sm">
              <p><span className="text-muted-foreground">Options:</span> {o.color_mode === "bw" ? "B&W" : "Colour"} · {o.page_size} · {o.paper_type} · {o.sides}-sided · {o.copies} copies · {o.page_count} pages</p>
              {o.mode === "image" && <p className="mt-1"><span className="text-muted-foreground">Layout:</span> {o.layout}</p>}
              <ul className="mt-3 list-disc pl-5">{o.order_files?.map((f, i) => <li key={i}>{f.file_name}</li>)}</ul>
            </div>
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copied — keep it to check later"); }}>
              <Copy className="h-4 w-4" /> Copy tracking link
            </Button>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
