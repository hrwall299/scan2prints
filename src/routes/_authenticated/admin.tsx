import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDown, ArrowUp, Check, Download, FileText, LayoutDashboard, ListOrdered, LogOut, Printer, Settings, BarChart3, X, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getFileUrls } from "@/lib/admin.functions";
import { money } from "@/lib/pricing";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Shop dashboard — PRINTORA" }, { name: "description", content: "Manage print orders, queue, printers and pricing." }, { property: "og:title", content: "Shop dashboard — PRINTORA" }, { property: "og:description", content: "Manage print orders, queue, printers and pricing." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

type Order = Tables<"orders">;
type Settings = Tables<"shop_settings">;
type PrinterRow = Tables<"printers">;

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "orders", label: "Live Orders", icon: Inbox },
  { key: "queue", label: "Print Queue", icon: ListOrdered },
  { key: "printers", label: "Printers", icon: Printer },
  { key: "settings", label: "Printing Settings", icon: Settings },
  { key: "usage", label: "Monthly Usage", icon: BarChart3 },
] as const;
type Tab = (typeof TABS)[number]["key"];

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-warning-soft text-warning",
  approved: "bg-info-soft text-info",
  printing: "bg-primary-soft text-primary",
  completed: "bg-success-soft text-success",
  rejected: "bg-destructive/10 text-destructive",
};

function StatusBadge({ s }: { s: string }) {
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", STATUS_STYLE[s])}>{s === "approved" ? "in queue" : s}</span>;
}

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");

  const role = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase.rpc("has_role", { _user_id: u.user!.id, _role: "admin" });
      return !!data;
    },
  });
  const isAdmin = role.data === true;

  const orders = useQuery({
    queryKey: ["admin-orders"],
    enabled: isAdmin,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data;
    },
  });
  const settings = useQuery({
    queryKey: ["admin-settings"],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("shop_settings").select("*").eq("id", 1).single()).data as Settings,
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (role.isLoading) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  if (!isAdmin)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="font-display text-2xl font-bold">No shop access</h1>
        <p className="text-muted-foreground">This account isn't the shop admin.</p>
        <Button variant="outline" onClick={signOut}>Sign out</Button>
      </div>
    );

  const list = orders.data ?? [];
  const s = settings.data;
  const pendingCount = list.filter((o) => o.status === "pending").length;

  return (
    <div className="flex min-h-screen flex-col bg-paper md:flex-row">
      <aside className="border-b border-border bg-card md:sticky md:top-0 md:h-screen md:w-60 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between p-4"><Logo /></div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium", tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
              <t.icon className="h-4 w-4" />{t.label}
              {t.key === "orders" && pendingCount > 0 && <span className="ml-auto rounded-full bg-accent px-1.5 text-xs text-accent-foreground">{pendingCount}</span>}
            </button>
          ))}
          <button onClick={signOut} className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted md:mt-4"><LogOut className="h-4 w-4" />Sign out</button>
        </nav>
      </aside>
      <main className="flex-1 p-4 md:p-8">
        {!s ? <p className="text-muted-foreground">Loading…</p> : (
          <>
            {tab === "overview" && <Overview orders={list} s={s} />}
            {tab === "orders" && <LiveOrders orders={list} s={s} />}
            {tab === "queue" && <Queue orders={list} s={s} />}
            {tab === "printers" && <Printers />}
            {tab === "settings" && <SettingsForm s={s} />}
            {tab === "usage" && <Usage orders={list} s={s} />}
          </>
        )}
      </main>
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h1 className="mb-6 font-display text-2xl font-bold">{children}</h1>;
}
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-card p-4 shadow-soft"><div className="text-sm text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-bold">{value}</div></div>;
}

function useUpdateOrder() {
  const qc = useQueryClient();
  return async (id: string, patch: Partial<Order>) => {
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return false; }
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
    return true;
  };
}

