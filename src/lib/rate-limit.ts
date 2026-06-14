import "server-only";

import type { NextRequest } from "next/server";
import { createServerSupabase } from "./supabase/server";

const memory = new Map<string, number[]>();

export function requestIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

export async function enforceRateLimit(key: string, limit: number, windowSeconds: number) {
  const supabase = createServerSupabase();
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  if (supabase) {
    const { count } = await supabase.from("rate_limit_events").select("id", { count: "exact", head: true }).eq("key", key).gte("created_at", since);
    if ((count || 0) >= limit) return false;
    await supabase.from("rate_limit_events").insert({ key });
    return true;
  }
  const now = Date.now();
  const recent = (memory.get(key) || []).filter((time) => time > now - windowSeconds * 1000);
  if (recent.length >= limit) return false;
  memory.set(key, [...recent, now]);
  return true;
}
