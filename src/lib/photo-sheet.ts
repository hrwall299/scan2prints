// Single source of truth for photo sheet geometry + rendering.
// The on-screen preview and the uploaded print PDF are both produced by renderSheet(),
// so what the customer sees is exactly what the shop prints.
import { PDFDocument } from "pdf-lib";

export const LAYOUTS = [
  { id: "1-up", label: "1 per page", cols: 1, rows: 1 },
  { id: "2-up", label: "2 per page", cols: 1, rows: 2 },
  { id: "4-up", label: "4 per page", cols: 2, rows: 2 },
  { id: "6-up", label: "6 per page", cols: 2, rows: 3 },
  { id: "passport", label: "Passport (12)", cols: 3, rows: 4 },
] as const;
export type LayoutId = (typeof LAYOUTS)[number]["id"];
export type Fit = "cover" | "contain";
export type Crop = { x: number; y: number; zoom: number }; // x,y focus 0..1, zoom 1..3
export const DEFAULT_CROP: Crop = { x: 0.5, y: 0.5, zoom: 1 };
export type Slot = { img: CanvasImageSource & { width: number; height: number }; crop: Crop };

const PAGE_W = 210, PAGE_H = 297, MARGIN = 8.4, GAP = 4.2; // mm, A4

export function cellRects(layoutId: LayoutId) {
  const l = LAYOUTS.find((x) => x.id === layoutId)!;
  const cw = (PAGE_W - 2 * MARGIN - (l.cols - 1) * GAP) / l.cols;
  const ch = (PAGE_H - 2 * MARGIN - (l.rows - 1) * GAP) / l.rows;
  const out: { x: number; y: number; w: number; h: number }[] = [];
  for (let r = 0; r < l.rows; r++) for (let c = 0; c < l.cols; c++) out.push({ x: MARGIN + c * (cw + GAP), y: MARGIN + r * (ch + GAP), w: cw, h: ch });
  return out;
}

/** Draws one A4 sheet onto a canvas `pxPerMm` resolution. */
export function renderSheet(canvas: HTMLCanvasElement, layoutId: LayoutId, fit: Fit, slots: (Slot | undefined)[], pxPerMm: number, emptyColor?: string) {
  canvas.width = Math.round(PAGE_W * pxPerMm);
  canvas.height = Math.round(PAGE_H * pxPerMm);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; // paper
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  cellRects(layoutId).forEach((r, i) => {
    const x = r.x * pxPerMm, y = r.y * pxPerMm, w = r.w * pxPerMm, h = r.h * pxPerMm;
    const s = slots[i];
    if (!s) {
      if (emptyColor) { ctx.fillStyle = emptyColor; ctx.fillRect(x, y, w, h); }
      return;
    }
    const iw = s.img.width, ih = s.img.height;
    const base = fit === "cover" ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
    const scale = base * (fit === "cover" ? s.crop.zoom : 1);
    const dw = iw * scale, dh = ih * scale;
    const dx = x + (w - dw) * s.crop.x, dy = y + (h - dh) * s.crop.y;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(s.img, dx, dy, dw, dh);
    ctx.restore();
  });
}

export function chunkSlots(slots: Slot[], layoutId: LayoutId) {
  const per = cellRects(layoutId).length;
  const sheets: Slot[][] = [];
  for (let i = 0; i < slots.length; i += per) sheets.push(slots.slice(i, i + per));
  return sheets;
}

/** Builds the exact print file: one A4 PDF page per sheet, 300 DPI. */
export async function buildPrintPdf(layoutId: LayoutId, fit: Fit, slots: Slot[]) {
  const pdf = await PDFDocument.create();
  const canvas = document.createElement("canvas");
  for (const sheet of chunkSlots(slots, layoutId)) {
    renderSheet(canvas, layoutId, fit, sheet, 300 / 25.4);
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Render failed"))), "image/jpeg", 0.92));
    const jpg = await pdf.embedJpg(await blob.arrayBuffer());
    const page = pdf.addPage([595.28, 841.89]);
    page.drawImage(jpg, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }
  const bytes = await pdf.save();
  return new File([bytes as BlobPart], `photo-sheets-${layoutId}.pdf`, { type: "application/pdf" });
}

/** Small JPEG data URL for AI analysis. */
export function thumbnailDataUrl(img: HTMLImageElement, max = 768) {
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * s);
  c.height = Math.round(img.height * s);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8);
}