function Overview({ orders, s }: { orders: Order[]; s: Settings }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const today = new Date().toDateString();
  const todays = orders.filter((o) => new Date(o.created_at).toDateString() === today);
  const revenue = todays.filter((o) => o.status === "completed").reduce((a, o) => a + Number(o.estimated_price), 0);
  const url = `${origin}/upload`;
  function downloadQR() {
    const c = document.getElementById("shop-qr") as HTMLCanvasElement | null;
    if (!c) return;
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = "printora-qr.png";
    a.click();
  }
  return (
    <div>
      <H>{s.shop_name}</H>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Orders today" value={todays.length} />
        <Stat label="Waiting approval" value={orders.filter((o) => o.status === "pending").length} />
        <Stat label="In queue / printing" value={orders.filter((o) => o.status === "approved" || o.status === "printing").length} />
        <Stat label="Completed revenue today" value={money(s, revenue)} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 text-center shadow-soft">
          <h2 className="font-semibold">Shop QR code</h2>
          <p className="mb-4 text-sm text-muted-foreground">Print this and stick it on the counter. Customers scan it to upload files.</p>
          {origin && <div className="inline-block rounded-xl bg-paper p-4"><QRCodeCanvas id="shop-qr" value={url} size={200} includeMargin /></div>}
          <p className="mt-2 break-all text-xs text-muted-foreground">{url}</p>
          <Button className="mt-4" variant="outline" onClick={downloadQR}><Download className="mr-2 h-4 w-4" />Download QR</Button>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
          <h2 className="mb-3 font-semibold">Latest orders</h2>
          <ul className="divide-y divide-border">
            {orders.slice(0, 8).map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                <span>#{o.order_number} · {o.customer_name}</span>
                <span className="flex items-center gap-3"><span className="text-muted-foreground">{money(s, Number(o.estimated_price))}</span><StatusBadge s={o.status} /></span>
              </li>
            ))}
            {!orders.length && <li className="py-6 text-center text-sm text-muted-foreground">No orders yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

function OrderCard({ o, s, actions }: { o: Order; s: Settings; actions: React.ReactNode }) {
  const fetchFiles = useServerFn(getFileUrls);
  const [files, setFiles] = useState<{ id: string; file_name: string; url: string | null; page_count: number }[] | null>(null);
  async function loadFiles() {
    try { setFiles(await fetchFiles({ data: { orderId: o.id } })); } catch { toast.error("Could not load files"); }
  }
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2"><span className="font-bold">#{o.order_number}</span><StatusBadge s={o.status} /><Badge variant="outline" className="capitalize">{o.mode}</Badge></div>
          <div className="mt-1 text-sm">{o.customer_name}{o.customer_phone && <span className="text-muted-foreground"> · {o.customer_phone}</span>}</div>
          <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
        </div>
        <div className="text-right"><div className="text-lg font-bold">{money(s, Number(o.estimated_price))}</div></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
        {[o.color_mode === "color" ? "Colour" : "B&W", `${o.page_count} pages`, `${o.copies} copies`, o.page_size, o.paper_type, o.sides === "double" ? "Double-sided" : "Single-sided", o.layout !== "standard" ? o.layout : null].filter(Boolean).map((t) => (
          <span key={t as string} className="rounded-md bg-muted px-2 py-0.5 capitalize">{t}</span>
        ))}
      </div>
      {o.notes && <p className="mt-2 rounded-md bg-accent-soft p-2 text-sm">Note: {o.notes}</p>}
      {o.reject_reason && <p className="mt-2 text-sm text-destructive">Rejected: {o.reject_reason}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {o.files_deleted_at ? <span className="text-xs text-muted-foreground">Files removed after cleanup</span> : files ? (
          files.map((f) => f.url && <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"><FileText className="h-3 w-3" />{f.file_name}</a>)
        ) : <Button size="sm" variant="ghost" onClick={loadFiles}><FileText className="mr-1 h-4 w-4" />Show files</Button>}
        <div className="ml-auto flex gap-2">{actions}</div>
      </div>
    </div>
  );
}

function LiveOrders({ orders, s }: { orders: Order[]; s: Settings }) {
  const update = useUpdateOrder();
  const [filter, setFilter] = useState("pending");
  const shown = orders.filter((o) => filter === "all" || o.status === filter);
  async function approve(o: Order) {
    const maxPos = Math.max(0, ...orders.map((x) => x.queue_position ?? 0));
    if (await update(o.id, { status: "approved", approved_at: new Date().toISOString(), queue_position: maxPos + 1 })) toast.success(`#${o.order_number} added to queue`);
  }
  async function reject(o: Order) {
    const reason = window.prompt("Reason for rejecting (shown to customer):", "File unreadable");
    if (reason === null) return;
    if (await update(o.id, { status: "rejected", reject_reason: reason.slice(0, 300), rejected_at: new Date().toISOString(), queue_position: null })) toast.success("Order rejected");
  }
  return (
    <div>
      <H>Live Orders</H>
      <div className="mb-4 flex flex-wrap gap-2">
        {["pending", "approved", "printing", "completed", "rejected", "all"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full border px-3 py-1 text-sm capitalize", filter === f ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>{f === "approved" ? "in queue" : f}</button>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {shown.map((o) => (
          <OrderCard key={o.id} o={o} s={s} actions={o.status === "pending" && <>
            <Button size="sm" variant="outline" onClick={() => reject(o)}><X className="mr-1 h-4 w-4" />Reject</Button>
            <Button size="sm" onClick={() => approve(o)}><Check className="mr-1 h-4 w-4" />Approve</Button>
          </>} />
        ))}
      </div>
      {!shown.length && <p className="py-12 text-center text-muted-foreground">Nothing here.</p>}
    </div>
  );
}

function Queue({ orders, s }: { orders: Order[]; s: Settings }) {
  const update = useUpdateOrder();
  const q = orders.filter((o) => o.status === "approved" || o.status === "printing").sort((a, b) => (a.queue_position ?? 0) - (b.queue_position ?? 0));
  async function move(i: number, dir: -1 | 1) {
    const a = q[i], b = q[i + dir];
    if (!a || !b) return;
    await update(a.id, { queue_position: b.queue_position });
    await update(b.id, { queue_position: a.queue_position });
  }
  return (
    <div>
      <H>Print Queue</H>
      <div className="space-y-4">
        {q.map((o, i) => (
          <OrderCard key={o.id} o={o} s={s} actions={<>
            <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" disabled={i === q.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
            {o.status === "approved"
              ? <Button size="sm" variant="outline" onClick={() => update(o.id, { status: "printing" })}><Printer className="mr-1 h-4 w-4" />Start printing</Button>
              : <Button size="sm" onClick={() => update(o.id, { status: "completed", completed_at: new Date().toISOString(), queue_position: null }).then((ok) => ok && toast.success(`#${o.order_number} ready for pickup`))}><Check className="mr-1 h-4 w-4" />Mark ready</Button>}
          </>} />
        ))}
        {!q.length && <p className="py-12 text-center text-muted-foreground">Queue is empty.</p>}
      </div>
    </div>
  );
}

function Printers() {
  const qc = useQueryClient();
  const p = useQuery({ queryKey: ["admin-printers"], queryFn: async () => (await supabase.from("printers").select("*").order("kind")).data ?? [] });
  async function save(id: string, patch: Partial<PrinterRow>) {
    const { error } = await supabase.from("printers").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Printer saved"); qc.invalidateQueries({ queryKey: ["admin-printers"] }); }
  }
  return (
    <div>
      <H>Printer Management</H>
      <div className="grid gap-4 lg:grid-cols-2">
        {(p.data ?? []).map((pr) => <PrinterCard key={pr.id} pr={pr} onSave={(patch) => save(pr.id, patch)} />)}
        {p.data && !p.data.length && <p className="text-muted-foreground">No printers set up.</p>}
      </div>
    </div>
  );
}

function Sel({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div><Label className="mb-1 block text-xs">{label}</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm capitalize">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function PrinterCard({ pr, onSave }: { pr: PrinterRow; onSave: (p: Partial<PrinterRow>) => void }) {
  const [f, setF] = useState(pr);
  const set = (k: keyof PrinterRow) => (v: string | boolean) => setF({ ...f, [k]: v });
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2"><Printer className="h-5 w-5 text-primary" /><span className="font-semibold capitalize">{pr.kind === "color" ? "Colour" : pr.kind === "bw" ? "Black & white" : pr.kind} printer</span></div>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", f.status === "online" ? "bg-success-soft text-success" : f.status === "offline" ? "bg-destructive/10 text-destructive" : "bg-warning-soft text-warning")}>{f.status}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="mb-1 block text-xs">Name</Label><Input value={f.name} onChange={(e) => set("name")(e.target.value)} /></div>
        <div><Label className="mb-1 block text-xs">Model</Label><Input value={f.model} onChange={(e) => set("model")(e.target.value)} /></div>
        <Sel label="Connection" value={f.connection} options={["USB", "Wi-Fi", "Ethernet"]} onChange={set("connection")} />
        <Sel label="Status" value={f.status} options={["online", "offline", "maintenance"]} onChange={set("status")} />
        <Sel label="Default paper" value={f.default_paper} options={["A4", "A3", "Letter", "Legal"]} onChange={set("default_paper")} />
        <Sel label="Quality" value={f.quality} options={["draft", "normal", "high"]} onChange={set("quality")} />
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.duplex} onChange={(e) => set("duplex")(e.target.checked)} />Supports double-sided</label>
      <Button className="mt-4" size="sm" onClick={() => onSave({ name: f.name.slice(0, 80), model: f.model.slice(0, 80), connection: f.connection, status: f.status, default_paper: f.default_paper, quality: f.quality, duplex: f.duplex })}>Save</Button>
    </div>
  );
}

