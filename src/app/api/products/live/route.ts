import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { publishDemoOverlayEvent, requestHostedDemo, usesHostedDemo } from "@/lib/demo-overlay-server";
import { mapProduct, verifyAdmin } from "@/lib/server-helpers";
import { publishOverlayEvent } from "@/lib/overlay-server";
import { writeAudit } from "@/lib/audit-server";
import { overlayOrderCta } from "@/lib/overlay-copy";

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });
  const { productId } = await request.json();
  const supabase = createServerSupabase();
  if (!supabase) {
    if (!usesHostedDemo()) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
    try {
      const { product } = await requestHostedDemo<{ product: Record<string, unknown> }>("set_live_product", { productId });
      const mapped = mapProduct(product);
      await publishDemoOverlayEvent({
        type: "product",
        productCode: mapped.code,
        productName: mapped.name,
        productPrice: mapped.price,
        message: overlayOrderCta,
        duration: 10,
        sound: false,
      });
      return NextResponse.json(mapped);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Produk LIVE gagal diperbarui." }, { status: 502 });
    }
  }

  const { data, error } = await supabase.rpc("set_live_product", { p_product_id: productId });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await publishOverlayEvent(supabase, {
    type: "product",
    productCode: data.code,
    productName: data.name,
    productPrice: data.price,
    message: overlayOrderCta,
    duration: 10,
    sound: false,
  });
  await writeAudit(supabase, "product.live", "product", productId, { code: data.code });
  return NextResponse.json(mapProduct(data));
}
