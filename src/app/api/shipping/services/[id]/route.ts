import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { mapShippingService, verifyAdmin } from "@/lib/server-helpers";
import { shippingServiceSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/audit-server";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Context) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });
  const { id } = await context.params;
  const parsed = shippingServiceSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Data kurir tidak valid." }, { status: 400 });
  const supabase = createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
  const value = parsed.data;
  const { data, error } = await supabase.from("shipping_services").update({ courier_code: value.courierCode, courier_name: value.courierName, service_code: value.serviceCode, service_name: value.serviceName, flat_price: value.flatPrice, eta: value.eta, enabled: value.enabled, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  await writeAudit(supabase, "shipping.updated", "shipping_service", id, { courier: value.courierName, service: value.serviceName });
  return NextResponse.json(mapShippingService(data));
}

export async function DELETE(request: NextRequest, context: Context) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });
  const { id } = await context.params;
  const supabase = createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
  const { error } = await supabase.from("shipping_services").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await writeAudit(supabase, "shipping.deleted", "shipping_service", id);
  return NextResponse.json({ ok: true });
}
