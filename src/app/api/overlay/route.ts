import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit-server";
import { publishDemoOverlayEvent } from "@/lib/demo-overlay-server";
import { publishOverlayEvent } from "@/lib/overlay-server";
import { overlaySchema } from "@/lib/schemas";
import { verifyAdmin } from "@/lib/server-helpers";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: "Sesi admin tidak valid." }, { status: 401 });
  const parsed = overlaySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Data overlay tidak valid." }, { status: 400 });
  const supabase = createServerSupabase();
  if (!supabase) {
    try {
      return NextResponse.json(await publishDemoOverlayEvent(parsed.data));
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Overlay demo gagal dikirim." }, { status: 502 });
    }
  }
  try {
    const event = await publishOverlayEvent(supabase, parsed.data);
    await writeAudit(supabase, "overlay.published", "overlay_event", event.id, { type: event.type, productCode: event.productCode });
    return NextResponse.json(event);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Overlay gagal dikirim." }, { status: 500 });
  }
}
