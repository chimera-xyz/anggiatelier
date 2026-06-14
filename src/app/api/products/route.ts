import { NextRequest, NextResponse } from "next/server";
import { products as demoProducts } from "@/lib/seed";
import { requestHostedDemo, usesHostedDemo } from "@/lib/demo-overlay-server";
import { createServerSupabase } from "@/lib/supabase/server";
import { mapProduct, verifyAdmin } from "@/lib/server-helpers";
import { productSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/audit-server";

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  if (!supabase) {
    if (usesHostedDemo()) {
      try {
        const { products } = await requestHostedDemo<{ products: Record<string, unknown>[] }>("products", {
          all: verifyAdmin(request) && request.nextUrl.searchParams.get("all") === "1",
        });
        return NextResponse.json(products.map(mapProduct));
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Produk demo tidak tersedia." }, { status: 502 });
      }
    }
    return NextResponse.json(demoProducts.filter((product) => product.active));
  }
  let query = supabase.from("products").select("*, product_variants(*)").order("code");
  if (!verifyAdmin(request) || request.nextUrl.searchParams.get("all") !== "1") query = query.eq("active", true);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data.map(mapProduct));
}

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });
  const parsed = productSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Data produk tidak valid." }, { status: 400 });
  const supabase = createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
  const { data: id, error } = await supabase.rpc("save_product", { p_product_id: null, p_data: parsed.data });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  const { data, error: readError } = await supabase.from("products").select("*, product_variants(*)").eq("id", id).single();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  await writeAudit(supabase, "product.created", "product", String(id), { code: parsed.data.code });
  return NextResponse.json(mapProduct(data), { status: 201 });
}
