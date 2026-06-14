import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminRequest } from "./admin-auth";
import type { OverlayEvent } from "./types";

function configuredKey() {
  const demoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return process.env.OVERLAY_STREAM_KEY || (process.env.NODE_ENV !== "production" || demoMode ? "anggi-live-demo" : "");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyOverlayRequest(request: NextRequest) {
  if (isAdminRequest(request)) return true;
  const expected = configuredKey();
  const received = request.headers.get("x-overlay-key") || "";
  return Boolean(expected) && safeEqual(received, expected);
}

export function overlayTopic() {
  return `overlay:${createHash("sha256").update(configuredKey()).digest("hex").slice(0, 24)}`;
}

export function streamUrl(origin: string) {
  return `${origin}/overlay#key=${encodeURIComponent(configuredKey())}`;
}

export function mapOverlayEvent(row: Record<string, unknown>): OverlayEvent {
  return {
    id: String(row.id),
    type: row.type as OverlayEvent["type"],
    buyerDisplay: row.buyer_display ? String(row.buyer_display) : undefined,
    productCode: String(row.product_code),
    productName: String(row.product_name),
    productPrice: Number(row.product_price),
    source: row.source as OverlayEvent["source"],
    message: String(row.message),
    duration: Number(row.duration),
    sound: Boolean(row.sound),
    createdAt: String(row.created_at),
    deliveredAt: row.delivered_at ? String(row.delivered_at) : undefined,
    deliveryCount: Number(row.delivery_count || 0),
  };
}

export async function publishOverlayEvent(supabase: SupabaseClient, value: Omit<OverlayEvent, "id" | "createdAt" | "deliveredAt" | "deliveryCount">) {
  const { data, error } = await supabase.from("overlay_events").insert({
    type: value.type,
    buyer_display: value.buyerDisplay,
    product_code: value.productCode,
    product_name: value.productName,
    product_price: value.productPrice,
    source: value.source,
    message: value.message,
    duration: value.duration,
    sound: value.sound,
  }).select("*").single();
  if (error) throw error;
  const event = mapOverlayEvent(data);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ topic: overlayTopic(), event: "overlay", payload: event, private: false }] }),
      cache: "no-store",
    }).catch(() => undefined);
  }
  return event;
}
