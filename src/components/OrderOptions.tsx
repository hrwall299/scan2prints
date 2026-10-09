import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { calcPrice, money, PAGE_SIZES, PAPER_TYPES, SIDES, type PricingSettings } from "@/lib/pricing";
import { prepareUpload, submitOrder } from "@/lib/orders.functions";
import { mimeFor, uploadWithProgress } from "@/lib/file-utils";

export type Options = {
  color_mode: "bw" | "color";
  copies: number;
  page_size: "A4" | "A3" | "Letter" | "Legal";
  paper_type: "standard" | "premium" | "glossy";
  sides: "single" | "double";
  customer_name: string;
  customer_phone: string;
  notes: string;
};

export const defaultOptions: Options = {
  color_mode: "bw",
  copies: 1,
  page_size: "A4",
  paper_type: "standard",
  sides: "single",
  customer_name: "",
  customer_phone: "",
  notes: "",
};

export function useShopSettings() {
  return useQuery({
    queryKey: ["shop-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shop_settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });
}

function Chips<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <button
          type="button"
          key={i.value}
          onClick={() => onChange(i.value)}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${value === i.value ? "border-primary bg-primary-soft text-primary" : "border-border bg-card hover:border-primary/50"}`}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

export function OptionsPanel({ o, set, hideSize }: { o: Options; set: (p: Partial<Options>) => void; hideSize?: boolean }) {
  return (
    <div className="space-y-5">
      <div>
        <Label className="mb-2 block">Colour</Label>
        <Chips value={o.color_mode} onChange={(v) => set({ color_mode: v })} items={[{ value: "bw", label: "Black & white" }, { value: "color", label: "Colour" }]} />
      </div>
      {!hideSize && (
        <div>
          <Label className="mb-2 block">Page size</Label>
          <Chips value={o.page_size} onChange={(v) => set({ page_size: v })} items={PAGE_SIZES.map((p) => ({ value: p, label: p }))} />
        </div>
      )}
      <div>
        <Label className="mb-2 block">Paper</Label>
        <Chips value={o.paper_type} onChange={(v) => set({ paper_type: v })} items={PAPER_TYPES.map((p) => ({ value: p.value, label: p.label }))} />
      </div>
      <div>
        <Label className="mb-2 block">Sides</Label>
        <Chips value={o.sides} onChange={(v) => set({ sides: v })} items={SIDES.map((p) => ({ value: p.value, label: p.label }))} />
      </div>
      <div className="max-w-[10rem]">
        <Label htmlFor="copies" className="mb-2 block">Copies</Label>
        <Input id="copies" type="number" min={1} max={500} value={o.copies} onChange={(e) => set({ copies: Math.max(1, Math.min(500, Number(e.target.value) || 1)) })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name" className="mb-2 block">Your name *</Label>
          <Input id="name" maxLength={80} value={o.customer_name} onChange={(e) => set({ customer_name: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="phone" className="mb-2 block">Phone (optional)</Label>
          <Input id="phone" maxLength={20} value={o.customer_phone} onChange={(e) => set({ customer_phone: e.target.value })} />
        </div>
      </div>
      <div>
        <Label htmlFor="notes" className="mb-2 block">Notes for the shop</Label>
        <Textarea id="notes" maxLength={500} value={o.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="e.g. staple pages, print pages 2–5 only" />
      </div>
    </div>
  );
}

export function PriceSummary({ settings, o, pages, submitting, progress, onSubmit, disabled, colorPages }: { settings?: PricingSettings | undefined; o: Options; pages: number; colorPages?: number | undefined; submitting: boolean; progress: number; onSubmit: () => void; disabled?: boolean }) {
  const total = settings ? calcPrice(settings, { ...o, pages, color_pages: colorPages }) : 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <h3 className="font-display text-lg font-semibold">Order summary</h3>
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">Pages</dt><dd>{pages}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Copies</dt><dd>{o.copies}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Colour</dt><dd>{colorPages === undefined ? (o.color_mode === "bw" ? "B&W" : "Colour") : `${colorPages} colour · ${pages - colorPages} B&W`}</dd></div>
      </dl>
      <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
        <span className="text-sm text-muted-foreground">Estimated price</span>
        <span className="font-display text-2xl font-bold text-primary">{settings ? money(settings, total) : "…"}</span>
      </div>
      {submitting && <Progress value={progress} className="mt-4" />}
      <Button variant="accent" className="mt-4 w-full" size="lg" disabled={disabled || submitting} onClick={onSubmit}>
        {submitting ? `Sending… ${progress}%` : "Send to shop"}
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">You pay at the counter when you collect.</p>
    </div>
  );
}

/** Uploads files and creates the order. Returns tracking info. */
export async function placeOrder(args: { mode: "document" | "image"; files: { file: File; pages: number; colorList?: number[] | undefined }[]; o: Options; layout: string; onProgress: (p: number) => void }) {
  const { batch, uploads } = await prepareUpload({ data: { files: args.files.map((f) => ({ name: f.file.name, size: f.file.size })) } });
  const done = new Array(uploads.length).fill(0);
  await Promise.all(
    uploads.map((u, i) =>
      uploadWithProgress(u.signedUrl, args.files[i]!.file, (p) => {
        done[i] = p;
        args.onProgress(Math.round(done.reduce((a, b) => a + b, 0) / uploads.length));
      }),
    ),
  );
  return submitOrder({
    data: {
      batch,
      mode: args.mode,
      customer_name: args.o.customer_name,
      customer_phone: args.o.customer_phone,
      notes: args.o.notes,
      color_mode: args.o.color_mode,
      copies: args.o.copies,
      page_size: args.o.page_size,
      paper_type: args.o.paper_type,
      sides: args.o.sides,
      layout: args.layout,
      files: args.files.map((f, i) => ({ path: uploads[i]!.path, name: f.file.name, mime: mimeFor(f.file.name), size: f.file.size, pages: f.pages, color_list: f.colorList })),
    },
  });
}
