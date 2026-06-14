import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit-server";
import { paymentDetailsFromConfig } from "@/lib/payments";
import { requestHostedAdmin, requestHostedDemo, usesHostedDemo } from "@/lib/demo-overlay-server";
import { resolvePaymentMethodServer } from "@/lib/payment-server";
import { enforceRateLimit, requestIp } from "@/lib/rate-limit";
import { newOrderSchema } from "@/lib/schemas";
import { mapOrder, verifyAdmin } from "@/lib/server-helpers";
import { verifyShippingQuote } from "@/lib/shipping-quote";
import { createServerSupabase } from "@/lib/supabase/server";
import type { PaymentMethodConfig } from "@/lib/types";

const orderSelect = "*, products(code,name,image_url)";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function orderFailure(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("stok") || normalized.includes("stock")) {
    return { status: 409, message: "Stok varian baru saja habis atau sedang direservasi pembeli lain. Pilih varian lain lalu coba lagi." };
  }
  if (normalized.includes("varian") || normalized.includes("produk tidak ditemukan")) {
    return { status: 409, message: "Data produk atau varian sudah berubah. Muat ulang halaman lalu pilih kembali produknya." };
  }
  if (normalized.includes("duplicate") && normalized.includes("order_number")) {
    return { status: 503, message: "Nomor pesanan sedang sibuk dibuat. Silakan tekan Buat Pesanan sekali lagi." };
  }
  if (normalized.includes("schema cache") || normalized.includes("does not exist") || normalized.includes("could not find")) {
    return { status: 503, message: "Sistem pesanan sedang disinkronkan. Coba lagi sebentar lagi." };
  }
  return { status: 500, message: "Pesanan belum dapat diproses. Data dan stok Anda belum berubah; silakan coba lagi." };
}

export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });
  const supabase = createServerSupabase();
  if (!supabase) {
    try {
      const { orders } = await requestHostedAdmin<{ orders: Record<string, unknown>[] }>("admin_orders");
      return NextResponse.json(orders.map(mapOrder));
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Pesanan gagal dimuat." }, { status: 503 });
    }
  }
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
  if (!supabase) {
    if (!usesHostedDemo()) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
    try {
      const { order: row } = await requestHostedDemo<{ order: Record<string, unknown> }>("reserve_order", { input, shipping });
      return NextResponse.json(mapOrder(row), { status: 201 });
    } catch (error) {
      const failure = orderFailure(error instanceof Error ? error.message : "Pesanan gagal dibuat.");
      return NextResponse.json({ error: failure.message }, { status: failure.status });
    }
  }
  let paymentMethod: PaymentMethodConfig;
  try {
    paymentMethod = await resolvePaymentMethodServer(supabase, input.paymentMethodId, input.paymentMethod);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Metode pembayaran tidak valid." }, { status: 400 });
  }
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
  if (error) {
    console.error("reserve_order failed", { code: error.code, message: error.message, details: error.details, hint: error.hint });
    const failure = orderFailure(error.message);
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
  const paymentDetails = paymentDetailsFromConfig(paymentMethod);
  const { data: updated } = await supabase
    .from("orders")
    .update({
      payment_method_id: uuidPattern.test(paymentMethod.id) ? paymentMethod.id : null,
      payment_details: paymentDetails,
    })
    .eq("id", (data as Record<string, unknown>).id)
    .select(orderSelect)
    .single();
  const order = { ...mapOrder((updated || data) as Record<string, unknown>), paymentMethodId: paymentMethod.id, paymentDetails };
  await writeAudit(supabase, "order.created", "order", order.id, { source: order.source, orderNumber: order.orderNumber });
  return NextResponse.json(order, { status: 201 });
}
