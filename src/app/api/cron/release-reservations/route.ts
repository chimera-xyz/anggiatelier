import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected && process.env.NODE_ENV === "production") return NextResponse.json({ error: "CRON_SECRET belum dikonfigurasi." }, { status: 503 });
  if (expected && request.headers.get("authorization") !== `Bearer ${expected}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
  const { data, error } = await supabase.rpc("expire_reservations");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ released: data, ranAt: new Date().toISOString() });
}
