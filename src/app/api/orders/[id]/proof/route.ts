import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit-server";
import { mapOrder, verifyAdmin } from "@/lib/server-helpers";
import { createServerSupabase } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export async function GET(request: NextRequest, context: Context) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });
  const { id } = await context.params;
  const supabase = createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
  const { data: order } = await supabase.from("orders").select("proof_path").eq("id", id).single();
  if (!order?.proof_path) return NextResponse.json({ error: "Bukti pembayaran belum tersedia." }, { status: 404 });
  const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(order.proof_path, 10 * 60);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl });
}

export async function POST(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const form = await request.formData();
  const file = form.get("file");
  const accessToken = String(form.get("accessToken") || "");
  if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Bukti harus JPG, PNG, WebP, atau PDF maksimal 5 MB." }, { status: 400 });
  }

  const supabase = createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
  const { data: order } = await supabase.from("orders").select("public_token,status,reserved_until,proof_path").eq("id", id).single();
  if (!order || order.public_token !== accessToken) return NextResponse.json({ error: "Tautan pesanan tidak valid." }, { status: 401 });
  if (!["awaiting_payment", "pending_confirmation"].includes(order.status) || new Date(order.reserved_until).getTime() <= Date.now()) {
    return NextResponse.json({ error: "Reservasi pesanan sudah tidak aktif." }, { status: 409 });
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
  if (order.proof_path) await supabase.storage.from("payment-proofs").remove([order.proof_path]);

  const { data, error } = await supabase.from("orders").update({ proof_name: file.name, proof_path: path, status: "pending_confirmation" }).eq("id", id).select("*, products(code,name,image_url)").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await writeAudit(supabase, "payment.proof_uploaded", "order", id, { fileName: file.name });
  return NextResponse.json(mapOrder(data));
}
