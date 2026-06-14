import { NextRequest, NextResponse } from "next/server";
import { shippingServices as demoServices } from "@/lib/seed";
import { createServerSupabase } from "@/lib/supabase/server";
import { mapShippingService, verifyAdmin } from "@/lib/server-helpers";
import { shippingServiceSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/audit-server";

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  if (!supabase) return NextResponse.json(demoServices);
  let query = supabase.from("shipping_services").select("*").order("courier_name").order("service_name");
  if (!verifyAdmin(request) || request.nextUrl.searchParams.get("all") !== "1") query = query.eq("enabled", true);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data.map(mapShippingService));
}

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });
  const parsed = shippingServiceSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Data kurir tidak valid." }, { status: 400 });
  const supabase = createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
  const value = parsed.data;
  const { data, error } = await supabase.from("shipping_services").insert({ courier_code: value.courierCode, courier_name: value.courierName, service_code: value.serviceCode, service_name: value.serviceName, flat_price: value.flatPrice, eta: value.eta, enabled: value.enabled, source: "manual" }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  await writeAudit(supabase, "shipping.created", "shipping_service", data.id, { courier: value.courierName, service: value.serviceName });
  return NextResponse.json(mapShippingService(data), { status: 201 });
}
