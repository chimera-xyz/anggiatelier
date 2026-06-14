import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { mapProduct, verifyAdmin } from "@/lib/server-helpers";
import { publishOverlayEvent } from "@/lib/overlay-server";
import { writeAudit } from "@/lib/audit-server";

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });
  const { productId } = await request.json();
  const supabase = createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });

  const { data, error } = await supabase.rpc("set_live_product", { p_product_id: productId });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await publishOverlayEvent(supabase, {
    type: "product",
    productCode: data.code,
    productName: data.name,
    productPrice: data.price,
    message: "Order via link bio atau WhatsApp",
    duration: 10,
    sound: false,
  });
  await writeAudit(supabase, "product.live", "product", productId, { code: data.code });
  return NextResponse.json(mapProduct(data));
}