function SettingsForm({ s }: { s: Settings }) {
  const qc = useQueryClient();
  const [f, setF] = useState(s);
  const num = (k: keyof Settings, label: string, step = "0.5") => (
    <div><Label className="mb-1 block text-sm">{label}</Label><Input type="number" min={0} step={step} value={f[k] as number} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} /></div>
  );
  async function save() {
    if ([f.bw_price, f.color_price, f.a3_multiplier, f.glossy_surcharge, f.max_file_mb, f.cleanup_hours].some((n) => !(Number(n) >= 0))) return toast.error("Values must be zero or more");
    if (f.duplex_discount > 100) return toast.error("Discount can't exceed 100%");
    const { id: _i, updated_at: _u, ...rest } = f;
    const { error } = await supabase.from("shop_settings").update({ ...rest, shop_name: rest.shop_name.trim().slice(0, 80) || "PRINTORA", updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) toast.error(error.message); else { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["admin-settings"] }); }
  }
  return (
    <div className="max-w-2xl">
      <H>Printing Settings</H>
      <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-soft">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label className="mb-1 block text-sm">Shop name</Label><Input value={f.shop_name} onChange={(e) => setF({ ...f, shop_name: e.target.value })} /></div>
          <div><Label className="mb-1 block text-sm">Currency symbol</Label><Input maxLength={4} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {num("bw_price", "B&W price per page")}
          {num("color_price", "Colour price per page")}
          {num("a3_multiplier", "A3 price multiplier (×)", "0.1")}
          {num("glossy_surcharge", "Glossy paper extra per page")}
          {num("duplex_discount", "Double-sided discount (%)", "1")}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {num("max_file_mb", "Max file size (MB)", "1")}
          {num("cleanup_hours", "Delete files after (hours)", "1")}
        </div>
        <Button onClick={save}>Save settings</Button>
      </div>
    </div>
  );
}

