import { NextRequest, NextResponse } from "next/server";
import { heartbeatDemoOverlayClient } from "@/lib/demo-overlay-server";
import { verifyOverlayRequest } from "@/lib/overlay-server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (!verifyOverlayRequest(request)) return NextResponse.json({ error: "Kunci overlay tidak valid." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const clientId = String(body.clientId || "").slice(0, 120);
  if (!clientId) return NextResponse.json({ error: "Client ID wajib diisi." }, { status: 400 });
  const supabase = createServerSupabase();
  if (!supabase) {
    try {
      await heartbeatDemoOverlayClient(clientId, request.headers.get("user-agent"));
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Heartbeat overlay gagal." }, { status: 502 });
    }
  } else {
    const { error } = await supabase.from("overlay_clients").upsert({
      client_id: clientId,
      last_seen: new Date().toISOString(),
      user_agent: request.headers.get("user-agent")?.slice(0, 500) || null,
    }, { onConflict: "client_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, serverTime: new Date().toISOString() });
}
