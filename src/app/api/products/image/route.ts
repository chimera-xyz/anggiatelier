import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/server-helpers";
import { createServerSupabase } from "@/lib/supabase/server";
import { requestHostedAdmin } from "@/lib/demo-overlay-server";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });
  const file = (await request.formData()).get("file");
  if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Foto harus JPG, PNG, atau WebP maksimal 8 MB." }, { status: 400 });
  }
  const supabase = createServerSupabase();
  const extension = file.name.split(".").pop()?.toLowerCase() || "webp";
  if (!supabase) {
    try {
      const { upload } = await requestHostedAdmin<{ upload: { signedUrl: string; publicUrl: string } }>("admin_product_upload_url", { extension });
      const form = new FormData();
      form.set("cacheControl", "3600");
      form.set("", file, file.name);
      const uploaded = await fetch(upload.signedUrl, { method: "PUT", headers: { "x-upsert": "false" }, body: form });
      if (!uploaded.ok) {
        const body = await uploaded.json().catch(() => ({})) as { message?: string; error?: string };
        throw new Error(body.message || body.error || "Foto gagal diunggah ke penyimpanan.");
      }
      return NextResponse.json({ url: upload.publicUrl });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Foto gagal diunggah." }, { status: 503 });
    }
  }
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
