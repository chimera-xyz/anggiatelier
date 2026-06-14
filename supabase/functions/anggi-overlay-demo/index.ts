import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };
const overlayKey = "anggi-live-demo";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function mapEvent(row: Record<string, unknown> | null) {
  if (!row) return null;
  return {
    id: String(row.id),
    type: row.type,
    buyerDisplay: row.buyer_display || undefined,
    productCode: String(row.product_code),
    productName: String(row.product_name),
    productPrice: Number(row.product_price),
    source: row.source || undefined,
    message: String(row.message),
    duration: Number(row.duration),
    sound: Boolean(row.sound),
    createdAt: String(row.created_at),
    deliveredAt: row.delivered_at || undefined,
    deliveryCount: Number(row.delivery_count || 0),
  };
}

function adminKey() {
  const modernKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modernKeys) {
    const parsed = JSON.parse(modernKeys) as Record<string, string>;
    if (parsed.default) return parsed.default;
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return response({ error: "Method tidak diizinkan." }, 405);
  if (request.headers.get("x-overlay-key") !== overlayKey) return response({ error: "Kunci overlay tidak valid." }, 401);

  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");
    const key = adminKey();
    if (!key) return response({ error: "Supabase admin key tidak tersedia." }, 500);
    const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (action === "publish") {
      const event = (body.event || {}) as Record<string, unknown>;
      const type = event.type === "purchase" ? "purchase" : event.type === "product" ? "product" : "";
      const productCode = String(event.productCode || "").slice(0, 60);
      const productName = String(event.productName || "").slice(0, 180);
      const duration = Math.max(3, Math.min(30, Number(event.duration) || 7));
      if (!type || !productCode || !productName) return response({ error: "Payload overlay tidak valid." }, 400);

      const { data, error } = await supabase.from("overlay_events").insert({
        type,
        buyer_display: event.buyerDisplay ? String(event.buyerDisplay).slice(0, 120) : null,
        product_code: productCode,
        product_name: productName,
        product_price: Math.max(0, Number(event.productPrice) || 0),
        source: event.source === "whatsapp" ? "whatsapp" : event.source === "website" ? "website" : null,
        message: String(event.message || "").slice(0, 240),
        duration,
        sound: Boolean(event.sound),
      }).select("*").single();
      if (error) throw error;
      return response(mapEvent(data));
    }

    if (action === "feed") {
      const after = typeof body.after === "string" && !Number.isNaN(Date.parse(body.after)) ? body.after : null;
      let query = supabase.from("overlay_events").select("*").order("created_at", { ascending: false }).limit(1);
      if (after) query = query.gt("created_at", after);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return response({ event: mapEvent(data) });
    }

    if (action === "heartbeat") {
      const clientId = String(body.clientId || "").slice(0, 120);
      if (!clientId) return response({ error: "Client ID wajib diisi." }, 400);
      const { error } = await supabase.from("overlay_clients").upsert({
        client_id: clientId,
        last_seen: new Date().toISOString(),
        user_agent: body.userAgent ? String(body.userAgent).slice(0, 500) : null,
      }, { onConflict: "client_id" });
      if (error) throw error;
      return response({ ok: true });
    }

    if (action === "ack") {
      const eventId = String(body.eventId || "");
      const clientId = String(body.clientId || "").slice(0, 120);
      if (!eventId || !clientId) return response({ error: "Event dan client ID wajib diisi." }, 400);
      const { data: event, error } = await supabase.from("overlay_events").select("*").eq("id", eventId).maybeSingle();
      if (error) throw error;
      if (!event) return response({ event: null });
      const deliveredAt = new Date().toISOString();
      const [{ error: eventError }, { error: clientError }] = await Promise.all([
        supabase.from("overlay_events").update({
          delivered_at: deliveredAt,
          delivery_count: Number(event.delivery_count || 0) + 1,
        }).eq("id", eventId),
        supabase.from("overlay_clients").upsert({
          client_id: clientId,
          last_seen: deliveredAt,
          current_event_id: eventId,
        }, { onConflict: "client_id" }),
      ]);
      if (eventError) throw eventError;
      if (clientError) throw clientError;
      return response({ event: mapEvent({ ...event, delivered_at: deliveredAt, delivery_count: Number(event.delivery_count || 0) + 1 }) });
    }

    if (action === "health") {
      const maxAgeMs = Math.max(5_000, Math.min(120_000, Number(body.maxAgeMs) || 20_000));
      const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
      const [{ data: clients, count, error: clientError }, { data: latest, error: eventError }] = await Promise.all([
        supabase.from("overlay_clients").select("last_seen", { count: "exact" }).gte("last_seen", cutoff).order("last_seen", { ascending: false }),
        supabase.from("overlay_events").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (clientError) throw clientError;
      if (eventError) throw eventError;
      return response({
        connected: Boolean(count),
        clientCount: count || 0,
        lastSeen: clients?.[0]?.last_seen,
        latestEvent: mapEvent(latest),
      });
    }

    return response({ error: "Action overlay tidak dikenal." }, 400);
  } catch (error) {
    console.error(error);
    return response({ error: error instanceof Error ? error.message : "Operasi overlay gagal." }, 500);
  }
});
