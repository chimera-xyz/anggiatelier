import { NextRequest, NextResponse } from "next/server";
import { acknowledgeDemoOverlayEvent } from "@/lib/demo-overlay-server";
import { verifyOverlayRequest } from "@/lib/overlay-server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (!verifyOverlayRequest(request)) return NextResponse.json({ error: "Kunci overlay tidak valid." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const eventId = String(body.eventId || "");
  const clientId = String(body.clientId || "").slice(0, 120);
  if (!eventId || !clientId) return NextResponse.json({ error: "Event dan client ID wajib diisi." }, { status: 400 });
  const supabase = createServerSupabase();
  if (!supabase) {
    try {
      const event = await acknowledgeDemoOverlayEvent(eventId, clientId);
      return event ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Event tidak ditemukan." }, { status: 404 });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Acknowledgement overlay gagal." }, { status: 502 });
    }
  }
  const { data: event } = await supabase.from("overlay_events").select("delivery_count").eq("id", eventId).single();
  if (!event) return NextResponse.json({ error: "Event tidak ditemukan." }, { status: 404 });
  await Promise.all([
    supabase.from("overlay_events").update({ delivered_at: new Date().toISOString(), delivery_count: Number(event.delivery_count || 0) + 1 }).eq("id", eventId),
    supabase.from("overlay_clients").upsert({ client_id: clientId, last_seen: new Date().toISOString(), current_event_id: eventId }, { onConflict: "client_id" }),
  ]);
  return NextResponse.json({ ok: true });
}
