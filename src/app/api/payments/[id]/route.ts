import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit-server";
import { deletePaymentMethodServer, savePaymentMethodServer } from "@/lib/payment-server";
import { paymentMethodConfigSchema } from "@/lib/schemas";
import { verifyAdmin } from "@/lib/server-helpers";
import { createServerSupabase } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Context) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });
  const { id } = await context.params;
  const parsed = paymentMethodConfigSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Metode pembayaran tidak valid." }, { status: 400 });

  const supabase = createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
  const data = await savePaymentMethodServer(supabase, { ...parsed.data, id });
  await writeAudit(supabase, "payment_method.updated", "payment_method", id, { name: parsed.data.name, type: parsed.data.type });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, context: Context) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });
  const { id } = await context.params;
  const supabase = createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
  await deletePaymentMethodServer(supabase, id);
  await writeAudit(supabase, "payment_method.deleted", "payment_method", id);
  return NextResponse.json({ ok: true });
}
