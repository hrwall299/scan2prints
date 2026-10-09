import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, RotateCw } from "lucide-react";

/** color: undefined = follow the order's main colour choice. */
export type PageEdit = { src: number; rotate: number; keep: boolean; color?: "bw" | "color" | undefined };

export function initialPages(n: number): PageEdit[] {
  return Array.from({ length: n }, (_, i) => ({ src: i, rotate: 0, keep: true }));
}

/** Sheet numbers (1-based, in final order) printed in colour. */
export function colourSheets(pages: PageEdit[], fallback: "bw" | "color"): number[] {
  return pages.filter((p) => p.keep).flatMap((p, i) => ((p.color ?? fallback) === "color" ? [i + 1] : []));
}

/** Builds the final PDF reflecting the page edits (order, rotation, removed pages). */
export async function applyPageEdits(file: File, pages: PageEdit[]): Promise<File> {
  const { PDFDocument, degrees } = await import("pdf-lib");
  const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const kept = pages.filter((p) => p.keep);
  const copied = await out.copyPages(src, kept.map((p) => p.src));
  copied.forEach((pg, i) => {
    const r = kept[i]!.rotate;
    if (r) pg.setRotation(degrees((pg.getRotation().angle + r) % 360));
    out.addPage(pg);
  });
  const bytes = await out.save();
  return new File([bytes as BlobPart], file.name, { type: "application/pdf" });
}

async function renderThumbs(file: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const urls: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, 200); i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const scale = 160 / vp.width;
    const v = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = v.width;
    canvas.height = v.height;
    await page.render({ canvasContext: canvas.getContext("2d")!, viewport: v }).promise;
    urls.push(canvas.toDataURL("image/jpeg", 0.7));
  }
  return urls;
}

export function PdfPageEditor({ file, pages, onChange, fallback = "bw" }: { file: File; pages: PageEdit[]; onChange: (p: PageEdit[]) => void; fallback?: "bw" | "color" }) {
  const [thumbs, setThumbs] = useState<string[] | null>(null);
  useEffect(() => {
    let live = true;
    renderThumbs(file).then((t) => live && setThumbs(t)).catch(() => live && setThumbs([]));
    return () => { live = false; };
  }, [file]);

  const upd = (i: number, p: Partial<PageEdit>) => onChange(pages.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= pages.length) return;
    const n = [...pages];
    [n[i], n[j]] = [n[j]!, n[i]!];
    onChange(n);
  };
  const kept = pages.filter((p) => p.keep).length;

  return (
    <div className="border-t border-border bg-paper p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium">{kept} of {pages.length} pages will print</span>
        <div className="flex gap-2">
          <button type="button" className="rounded-md border border-border bg-card px-2 py-1 hover:border-primary" onClick={() => onChange(pages.map((p) => ({ ...p, keep: true })))}>Keep all</button>
          <button type="button" className="rounded-md border border-border bg-card px-2 py-1 hover:border-primary" onClick={() => onChange(initialPages(pages.length))}>Reset</button>
        </div>
      </div>
      {thumbs === null ? (
        <p className="text-sm text-muted-foreground">Loading pages…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {pages.map((p, i) => (
            <div key={p.src} className={`rounded-xl border bg-card p-2 ${p.keep ? "border-border" : "border-destructive/50 opacity-50"}`}>
              <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md bg-muted">
                {thumbs[p.src] ? (
                  <img src={thumbs[p.src]} alt={`Page ${p.src + 1}`} className="max-h-full max-w-full transition-transform" style={{ transform: `rotate(${p.rotate}deg)` }} />
                ) : (
                  <span className="text-xs text-muted-foreground">Page {p.src + 1}</span>
                )}
              </div>
              <p className="mt-1 text-center text-xs text-muted-foreground">Sheet {i + 1} · original p.{p.src + 1}</p>
              <div className="mt-1 grid grid-cols-2 gap-1 text-xs">
                {(["bw", "color"] as const).map((c) => {
                  const on = (p.color ?? fallback) === c;
                  return (
                    <button key={c} type="button" disabled={!p.keep} onClick={() => upd(i, { color: c })}
                      className={`rounded-md border px-1 py-0.5 font-medium ${on ? "border-primary bg-primary-soft text-primary" : "border-border hover:border-primary/50"}`}>
                      {c === "bw" ? "B&W" : "Colour"}
                    </button>
                  );
                })}
              </div>
              <div className="mt-1 flex justify-between">
                <button type="button" aria-label="Move left" onClick={() => move(i, -1)} className="p-1 hover:text-primary"><ArrowLeft className="h-4 w-4" /></button>
                <button type="button" aria-label="Rotate" onClick={() => upd(i, { rotate: (p.rotate + 90) % 360 })} className="p-1 hover:text-primary"><RotateCw className="h-4 w-4" /></button>
                <button type="button" aria-label={p.keep ? "Skip page" : "Include page"} onClick={() => upd(i, { keep: !p.keep })} className="p-1 hover:text-primary">{p.keep ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
                <button type="button" aria-label="Move right" onClick={() => move(i, 1)} className="p-1 hover:text-primary"><ArrowRight className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
