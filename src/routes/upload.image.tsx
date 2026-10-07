import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { defaultOptions, OptionsPanel, placeOrder, PriceSummary, useShopSettings, type Options } from "@/components/OrderOptions";
import { IMAGE_EXTS, validateFile } from "@/lib/file-utils";
import { buildPrintPdf, chunkSlots, DEFAULT_CROP, LAYOUTS, renderSheet, thumbnailDataUrl, type Crop, type Fit, type LayoutId, type Slot } from "@/lib/photo-sheet";
import { recommendPhotoLayout } from "@/lib/photo-ai.functions";

export const Route = createFileRoute("/upload/image")({
  head: () => ({ meta: [{ title: "Photo printing — PRINTORA" }, { name: "description", content: "Arrange photos on an A4 page with a live preview and AI layout suggestions." }, { property: "og:title", content: "Photo printing — PRINTORA" }, { property: "og:description", content: "Arrange photos on an A4 page with a live preview and AI layout suggestions." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: PhotoPage,
});

type Photo = { id: string; file: File; url: string; img: HTMLImageElement; copies: number; crop: Crop };

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Could not read image")); i.src = url; });
}

function SheetCanvas({ layoutId, fit, slots }: { layoutId: LayoutId; fit: Fit; slots: Slot[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const muted = getComputedStyle(document.documentElement).getPropertyValue("--muted").trim();
    renderSheet(ref.current, layoutId, fit, slots, 3, muted ? `color-mix(in oklab, ${muted.startsWith("oklch") ? muted : `oklch(${muted})`} 100%, transparent)` : "#eee");
  }, [layoutId, fit, slots]);
  return <canvas ref={ref} aria-label="Print preview" className="mx-auto block aspect-[210/297] w-full max-w-md rounded-sm shadow-soft ring-1 ring-border" />;
}

function PhotoPage() {
  const { data: settings } = useShopSettings();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [layoutId, setLayoutId] = useState<LayoutId>("4-up");
  const [fit, setFit] = useState<Fit>("cover");
  const [selected, setSelected] = useState<string | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [o, setO] = useState<Options>({ ...defaultOptions, color_mode: "color", paper_type: "glossy" });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const layout = LAYOUTS.find((l) => l.id === layoutId)!;
  const perSheet = layout.cols * layout.rows;

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const slots = useMemo<Slot[]>(() => photos.flatMap((p) => Array.from({ length: layoutId === "passport" ? perSheet : p.copies }, () => ({ img: p.img, crop: p.crop }))), [photos, layoutId, perSheet]);
  const sheetList = useMemo(() => chunkSlots(slots, layoutId), [slots, layoutId]);
  const sheets = sheetList.length;
  const current = Math.min(sheetIdx, Math.max(0, sheets - 1));
  const sel = photos.find((p) => p.id === selected) ?? null;

  async function add(list: FileList | null) {
    if (!list) return;
    const max = settings?.max_file_mb ?? 25;
    const fresh: Photo[] = [];
    for (const f of Array.from(list)) {
      const err = validateFile(f, IMAGE_EXTS, max);
      if (err) { toast.error(err); continue; }
      const url = URL.createObjectURL(f);
      try { fresh.push({ id: crypto.randomUUID(), file: f, url, img: await loadImage(url), copies: 1, crop: { ...DEFAULT_CROP } }); }
      catch { toast.error(`${f.name}: could not read image`); URL.revokeObjectURL(url); }
    }
    setPhotos((p) => [...p, ...fresh].slice(0, 30));
    if (!selected && fresh[0]) setSelected(fresh[0].id);
  }

  const setCrop = (id: string, c: Partial<Crop>) => setPhotos((ps) => ps.map((x) => (x.id === id ? { ...x, crop: { ...x.crop, ...c } } : x)));

  async function suggest(p: Photo) {
    setAiBusy(p.id);
    setAiNote(null);
    try {
      const a = await recommendPhotoLayout({ data: { image: thumbnailDataUrl(p.img) } });
      setLayoutId(a.layout);
      setFit(a.fit);
      setCrop(p.id, { x: a.focus_x, y: a.focus_y, zoom: a.zoom });
      setSelected(p.id);
      setAiNote(`${LAYOUTS.find((l) => l.id === a.layout)!.label}, ${a.fit === "cover" ? "fill box" : "show whole"} — ${a.reason}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI suggestion failed");
    } finally {
      setAiBusy(null);
    }
  }

  async function submit() {
    if (!photos.length) { toast.error("Add at least one photo"); return; }
    if (!o.customer_name.trim()) { toast.error("Please enter your name"); return; }
    setBusy(true);
    try {
      // The print file is rendered by the same code as the preview, so they match exactly.
      const pdf = await buildPrintPdf(layoutId, fit, slots);
      const summary = `${layout.label}, ${fit === "cover" ? "fill" : "fit"}, ${sheets} sheet(s) — print file is ready-made A4 PDF`;
      const r = await placeOrder({ mode: "image", files: [{ file: pdf, pages: sheets }], o: { ...o, page_size: "A4" }, layout: summary.slice(0, 120), onProgress: setProgress });
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
        <h1 className="font-display text-3xl font-bold">Photo printing</h1>
        <p className="mt-1 text-muted-foreground">Pick a layout and crop — the preview is exactly what will be printed.</p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-[1fr_260px]">
              <div>
                <SheetCanvas layoutId={layoutId} fit={fit} slots={sheetList[current] ?? []} />
                <div className="mt-2 flex items-center justify-center gap-3 text-sm text-muted-foreground">
                  <button aria-label="Previous sheet" disabled={current <= 0} onClick={() => setSheetIdx(current - 1)} className="disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                  Sheet {photos.length ? current + 1 : 0} of {sheets} · A4
                  <button aria-label="Next sheet" disabled={current >= sheets - 1} onClick={() => setSheetIdx(current + 1)} className="disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-sm font-semibold">Layout</p>
                  <div className="grid grid-cols-2 gap-2">
                    {LAYOUTS.map((l) => (
                      <button key={l.id} onClick={() => setLayoutId(l.id)} className={`rounded-lg border px-2 py-2 text-sm ${layoutId === l.id ? "border-primary bg-primary-soft text-primary" : "border-border bg-card"}`}>{l.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold">Photo fit</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["cover", "contain"] as const).map((f) => (
                      <button key={f} onClick={() => setFit(f)} className={`rounded-lg border px-2 py-2 text-sm ${fit === f ? "border-primary bg-primary-soft text-primary" : "border-border bg-card"}`}>{f === "cover" ? "Fill box" : "Show whole"}</button>
                    ))}
                  </div>
                </div>
                {sel && (
                  <div className="space-y-2 rounded-lg border border-border bg-card p-3 text-sm">
                    <p className="font-semibold">Crop: <span className="font-normal text-muted-foreground">{sel.file.name}</span></p>
                    {([["x", "Left ↔ right", 0, 1], ["y", "Top ↕ bottom", 0, 1], ["zoom", "Zoom", 1, 2.5]] as const).map(([k, label, min, max]) => (
                      <label key={k} className="block">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <input type="range" min={min} max={max} step={0.01} value={sel.crop[k]} disabled={k === "zoom" && fit === "contain"} onChange={(e) => setCrop(sel.id, { [k]: Number(e.target.value) })} className="w-full accent-primary" />
                      </label>
                    ))}
                    <button onClick={() => setCrop(sel.id, DEFAULT_CROP)} className="text-xs text-primary underline">Reset crop</button>
                  </div>
                )}
                <button onClick={() => input.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card py-4 font-semibold hover:border-primary">
                  <ImagePlus className="h-5 w-5 text-primary" /> Add photos
                </button>
                <input ref={input} type="file" multiple hidden accept=".jpg,.jpeg,.png" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
              </div>
            </div>

            {aiNote && <p className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary-soft p-3 text-sm"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> AI suggestion applied: {aiNote}</p>}

            {photos.length > 0 && (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {photos.map((p, idx) => (
                  <li key={p.id} className={`rounded-xl border bg-card p-2 ${selected === p.id ? "border-primary ring-2 ring-primary/30" : "border-border"}`}>
                    <button className="block w-full" onClick={() => setSelected(p.id)} aria-label={`Edit crop for ${p.file.name}`}>
                      <img src={p.url} alt={p.file.name} className="aspect-square w-full rounded-md object-cover" />
                    </button>
                    <button onClick={() => suggest(p)} disabled={!!aiBusy} className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-border py-1 text-xs font-semibold text-primary hover:border-primary disabled:opacity-50">
                      {aiBusy === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} {aiBusy === p.id ? "Thinking…" : "AI suggest"}
                    </button>
                    <div className="mt-2 flex items-center justify-between gap-1 text-xs">
                      {layoutId !== "passport" ? (
                        <label className="flex items-center gap-1">×
                          <input type="number" min={1} max={50} value={p.copies} className="w-12 rounded border border-input bg-background px-1"
                            onChange={(e) => { const v = Math.max(1, Math.min(50, Number(e.target.value) || 1)); setPhotos((ps) => ps.map((x, i) => (i === idx ? { ...x, copies: v } : x))); }} />
                        </label>
                      ) : <span className="text-muted-foreground">fills sheet</span>}
                      <button aria-label="Remove photo" onClick={() => { URL.revokeObjectURL(p.url); setPhotos((ps) => ps.filter((_, i) => i !== idx)); if (selected === p.id) setSelected(null); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-4 font-display text-lg font-semibold">Print options</h2>
              <OptionsPanel o={o} set={(p) => setO((x) => ({ ...x, ...p }))} hideSize />
            </div>
          </div>
          <div className="lg:sticky lg:top-24 lg:self-start">
            <PriceSummary settings={settings} o={{ ...o, page_size: "A4" }} pages={photos.length ? sheets : 0} submitting={busy} progress={progress} onSubmit={submit} disabled={!photos.length} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
