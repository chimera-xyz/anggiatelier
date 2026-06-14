import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit-server";
import { mapLiveSession, verifyAdmin } from "@/lib/server-helpers";
import { createServerSupabase } from "@/lib/supabase/server";

async function listSessions() {
  const supabase = createServerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from("live_sessions").select("*, orders(id,status,total)").order("started_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data.map((row) => {
    const orders = (row.orders || []) as Array<{ status: string; total: number }>;
    return mapLiveSession({ ...row, order_count: orders.length, revenue: orders.filter((order) => order.status === "paid").reduce((sum, order) => sum + Number(order.total), 0) });
  });
}

export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });
  try { return NextResponse.json(await listSessions()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Sesi live gagal dimuat." }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "Live Anggi Atelier").trim().slice(0, 120);
  const supabase = createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
  await supabase.from("live_sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("status", "active");
  const { data, error } = await supabase.from("live_sessions").insert({ name }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await writeAudit(supabase, "live.started", "live_session", data.id, { name });
  return NextResponse.json(mapLiveSession(data), { status: 201 });
}

export async function PATCH(request: NextRequest) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "");
  const supabase = createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
  const { data, error } = await supabase.from("live_sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await writeAudit(supabase, "live.ended", "live_session", id);
  return NextResponse.json(mapLiveSession(data));
}
