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

function paymentDetails(row: Record<string, unknown>) {
  return {
    methodId: String(row.id),
    type: row.type,
    name: String(row.name),
    bankCode: row.bank_code || undefined,
    accountNumber: row.account_number || undefined,
    accountHolder: row.account_holder || undefined,
    qrisPayload: row.qris_payload || undefined,
    instructions: row.instructions || undefined,
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

    if (action === "products") {
      let query = supabase.from("products").select("*, product_variants(*)").order("code");
      if (!body.all) query = query.eq("active", true);
      const { data, error } = await query;
      if (error) throw error;
      return response({ products: data || [] });
    }

    if (action === "payments") {
      const { data, error } = await supabase.from("payment_methods").select("*").eq("enabled", true).order("sort_order").order("name");
      if (error) throw error;
      return response({ payments: data || [] });
    }

    if (action === "shipping_context") {
      const productId = String(body.productId || "");
      if (!productId) return response({ error: "Product ID wajib diisi." }, 400);
      const [{ data: product, error: productError }, { data: services, error: serviceError }] = await Promise.all([
        supabase.from("products").select("id,name,price,weight_grams,length_cm,width_cm,height_cm").eq("id", productId).eq("active", true).single(),
        supabase.from("shipping_services").select("*").eq("enabled", true).order("flat_price"),
      ]);
      if (productError) throw productError;
      if (serviceError) throw serviceError;
      return response({ product, services: services || [] });
    }

    if (action === "reserve_order") {
      const input = (body.input || {}) as Record<string, unknown>;
      const address = (input.address || {}) as Record<string, unknown>;
      const requestedShipping = (body.shipping || {}) as Record<string, unknown>;
      const productId = String(input.productId || "");
      const variantId = String(input.variantId || "");
      const paymentMethodId = String(input.paymentMethodId || "");
      const buyerName = String(input.buyerName || "").trim();
      const whatsapp = String(input.whatsapp || "").trim();
      if (!productId || !variantId || !paymentMethodId || buyerName.length < 2 || whatsapp.length < 8) {
        return response({ error: "Data pesanan tidak lengkap." }, 400);
      }
      if (!String(address.line || "") || !String(address.city || "") || !String(address.postalCode || "").match(/^\d{5}$/)) {
        return response({ error: "Alamat pengiriman tidak valid." }, 400);
      }
      const shippingId = String(requestedShipping.id || "");
      if (!shippingId.startsWith("manual:")) return response({ error: "Layanan ongkir tidak valid." }, 400);
      const serviceId = shippingId.slice("manual:".length);
      const [{ data: method, error: methodError }, { data: service, error: serviceError }] = await Promise.all([
        supabase.from("payment_methods").select("*").eq("id", paymentMethodId).eq("enabled", true).single(),
        supabase.from("shipping_services").select("*").eq("id", serviceId).eq("enabled", true).single(),
      ]);
      if (methodError || !method) return response({ error: "Metode pembayaran tidak aktif atau tidak ditemukan." }, 400);
      if (serviceError || !service) return response({ error: "Layanan ongkir tidak aktif atau tidak ditemukan." }, 400);
      if (method.type !== input.paymentMethod) return response({ error: "Jenis pembayaran tidak cocok." }, 400);
      const shipping = {
        id: `manual:${service.id}`,
        courier: service.courier_name,
        service: service.service_name,
        price: Number(service.flat_price),
        eta: service.eta,
      };
      const { data: reserved, error: reserveError } = await supabase.rpc("reserve_order", {
        p_product_id: productId,
        p_variant_id: variantId,
        p_source: input.source === "whatsapp" ? "whatsapp" : "website",
        p_quantity: Math.max(1, Math.min(10, Number(input.quantity) || 1)),
        p_buyer_name: buyerName,
        p_whatsapp: whatsapp,
        p_address: address,
        p_shipping: shipping,
        p_payment_method: method.type,
        p_proof_name: null,
      });
      if (reserveError) throw reserveError;
      const details = paymentDetails(method);
      const { data: order, error: updateError } = await supabase.from("orders").update({
        payment_method_id: method.id,
        payment_details: details,
      }).eq("id", reserved.id).select("*, products(code,name,image_url)").single();
      if (updateError) throw updateError;
      return response({ order });
    }

    if (action === "order_get") {
      const orderId = String(body.orderId || "");
      const token = String(body.token || "");
      if (!orderId || !token) return response({ error: "Tautan pesanan tidak valid." }, 401);
      await supabase.rpc("expire_reservations");
      const { data: order, error } = await supabase.from("orders").select("*, products(code,name,image_url)").eq("id", orderId).single();
      if (error || !order) return response({ error: "Pesanan tidak ditemukan." }, 404);
      if (String(order.public_token) !== token) return response({ error: "Tautan pesanan tidak valid." }, 401);
      return response({ order });
    }

    if (action === "set_live_product") {
      const productId = String(body.productId || "");
      if (!productId) return response({ error: "Product ID wajib diisi." }, 400);
      const { error: updateError } = await supabase.rpc("set_live_product", { p_product_id: productId });
      if (updateError) throw updateError;
      const { data, error } = await supabase.from("products").select("*, product_variants(*)").eq("id", productId).single();
      if (error) throw error;
      return response({ product: data });
    }

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
    const message = error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String(error.message)
        : "Operasi overlay gagal.";
    return response({ error: message }, 500);
  }
});
