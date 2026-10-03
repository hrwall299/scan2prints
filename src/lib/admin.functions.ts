import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Signed download links for an order's files (admins only). */
export const getFileUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: files } = await supabaseAdmin.from("order_files").select("id, file_name, storage_path, page_count, size_bytes").eq("order_id", data.orderId);
    const out = [];
    for (const f of files ?? []) {
      const { data: s } = await supabaseAdmin.storage.from("print-files").createSignedUrl(f.storage_path, 3600);
      out.push({ ...f, url: s?.signedUrl ?? null });
    }
    return out;
  });
