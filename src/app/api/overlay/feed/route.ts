import { NextRequest, NextResponse } from "next/server";
import { getDemoOverlayEvent } from "@/lib/demo-overlay-server";
import { mapOverlayEvent, overlayTopic, verifyOverlayRequest } from "@/lib/overlay-server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  if (!verifyOverlayRequest(request)) return NextResponse.json({ error: "Kunci overlay tidak valid." }, { status: 401 });
  const supabase = createServerSupabase();
  const after = request.nextUrl.searchParams.get("after");
  if (!supabase) {
    try {
      return NextResponse.json({ event: await getDemoOverlayEvent(after), topic: overlayTopic(), serverTime: new Date().toISOString() });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Feed overlay tidak tersedia." }, { status: 502 });
    }
  }
  let query = supabase.from("overlay_events").select("*").order("created_at", { ascending: false }).limit(1);
  if (after && !Number.isNaN(Date.parse(after))) query = query.gt("created_at", after);
  const { data, error } = await query.maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: data ? mapOverlayEvent(data) : null, topic: overlayTopic(), serverTime: new Date().toISOString() });
}
