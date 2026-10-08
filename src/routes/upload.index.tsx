import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { FileText, Image as ImageIcon, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { applyPageEdits, initialPages, PdfPageEditor, type PageEdit } from "@/components/PdfPageEditor";
import { defaultOptions, OptionsPanel, placeOrder, PriceSummary, useShopSettings, type Options } from "@/components/OrderOptions";
import { countPdfPages, DOC_EXTS, ext, formatSize, typeLabel, validateFile } from "@/lib/file-utils";

export const Route = createFileRoute("/upload/")({
  head: () => ({ meta: [{ title: "Upload files — PRINTORA" }, { name: "description", content: "Upload documents or photos to print." }, { property: "og:title", content: "Upload files — PRINTORA" }, { property: "og:description", content: "Upload documents or photos to print." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: UploadPage,
});

type Item = { file: File; pages: number; counting: boolean; edits?: PageEdit[] | undefined; editing?: boolean };

function UploadPage() {
  const { data: settings } = useShopSettings();
  const [items, setItems] = useState<Item[]>([]);
  const [o, setO] = useState<Options>(defaultOptions);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  async function add(list: FileList | null) {
    if (!list) return;
    const max = settings?.max_file_mb ?? 25;
    const fresh: Item[] = [];
    for (const f of Array.from(list)) {
      const err = validateFile(f, DOC_EXTS, max);
      if (err) toast.error(err);
      else fresh.push({ file: f, pages: 1, counting: ext(f.name) === "pdf" });
    }
    setItems((p) => [...p, ...fresh].slice(0, 30));
    for (const it of fresh) {
      if (!it.counting) continue;
      const n = await countPdfPages(it.file);
      setItems((p) => p.map((x) => (x.file === it.file ? { ...x, pages: n ?? 1, counting: false, edits: n ? initialPages(n) : undefined } : x)));
    }
  }

  const pages = items.reduce((a, i) => a + i.pages, 0);

  async function submit() {
    if (!items.length) { toast.error("Add at least one file"); return; }
    if (!o.customer_name.trim()) { toast.error("Please enter your name"); return; }
    setBusy(true);
    try {
      const files = await Promise.all(items.map(async (it) => {
        const changed = it.edits && it.edits.some((p, i) => !p.keep || p.rotate || p.src !== i);
        return changed ? { file: await applyPageEdits(it.file, it.edits!), pages: it.pages } : { file: it.file, pages: it.pages };
      }));
      const r = await placeOrder({ mode: "document", files, o, layout: "standard", onProgress: setProgress });
      navigate({ to: "/track", search: { n: r.orderNumber, t: r.token } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send order");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Print documents</h1>
            <p className="mt-1 text-muted-foreground">PDF, Word or images. Up to {settings?.max_file_mb ?? 25} MB per file.</p>
          </div>
          <Link to="/upload/image" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold hover:border-primary">
            <ImageIcon className="h-4 w-4" /> Printing photos? Use the photo editor
          </Link>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
              onClick={() => input.current?.click()}
              className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${drag ? "border-accent bg-accent-soft" : "border-border bg-card hover:border-primary"}`}
            >
              <UploadCloud className="mx-auto h-10 w-10 text-primary" />
              <p className="mt-3 font-semibold">Drop files here or tap to choose</p>
              <p className="text-sm text-muted-foreground">PDF · DOC · DOCX · JPG · PNG</p>
              <input ref={input} type="file" multiple hidden accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
            </div>

            {items.length > 0 && (
              <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                {items.map((it, idx) => (
                  <li key={idx}>
                  <div className="flex flex-wrap items-center gap-3 p-4">
                    <FileText className="h-8 w-8 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{it.file.name}</p>
                      <p className="text-xs text-muted-foreground">{typeLabel(it.file.name)} · {formatSize(it.file.size)}</p>
                    </div>
                    {it.edits && (
                      <label className="flex items-center gap-2 text-sm">
                        Edit pages
                        <Switch checked={!!it.editing} onCheckedChange={(v) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, editing: v } : x)))} />
                      </label>
                    )}
                    <label className="flex items-center gap-2 text-sm">
                      Pages
                      <Input type="number" min={1} max={2000} className="w-20" disabled={it.counting || !!it.edits} value={it.counting ? "" : it.pages}
                        onChange={(e) => { const v = Math.max(1, Number(e.target.value) || 1); setItems((p) => p.map((x, i) => (i === idx ? { ...x, pages: v } : x))); }} />
                    </label>
                    <button aria-label="Remove file" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {it.edits && it.editing && (
                    <PdfPageEditor file={it.file} pages={it.edits} onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, edits: e, pages: Math.max(1, e.filter((q) => q.keep).length) } : x)))} />
                  )}
                  </li>
                ))}
              </ul>
            )}

            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-4 font-display text-lg font-semibold">Print options</h2>
              <OptionsPanel o={o} set={(p) => setO((x) => ({ ...x, ...p }))} />
            </div>
          </div>
          <div className="lg:sticky lg:top-24 lg:self-start">
            <PriceSummary settings={settings} o={o} pages={pages} submitting={busy} progress={progress} onSubmit={submit} disabled={!items.length || items.some((i) => i.counting)} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
