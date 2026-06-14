import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { createRemoteJWKSet, decodeJwt, jwtVerify } from "npm:jose@6.1.3";

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };
const overlayKey = "anggi-live-demo";
const vercelProjectId = "prj_LYXRvJ1O1ZEyFiwuAhLlPc6fptig";
const vercelTeamId = "team_TDlDalo8mqfB3lrwqeU8j3nh";
const vercelIssuers = new Set(["https://oidc.vercel.com", "https://oidc.vercel.com/raihancarjastis-projects"]);

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

async function trustedVercelRequest(request: Request) {
  const token = request.headers.get("x-vercel-oidc-token");
  if (!token) return false;
  try {
    const decoded = decodeJwt(token);
    const issuer = String(decoded.iss || "");
    if (!vercelIssuers.has(issuer)) return false;
    const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks`));
    const { payload } = await jwtVerify(token, jwks, { issuer });
    return payload.project_id === vercelProjectId
      && payload.owner_id === vercelTeamId
      && payload.environment === "production";
  } catch {
    return false;
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return response({ error: "Method tidak diizinkan." }, 405);

  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");
    const adminAction = action.startsWith("admin_");
    if (adminAction) {
      if (!await trustedVercelRequest(request)) return response({ error: "Koneksi admin tidak terverifikasi." }, 401);
    } else if (request.headers.get("x-overlay-key") !== overlayKey) {
      return response({ error: "Kunci overlay tidak valid." }, 401);
    }
    const key = adminKey();
    if (!key) return response({ error: "Supabase admin key tidak tersedia." }, 500);
    const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (action === "admin_orders") {
      await supabase.rpc("expire_reservations");
      const { data, error } = await supabase.from("orders").select("*, products(code,name,image_url)").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return response({ orders: data || [] });
    }

    if (action === "admin_order_get") {
      const id = String(body.id || "");
      if (!id) return response({ error: "Pesanan tidak ditemukan." }, 404);
      await supabase.rpc("expire_reservations");
      const { data, error } = await supabase.from("orders").select("*, products(code,name,image_url)").eq("id", id).single();
      if (error || !data) return response({ error: "Pesanan tidak ditemukan." }, 404);
      return response({ order: data });
    }

    if (action === "admin_payments") {
      const { data, error } = await supabase.from("payment_methods").select("*").order("sort_order").order("name");
      if (error) throw error;
      return response({ payments: data || [] });
    }

    if (action === "admin_shipping") {
      const { data, error } = await supabase.from("shipping_services").select("*").order("courier_name").order("service_name");
      if (error) throw error;
      return response({ services: data || [] });
    }

    if (action === "admin_sessions") {
      const { data, error } = await supabase.from("live_sessions").select("*, orders(id,status,total)").order("started_at", { ascending: false }).limit(100);
      if (error) throw error;
      const sessions = (data || []).map((row) => {
        const orders = Array.isArray(row.orders) ? row.orders as Array<{ status: string; total: number }> : [];
        return {
          ...row,
          order_count: orders.length,
          revenue: orders.filter((order) => order.status === "paid").reduce((sum, order) => sum + Number(order.total), 0),
        };
      });
      return response({ sessions });
    }

    if (action === "admin_audit") {
      const { data, error } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return response({ logs: data || [] });
    }

    if (action === "admin_product_save") {
      const id = body.id ? String(body.id) : null;
      const input = (body.input || {}) as Record<string, unknown>;
      if (!String(input.code || "").trim() || !String(input.name || "").trim() || !Array.isArray(input.variants) || !input.variants.length) {
        return response({ error: "Data produk dan varian belum lengkap." }, 400);
      }
      const { data: productId, error: saveError } = await supabase.rpc("save_product", {
        p_product_id: id,
        p_data: input,
      });
      if (saveError) return response({ error: saveError.message }, 409);
      const { data, error } = await supabase.from("products").select("*, product_variants(*)").eq("id", productId).single();
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: id ? "product.updated" : "product.created",
        entity_type: "product",
        entity_id: productId,
        details: { code: input.code },
      });
      return response({ product: data });
    }

    if (action === "admin_product_archive") {
      const id = String(body.id || "");
      const { data: variants, error: variantError } = await supabase.from("product_variants").select("reserved_quantity").eq("product_id", id);
      if (variantError) throw variantError;
      if ((variants || []).some((variant) => Number(variant.reserved_quantity) > 0)) {
        return response({ error: "Produk masih memiliki reservasi aktif." }, 409);
      }
      const { error } = await supabase.from("products").update({ active: false, is_live: false, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({ action: "product.archived", entity_type: "product", entity_id: id });
      return response({ ok: true });
    }

    if (action === "admin_product_upload_url") {
      const extension = String(body.extension || "webp").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "webp";
      const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
      const bucket = supabase.storage.from("product-images");
      const { data, error } = await bucket.createSignedUploadUrl(path);
      if (error || !data) throw error || new Error("URL upload foto gagal dibuat.");
      const { data: publicData } = bucket.getPublicUrl(path);
      return response({ upload: { signedUrl: data.signedUrl, publicUrl: publicData.publicUrl } });
    }

    if (action === "admin_live_start") {
      const name = String(body.name || "Live Anggi Atelier").trim().slice(0, 120);
      await supabase.from("live_sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("status", "active");
      const { data, error } = await supabase.from("live_sessions").insert({ name }).select("*").single();
      if (error) throw error;
      await supabase.from("audit_logs").insert({ action: "live.started", entity_type: "live_session", entity_id: data.id, details: { name } });
      return response({ session: data });
    }

    if (action === "admin_live_end") {
      const id = String(body.id || "");
      const { data, error } = await supabase.from("live_sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", id).select("*").single();
      if (error) throw error;
      await supabase.from("audit_logs").insert({ action: "live.ended", entity_type: "live_session", entity_id: id });
      return response({ session: data });
    }

    if (action === "admin_payment_save") {
      const input = (body.input || {}) as Record<string, unknown>;
      const id = String(body.id || "");
      const payment = {
        type: input.type === "qris" ? "qris" : "bank_transfer",
        name: String(input.name || "").trim().slice(0, 120),
        bank_code: input.bankCode ? String(input.bankCode).trim().slice(0, 80) : null,
        account_number: input.accountNumber ? String(input.accountNumber).trim().slice(0, 120) : null,
        account_holder: input.accountHolder ? String(input.accountHolder).trim().slice(0, 120) : null,
        qris_payload: input.qrisPayload ? String(input.qrisPayload).trim() : null,
        instructions: input.instructions ? String(input.instructions).trim().slice(0, 500) : null,
        enabled: Boolean(input.enabled),
        sort_order: Number(input.sortOrder || 100),
        updated_at: new Date().toISOString(),
      };
      if (!payment.name) return response({ error: "Nama metode pembayaran wajib diisi." }, 400);
      const query = id
        ? supabase.from("payment_methods").update(payment).eq("id", id)
        : supabase.from("payment_methods").insert(payment);
      const { data, error } = await query.select("*").single();
      if (error) throw error;
      await supabase.from("audit_logs").insert({ action: id ? "payment_method.updated" : "payment_method.created", entity_type: "payment_method", entity_id: data.id, details: { name: payment.name, type: payment.type } });
      return response({ payment: data });
    }

    if (action === "admin_payment_delete") {
      const id = String(body.id || "");
      const { error } = await supabase.from("payment_methods").delete().eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({ action: "payment_method.deleted", entity_type: "payment_method", entity_id: id });
      return response({ ok: true });
    }

    if (action === "admin_order_update") {
      const id = String(body.id || "");
      const input = (body.input || {}) as Record<string, unknown>;
      const orderAction = String(input.action || "");
      const { data: current, error: currentError } = await supabase.from("orders").select("*, products(code,name,image_url)").eq("id", id).single();
      if (currentError || !current) return response({ error: "Pesanan tidak ditemukan." }, 404);
      let order = current;
      if (orderAction === "confirm") {
        const { data, error } = await supabase.rpc("confirm_order", { p_order_id: id });
        if (error) return response({ error: error.message }, 409);
        order = data;
        if (input.showInLive !== false && current.status !== "paid") {
          await supabase.from("overlay_events").insert({
            type: "purchase",
            buyer_display: `${String(order.buyer_name || "Buyer").slice(0, 1)}***`,
            product_code: order.product_code,
            product_name: order.product_name,
            product_price: order.unit_price,
            source: order.source,
            message: "Pembayaran dikonfirmasi",
            duration: 7,
            sound: true,
          });
        }
      } else if (orderAction === "release" || orderAction === "reject") {
        const rpc = orderAction === "release" ? "release_order" : "reject_order";
        const args = orderAction === "release" ? { p_order_id: id } : { p_order_id: id, p_reason: String(input.reason || "Bukti pembayaran ditolak.") };
        const { data, error } = await supabase.rpc(rpc, args);
        if (error) return response({ error: error.message }, 409);
        order = data;
      } else {
        if (orderAction !== "note" && current.status !== "paid") return response({ error: "Pesanan harus dibayar sebelum diproses." }, 409);
        const now = new Date().toISOString();
        const updates = orderAction === "pack"
          ? { fulfillment_status: "packed", packed_at: now }
          : orderAction === "ship"
            ? { fulfillment_status: "shipped", shipped_at: now, waybill: input.waybill || null, tracking_url: input.trackingUrl || null }
            : orderAction === "complete"
              ? { fulfillment_status: "completed", completed_at: now }
              : { admin_note: input.adminNote || null };
        const { data, error } = await supabase.from("orders").update(updates).eq("id", id).select("*, products(code,name,image_url)").single();
        if (error) throw error;
        order = data;
      }
      await supabase.from("audit_logs").insert({ action: `order.${orderAction}`, entity_type: "order", entity_id: id, details: input });
      return response({ order });
    }

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
