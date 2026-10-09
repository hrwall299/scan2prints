import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { calcPrice } from "./pricing";

const BUCKET = "print-files";
const ALLOWED = ["pdf", "doc", "docx", "jpg", "jpeg", "png"];

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80) || "file";
}

/** Removes files of finished orders past the cleanup window and abandoned uploads. */
async function runCleanupInternal() {
  const db = await admin();
  const { data: settings } = await db.from("shop_settings").select("cleanup_hours").eq("id", 1).single();
  const hours = settings?.cleanup_hours ?? 24;
  const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();

  const { data: due } = await db
    .from("orders")
    .select("id, order_files(storage_path)")
    .is("files_deleted_at", null)
    .or(`and(status.eq.completed,completed_at.lte.${cutoff}),and(status.eq.rejected,rejected_at.lte.${cutoff})`)
    .limit(200);

  let ordersCleaned = 0;
  for (const o of due ?? []) {
    const paths = (o.order_files ?? []).map((f: { storage_path: string }) => f.storage_path);
    if (paths.length) await db.storage.from(BUCKET).remove(paths);
    await db.from("order_files").delete().eq("order_id", o.id);
    await db.from("orders").update({ files_deleted_at: new Date().toISOString() }).eq("id", o.id);
    ordersCleaned++;
  }

  // Abandoned temporary uploads (never submitted) older than 6 hours.
  let tempRemoved = 0;
  const { data: batches } = await db.storage.from(BUCKET).list("incoming", { limit: 500 });
  for (const b of batches ?? []) {
    const ts = Number(b.name.split("-")[0]);
    if (!ts || Date.now() - ts < 6 * 3600_000) continue;
    const { data: files } = await db.storage.from(BUCKET).list(`incoming/${b.name}`, { limit: 200 });
    const paths = (files ?? []).map((f) => `incoming/${b.name}/${f.name}`);
    if (paths.length) {
      await db.storage.from(BUCKET).remove(paths);
      tempRemoved += paths.length;
    }
  }
  return { ordersCleaned, tempRemoved };
}

export const runCleanup = createServerFn({ method: "POST" }).handler(async () => runCleanupInternal());

export const prepareUpload = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        files: z
          .array(z.object({ name: z.string().min(1).max(200), size: z.number().int().positive() }))
          .min(1)
          .max(30),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: s } = await db.from("shop_settings").select("max_file_mb").eq("id", 1).single();
    const maxBytes = (s?.max_file_mb ?? 25) * 1024 * 1024;
    const batch = `${Date.now()}-${crypto.randomUUID()}`;
    const uploads = [];
    for (const [i, f] of data.files.entries()) {
      const e = (f.name.split(".").pop() || "").toLowerCase();
      if (!ALLOWED.includes(e)) throw new Error(`${f.name}: unsupported file type`);
      if (f.size > maxBytes) throw new Error(`${f.name}: file too large`);
      const path = `incoming/${batch}/${i}-${safeName(f.name)}`;
      const { data: signed, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error || !signed) throw new Error("Could not prepare upload");
      uploads.push({ path, signedUrl: signed.signedUrl });
    }
    return { batch, uploads };
  });

const submitSchema = z.object({
  batch: z.string().regex(/^\d+-[0-9a-f-]{36}$/),
  mode: z.enum(["document", "image"]),
  customer_name: z.string().trim().min(1, "Name is required").max(80),
  customer_phone: z.string().trim().max(20).regex(/^[0-9+\-\s()]*$/, "Invalid phone"),
  notes: z.string().trim().max(500),
  color_mode: z.enum(["bw", "color"]),
  copies: z.number().int().min(1).max(500),
  page_size: z.enum(["A4", "A3", "Letter", "Legal"]),
  paper_type: z.enum(["standard", "premium", "glossy"]),
  sides: z.enum(["single", "double"]),
  layout: z.string().max(120),
  files: z
    .array(
      z.object({
        path: z.string().max(300),
        name: z.string().min(1).max(200),
        mime: z.string().max(120),
        size: z.number().int().positive(),
        pages: z.number().int().min(1).max(2000),
        color_list: z.array(z.number().int().min(1).max(2000)).max(2000).optional(),
      }),
    )
    .min(1)
    .max(30),
});