function Usage({ orders, s }: { orders: Order[]; s: Settings }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const data = useMemo(() => {
    const m = orders.filter((o) => o.status === "completed" && (o.completed_at ?? o.created_at).startsWith(month));
    const sheets = (o: Order) => o.page_count * o.copies;
    const bw = m.filter((o) => o.color_mode === "bw").reduce((a, o) => a + sheets(o), 0);
    const color = m.filter((o) => o.color_mode === "color").reduce((a, o) => a + sheets(o), 0);
    const revenue = m.reduce((a, o) => a + Number(o.estimated_price), 0);
    const [y, mo] = month.split("-").map(Number);
    const days = new Date(y, mo, 0).getDate();
    const daily = Array.from({ length: days }, (_, i) => ({ day: i + 1, bw: 0, color: 0 }));
    for (const o of m) {
      const d = new Date(o.completed_at ?? o.created_at).getDate();
      daily[d - 1][o.color_mode === "color" ? "color" : "bw"] += sheets(o);
    }
    return { count: m.length, bw, color, revenue, daily };
  }, [orders, month]);
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Monthly Usage</h1>
        <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-44" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Completed orders" value={data.count} />
        <Stat label="B&W pages printed" value={data.bw} />
        <Stat label="Colour pages printed" value={data.color} />
        <Stat label="Revenue" value={money(s, data.revenue)} />
      </div>
      <div className="mt-6 h-80 rounded-xl border border-border bg-card p-4 shadow-soft">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="day" fontSize={12} />
            <YAxis fontSize={12} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="bw" name="B&W pages" stackId="a" fill="var(--chart-2)" />
            <Bar dataKey="color" name="Colour pages" stackId="a" fill="var(--chart-1)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
