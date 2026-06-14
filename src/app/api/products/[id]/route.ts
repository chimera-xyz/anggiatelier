import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { mapProduct, verifyAdmin } from "@/lib/server-helpers";
import { productSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/audit-server";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Context) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });
  const { id } = await context.params;
  const parsed = productSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Data produk tidak valid." }, { status: 400 });
  const supabase = createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
  const { error } = await supabase.rpc("save_product", { p_product_id: id, p_data: parsed.data });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  const { data, error: readError } = await supabase.from("products").select("*, product_variants(*)").eq("id", id).single();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  await writeAudit(supabase, "product.updated", "product", id, { code: parsed.data.code });
  return NextResponse.json(mapProduct(data));
}

export async function DELETE(request: NextRequest, context: Context) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });
  const { id } = await context.params;
  const supabase = createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
  const { data: variants } = await supabase.from("product_variants").select("reserved_quantity").eq("product_id", id);
  if ((variants || []).some((variant) => Number(variant.reserved_quantity) > 0)) return NextResponse.json({ error: "Produk masih memiliki reservasi aktif." }, { status: 409 });
  const { error } = await supabase.from("products").update({ active: false, is_live: false, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await writeAudit(supabase, "product.archived", "product", id);
  return NextResponse.json({ ok: true });
}
