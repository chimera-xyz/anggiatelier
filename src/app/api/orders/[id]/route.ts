import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit-server";
import { requestHostedDemo, usesHostedDemo } from "@/lib/demo-overlay-server";
import { maskBuyerName } from "@/lib/format";
import { publishOverlayEvent } from "@/lib/overlay-server";
import { orderActionSchema } from "@/lib/schemas";
import { mapOrder, verifyAdmin } from "@/lib/server-helpers";
import { createServerSupabase } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };
const orderSelect = "*, products(code,name,image_url)";

export async function GET(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const supabase = createServerSupabase();
  if (!supabase) {
    if (!usesHostedDemo()) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
    try {
      const { order: row } = await requestHostedDemo<{ order: Record<string, unknown> }>("order_get", { orderId: id, token: request.nextUrl.searchParams.get("token") || "" });
      const order = mapOrder(row);
      return NextResponse.json({ id: order.id, orderNumber: order.orderNumber, status: order.status, productCode: order.productCode, productName: order.productName, productImage: order.productImage, color: order.color, size: order.size, subtotal: order.subtotal, shipping: order.shipping, paymentMethod: order.paymentMethod, paymentMethodId: order.paymentMethodId, paymentDetails: order.paymentDetails, total: order.total, reservedUntil: order.reservedUntil, accessToken: order.accessToken });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Pesanan tidak ditemukan." }, { status: 404 });
    }
  }
  await supabase.rpc("expire_reservations");
  const { data, error } = await supabase.from("orders").select(orderSelect).eq("id", id).single();
  if (error) return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });

  const isAdmin = verifyAdmin(request);
  if (!isAdmin && data.public_token !== request.nextUrl.searchParams.get("token")) {
    return NextResponse.json({ error: "Tautan pesanan tidak valid." }, { status: 401 });
  }
  const order = mapOrder(data);
  if (isAdmin) return NextResponse.json(order);
  return NextResponse.json({
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    productCode: order.productCode,
    productName: order.productName,
    productImage: order.productImage,
    color: order.color,
    size: order.size,
    subtotal: order.subtotal,
    shipping: order.shipping,
    paymentMethod: order.paymentMethod,
    paymentMethodId: order.paymentMethodId,
    paymentDetails: order.paymentDetails,
    total: order.total,
    reservedUntil: order.reservedUntil,
    accessToken: order.accessToken,
  });
}

export async function PATCH(request: NextRequest, context: Context) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });
  const { id } = await context.params;
  const parsed = orderActionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Aksi pesanan tidak valid." }, { status: 400 });
  const supabase = createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });

  const { data: current } = await supabase.from("orders").select(orderSelect).eq("id", id).single();
  if (!current) return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
  const currentOrder = mapOrder(current);
  const action = parsed.data;

  if (action.action === "confirm") {
    const { data, error } = await supabase.rpc("confirm_order", { p_order_id: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    const order = mapOrder(data as Record<string, unknown>);
    if (action.showInLive !== false && currentOrder.status !== "paid") {
      await publishOverlayEvent(supabase, {
        type: "purchase",
        buyerDisplay: maskBuyerName(order.buyerName),
        productCode: order.productCode,
        productName: order.productName,
        productPrice: order.unitPrice,
        source: order.source,
        message: "Pembayaran dikonfirmasi",
        duration: 7,
        sound: true,
      });
    }
    await writeAudit(supabase, "payment.confirmed", "order", id, { showInLive: action.showInLive !== false });
    return NextResponse.json(order);
  }

  if (action.action === "release" || action.action === "reject") {
    const rpc = action.action === "release" ? "release_order" : "reject_order";
    const args = action.action === "release" ? { p_order_id: id } : { p_order_id: id, p_reason: action.reason };
    const { data, error } = await supabase.rpc(rpc, args);
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    await writeAudit(supabase, action.action === "release" ? "order.cancelled" : "payment.rejected", "order", id, action.action === "reject" ? { reason: action.reason } : {});
    return NextResponse.json(mapOrder(data as Record<string, unknown>));
  }

  if (action.action !== "note" && currentOrder.status !== "paid") {
    return NextResponse.json({ error: "Pesanan harus dibayar sebelum diproses." }, { status: 409 });
  }
  if (action.action === "ship" && currentOrder.fulfillmentStatus !== "packed") {
    return NextResponse.json({ error: "Pesanan harus ditandai sudah dikemas sebelum dikirim." }, { status: 409 });
  }
  if (action.action === "complete" && currentOrder.fulfillmentStatus !== "shipped") {
    return NextResponse.json({ error: "Pesanan harus dikirim sebelum diselesaikan." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const updates = action.action === "pack"
    ? { fulfillment_status: "packed", packed_at: now }
    : action.action === "ship"
      ? { fulfillment_status: "shipped", shipped_at: now, waybill: action.waybill, tracking_url: action.trackingUrl || null }
      : action.action === "complete"
        ? { fulfillment_status: "completed", completed_at: now }
        : { admin_note: action.adminNote };
  const { data, error } = await supabase.from("orders").update(updates).eq("id", id).select(orderSelect).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await writeAudit(supabase, `fulfillment.${action.action}`, "order", id, action);
  return NextResponse.json(mapOrder(data));
}
