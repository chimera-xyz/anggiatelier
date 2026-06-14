import { NextRequest, NextResponse } from "next/server";
import { clearAdminCookie, isAdminRequest, setAdminCookie, verifyPin } from "@/lib/admin-auth";
import { enforceRateLimit, requestIp } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  return NextResponse.json({ authenticated: isAdminRequest(request) });
}

export async function POST(request: NextRequest) {
  const allowed = await enforceRateLimit(`admin-login:${requestIp(request)}`, 10, 10 * 60);
  if (!allowed) return NextResponse.json({ error: "Terlalu banyak percobaan login. Coba lagi beberapa menit." }, { status: 429 });
  const { pin } = await request.json();
  if (!verifyPin(String(pin || ""))) return NextResponse.json({ error: "PIN admin salah." }, { status: 401 });
  const response = NextResponse.json({ authenticated: true });
  setAdminCookie(response);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  clearAdminCookie(response);
  return response;
}
