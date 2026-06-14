import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/server-helpers";
import { createServerSupabase } from "@/lib/supabase/server";

function csv(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });
  const supabase = createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  let query = supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (sessionId) query = query.eq("live_session_id", sessionId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const headers = ["Nomor Order", "Waktu", "Sumber", "Status Bayar", "Status Kirim", "Pembeli", "WhatsApp", "Kode", "SKU", "Warna", "Ukuran", "Qty", "Subtotal", "Ongkir", "Total", "Kurir", "Layanan", "Resi"];
  const rows = data.map((order) => [order.order_number, order.created_at, order.source, order.status, order.fulfillment_status, order.buyer_name, order.whatsapp, order.product_code, order.variant_sku, order.color, order.size, order.quantity, order.subtotal, order.shipping?.price, order.total, order.shipping?.courier, order.shipping?.service, order.waybill].map(csv).join(","));
  const content = `\uFEFF${headers.map(csv).join(",")}\n${rows.join("\n")}`;
  return new NextResponse(content, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="anggi-orders-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
