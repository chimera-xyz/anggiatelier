import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit-server";
import { defaultPaymentMethods } from "@/lib/payments";
import { requestHostedAdmin, requestHostedDemo, usesHostedDemo } from "@/lib/demo-overlay-server";
import { listPaymentMethodsServer, savePaymentMethodServer } from "@/lib/payment-server";
import { paymentMethodConfigSchema } from "@/lib/schemas";
import { mapPaymentMethod, verifyAdmin } from "@/lib/server-helpers";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const all = request.nextUrl.searchParams.get("all") === "1";
  if (all && !verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });

  const supabase = createServerSupabase();
  if (!supabase) {
    if (usesHostedDemo() && all) {
      try {
        const { payments } = await requestHostedAdmin<{ payments: Record<string, unknown>[] }>("admin_payments");
        return NextResponse.json(payments.map(mapPaymentMethod));
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Metode pembayaran gagal dimuat." }, { status: 503 });
      }
    }
    if (usesHostedDemo() && !all) {
      try {
        const { payments } = await requestHostedDemo<{ payments: Record<string, unknown>[] }>("payments");
        return NextResponse.json(payments.map(mapPaymentMethod));
      } catch {
        // Keep checkout usable with the safe local QRIS fallback.
      }
    }
    return NextResponse.json(defaultPaymentMethods.filter((method) => all || method.enabled));
  }
  return NextResponse.json(await listPaymentMethodsServer(supabase, all));
}

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });
  const parsed = paymentMethodConfigSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Metode pembayaran tidak valid." }, { status: 400 });

  const supabase = createServerSupabase();
  if (!supabase) {
    try {
      const { payment } = await requestHostedAdmin<{ payment: Record<string, unknown> }>("admin_payment_save", { input: parsed.data });
      return NextResponse.json(mapPaymentMethod(payment), { status: 201 });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Metode pembayaran gagal disimpan." }, { status: 503 });
    }
  }
  const method = await savePaymentMethodServer(supabase, parsed.data);
  await writeAudit(supabase, "payment_method.created", "payment_method", method.id, { name: parsed.data.name, type: parsed.data.type });
  return NextResponse.json(method, { status: 201 });
}
