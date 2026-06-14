import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit-server";
import { defaultPaymentMethods } from "@/lib/payments";
import { listPaymentMethodsServer, savePaymentMethodServer } from "@/lib/payment-server";
import { paymentMethodConfigSchema } from "@/lib/schemas";
import { verifyAdmin } from "@/lib/server-helpers";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const all = request.nextUrl.searchParams.get("all") === "1";
  if (all && !verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });

  const supabase = createServerSupabase();
  if (!supabase) return NextResponse.json(defaultPaymentMethods.filter((method) => all || method.enabled));
  return NextResponse.json(await listPaymentMethodsServer(supabase, all));
}

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });
  const parsed = paymentMethodConfigSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Metode pembayaran tidak valid." }, { status: 400 });

  const supabase = createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
  const method = await savePaymentMethodServer(supabase, parsed.data);
  await writeAudit(supabase, "payment_method.created", "payment_method", method.id, { name: parsed.data.name, type: parsed.data.type });
  return NextResponse.json(method, { status: 201 });
}
