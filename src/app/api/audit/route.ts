import { NextRequest, NextResponse } from "next/server";
import { mapAuditLog, verifyAdmin } from "@/lib/server-helpers";
import { createServerSupabase } from "@/lib/supabase/server";
import { requestHostedAdmin, usesHostedDemo } from "@/lib/demo-overlay-server";

export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });
  const supabase = createServerSupabase();
  if (!supabase) {
    if (!usesHostedDemo()) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
    try {
      const { logs } = await requestHostedAdmin<{ logs: Record<string, unknown>[] }>("admin_audit");
      return NextResponse.json(logs.map(mapAuditLog));
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Audit gagal dimuat." }, { status: 503 });
    }
  }
  const { data, error } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data.map(mapAuditLog));
}
