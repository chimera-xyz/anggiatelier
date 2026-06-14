import { NextRequest, NextResponse } from "next/server";
import { getDemoOverlayHealth } from "@/lib/demo-overlay-server";
import { mapOverlayEvent, streamUrl } from "@/lib/overlay-server";
import { verifyAdmin } from "@/lib/server-helpers";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });
  const supabase = createServerSupabase();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  if (!supabase) return NextResponse.json({ ...getDemoOverlayHealth(), streamUrl: streamUrl(origin) });
  const cutoff = new Date(Date.now() - 20_000).toISOString();
  const [{ data: clients, count }, { data: latest }] = await Promise.all([
    supabase.from("overlay_clients").select("last_seen", { count: "exact" }).gte("last_seen", cutoff).order("last_seen", { ascending: false }),
    supabase.from("overlay_events").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return NextResponse.json({
    connected: Boolean(count),
    clientCount: count || 0,
    lastSeen: clients?.[0]?.last_seen,
    latestEvent: latest ? mapOverlayEvent(latest) : undefined,
    streamUrl: streamUrl(origin),
  });
}