export const submitOrder = createServerFn({ method: "POST" })
  .inputValidator((d) => submitSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const prefix = `incoming/${data.batch}/`;
    const { data: listed } = await db.storage.from(BUCKET).list(`incoming/${data.batch}`, { limit: 200 });
    const present = new Set((listed ?? []).map((f) => prefix + f.name));
    for (const f of data.files) {
      if (!f.path.startsWith(prefix) || !present.has(f.path)) throw new Error(`File missing: ${f.name}`);
    }

    const { data: settings, error: sErr } = await db.from("shop_settings").select("*").eq("id", 1).single();
    if (sErr || !settings) throw new Error("Shop settings unavailable");

    const pages = data.files.reduce((a, f) => a + f.pages, 0);
    const colourOf = (f: (typeof data.files)[number]) =>
      f.color_list ? [...new Set(f.color_list.filter((n) => n <= f.pages))].sort((a, b) => a - b) : data.color_mode === "color" ? null : [];
    const colorPages = data.mode === "document" ? data.files.reduce((a, f) => a + (colourOf(f)?.length ?? f.pages), 0) : undefined;
    const price = calcPrice(settings, { pages, color_pages: colorPages, copies: data.copies, color_mode: data.color_mode, page_size: data.page_size, paper_type: data.paper_type, sides: data.sides });
    const token = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");

    const { data: order, error } = await db
      .from("orders")
      .insert({
        tracking_token: token,
        mode: data.mode,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        notes: data.notes,
        color_mode: data.color_mode,
        copies: data.copies,
        page_size: data.page_size,
        paper_type: data.paper_type,
        sides: data.sides,
        layout: data.layout || "standard",
        page_count: pages,
        estimated_price: price,
        color_pages: colorPages ?? (data.color_mode === "color" ? pages : 0),
      })
      .select("id, order_number")
      .single();
    if (error || !order) throw new Error("Could not create order");

    const rows = [];
    for (const f of data.files) {
      const dest = `orders/${order.id}/${f.path.slice(prefix.length)}`;
      const { error: mvErr } = await db.storage.from(BUCKET).move(f.path, dest);
      const cl = colourOf(f);
      const list = cl === null ? (f.pages === 1 ? "1" : `1-${f.pages}`) : cl.join(", ");
      rows.push({ color_pages: cl === null ? f.pages : cl.length, color_page_list: list, order_id: order.id, file_name: f.name, storage_path: mvErr ? f.path : dest, mime_type: f.mime, size_bytes: f.size, page_count: f.pages });
    }
    await db.from("order_files").insert(rows);
    runCleanupInternal().catch(() => {});
    return { orderNumber: order.order_number, token };
  });

export const trackOrder = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ orderNumber: z.number().int().positive(), token: z.string().regex(/^[0-9a-f]{32}$/) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: o } = await db
      .from("orders")
      .select("order_number, tracking_token, mode, customer_name, color_mode, copies, page_size, paper_type, sides, layout, page_count, estimated_price, status, reject_reason, created_at, updated_at, approved_at, completed_at, rejected_at, color_pages, order_files(file_name, page_count, size_bytes, color_page_list), order_events(status, note, created_at)")
      .eq("order_number", data.orderNumber)
      .maybeSingle();
    if (!o || o.tracking_token !== data.token) return null;
    const { data: s } = await db.from("shop_settings").select("currency, shop_name").eq("id", 1).single();
    const { tracking_token: _t, ...rest } = o;
    return { ...rest, currency: s?.currency ?? "₹", shop_name: s?.shop_name ?? "PRINTORA" };
  });
