import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { defaultOptions, OptionsPanel, placeOrder, PriceSummary, useShopSettings, type Options } from "@/components/OrderOptions";
import { IMAGE_EXTS, validateFile } from "@/lib/file-utils";

export const Route = createFileRoute("/upload/image")({
  head: () => ({ meta: [{ title: "Photo printing — PRINTORA" }, { name: "description", content: "Arrange photos on an A4 page with a live preview." }, { property: "og:title", content: "Photo printing — PRINTORA" }, { property: "og:description", content: "Arrange photos on an A4 page with a live preview." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: PhotoPage,
});

const LAYOUTS = [
  { id: "1-up", label: "1 per page", cols: 1, rows: 1 },
  { id: "2-up", label: "2 per page", cols: 1, rows: 2 },
  { id: "4-up", label: "4 per page", cols: 2, rows: 2 },
  { id: "6-up", label: "6 per page", cols: 2, rows: 3 },
  { id: "passport", label: "Passport (12)", cols: 3, rows: 4 },
] as const;

type Photo = { file: File; url: string; copies: number };

function PhotoPage() {
  const { data: settings } = useShopSettings();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [layoutId, setLayoutId] = useState<(typeof LAYOUTS)[number]["id"]>("4-up");
  const [fit, setFit] = useState<"cover" | "contain">("cover");
  const [o, setO] = useState<Options>({ ...defaultOptions, color_mode: "color", paper_type: "glossy" });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const layout = LAYOUTS.find((l) => l.id === layoutId)!;
  const perSheet = layout.cols * layout.rows;

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const slots = useMemo(() => photos.flatMap((p) => Array.from({ length: layoutId === "passport" ? perSheet : p.copies }, () => p.url)), [photos, layoutId, perSheet]);
  const sheets = Math.max(1, Math.ceil(slots.length / perSheet));
  const pages = photos.length ? sheets : 0;

  function add(list: FileList | null) {
    if (!list) return;
    const max = settings?.max_file_mb ?? 25;
    const fresh: Photo[] = [];
    for (const f of Array.from(list)) {
      const err = validateFile(f, IMAGE_EXTS, max);
      if (err) toast.error(err);
      else fresh.push({ file: f, url: URL.createObjectURL(f), copies: 1 });
    }
    setPhotos((p) => [...p, ...fresh].slice(0, 30));
  }

  async function submit() {
    if (!photos.length) { toast.error("Add at least one photo"); return; }
    if (!o.customer_name.trim()) { toast.error("Please enter your name"); return; }
    setBusy(true);
    try {
      // Spread sheet count across files so the total matches the preview.
      const files = photos.map((p, i) => ({ file: p.file, pages: i === 0 ? sheets - photos.length + 1 > 0 ? sheets - photos.length + 1 : 1 : 1 }));
      const summary = `${layout.label}, ${fit === "cover" ? "fill" : "fit"}, ${sheets} sheet(s), copies: ${photos.map((p) => p.copies).join("/")}`;
      const r = await placeOrder({ mode: "image", files, o: { ...o, page_size: "A4" }, layout: summary, onProgress: setProgress });
      navigate({ to: "/track", search: { n: r.orderNumber, t: r.token } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send order");
      setBusy(false);
    }
  }

  const priced = Math.max(pages, photos.length ? Math.max(sheets, photos.length) : 0);

  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="font-display text-3xl font-bold">Photo printing</h1>
        <p className="mt-1 text-muted-foreground">Pick a layout and see exactly how your A4 sheet will look.</p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-[1fr_260px]">
              <div>
                <div className="mx-auto aspect-[210/297] w-full max-w-md rounded-sm bg-card p-[4%] shadow-soft ring-1 ring-border">
                  <div className="grid h-full w-full gap-[2%]" style={{ gridTemplateColumns: `repeat(${layout.cols}, 1fr)`, gridTemplateRows: `repeat(${layout.rows}, 1fr)` }}>
                    {Array.from({ length: perSheet }).map((_, i) => (
                      <div key={i} className="overflow-hidden rounded-sm bg-muted">
                        {slots[i] && <img src={slots[i]} alt="" className="h-full w-full" style={{ objectFit: fit }} />}
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-center text-sm text-muted-foreground">Sheet 1 of {photos.length ? sheets : 0} · A4</p>
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
                <button onClick={() => input.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card py-4 font-semibold hover:border-primary">
                  <ImagePlus className="h-5 w-5 text-primary" /> Add photos
                </button>
                <input ref={input} type="file" multiple hidden accept=".jpg,.jpeg,.png" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
              </div>
            </div>

            {photos.length > 0 && (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {photos.map((p, idx) => (
                  <li key={p.url} className="rounded-xl border border-border bg-card p-2">
                    <img src={p.url} alt={p.file.name} className="aspect-square w-full rounded-md object-cover" />
                    <div className="mt-2 flex items-center justify-between gap-1 text-xs">
                      {layoutId !== "passport" ? (
                        <label className="flex items-center gap-1">×
                          <input type="number" min={1} max={50} value={p.copies} className="w-12 rounded border border-input bg-background px-1"
                            onChange={(e) => { const v = Math.max(1, Math.min(50, Number(e.target.value) || 1)); setPhotos((ps) => ps.map((x, i) => (i === idx ? { ...x, copies: v } : x))); }} />
                        </label>
                      ) : <span className="text-muted-foreground">fills sheet</span>}
                      <button aria-label="Remove photo" onClick={() => { URL.revokeObjectURL(p.url); setPhotos((ps) => ps.filter((_, i) => i !== idx)); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
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
            <PriceSummary settings={settings} o={{ ...o, page_size: "A4" }} pages={priced} submitting={busy} progress={progress} onSubmit={submit} disabled={!photos.length} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
