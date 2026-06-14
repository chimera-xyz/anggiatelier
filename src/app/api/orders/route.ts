import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit-server";
import { enforceRateLimit, requestIp } from "@/lib/rate-limit";
import { newOrderSchema } from "@/lib/schemas";
import { mapOrder, verifyAdmin } from "@/lib/server-helpers";
import { verifyShippingQuote } from "@/lib/shipping-quote";
import { createServerSupabase } from "@/lib/supabase/server";

const orderSelect = "*, products(code,name,image_url)";

export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });
  const supabase = createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
  await supabase.rpc("expire_reservations");
  const { data, error } = await supabase.from("orders").select(orderSelect).order("created_at", { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data.map(mapOrder));
}

export async function POST(request: NextRequest) {
  const allowed = await enforceRateLimit(`order:${requestIp(request)}`, 20, 10 * 60);
  if (!allowed) return NextResponse.json({ error: "Terlalu banyak percobaan order. Tunggu sebentar lalu coba lagi." }, { status: 429 });

  const parsed = newOrderSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Data pesanan tidak valid." }, { status: 400 });
  if (parsed.data.source === "whatsapp" && !verifyAdmin(request)) {
    return NextResponse.json({ error: "Order WhatsApp hanya dapat dibuat oleh admin." }, { status: 401 });
  }

  const input = parsed.data;
  const shipping = input.shipping.token
    ? verifyShippingQuote(input.shipping.token, input.productId, input.address.postalCode)
    : null;
  if (!shipping) return NextResponse.json({ error: "Pilihan ongkir sudah kedaluwarsa atau tidak valid. Muat ulang ongkir." }, { status: 400 });

  const supabase = createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
  const { data, error } = await supabase.rpc("reserve_order", {
    p_product_id: input.productId,
    p_variant_id: input.variantId,
    p_source: input.source,
    p_quantity: input.quantity,
    p_buyer_name: input.buyerName,
    p_whatsapp: input.whatsapp,
    p_address: input.address,
    p_shipping: shipping,
    p_payment_method: input.paymentMethod,
    p_proof_name: input.proofName || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  const order = mapOrder(data as Record<string, unknown>);
  await writeAudit(supabase, "order.created", "order", order.id, { source: order.source, orderNumber: order.orderNumber });
  return NextResponse.json(order, { status: 201 });
}
