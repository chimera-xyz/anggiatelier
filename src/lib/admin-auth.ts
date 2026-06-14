import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export const ADMIN_COOKIE = "anggi_admin_session";
const SESSION_SECONDS = 12 * 60 * 60;

function secret() {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV !== "production") return "anggi-atelier-local-development-session";
  throw new Error("ADMIN_SESSION_SECRET belum dikonfigurasi.");
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function expectedAdminPin() {
  return process.env.ADMIN_PIN || (process.env.NODE_ENV !== "production" ? "1234" : "");
}

export function verifyPin(pin: string) {
  const expected = expectedAdminPin();
  return Boolean(expected) && safeEqual(pin, expected);
}

export function createAdminToken() {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${expiresAt}.admin`;
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminToken(token?: string) {
  if (!token) return false;
  const [expiresAt, role, signature] = token.split(".");
  if (!expiresAt || role !== "admin" || !signature) return false;
  if (Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;
  return safeEqual(signature, sign(`${expiresAt}.${role}`));
}

export function isAdminRequest(request: NextRequest) {
  return verifyAdminToken(request.cookies.get(ADMIN_COOKIE)?.value);
}

export function setAdminCookie(response: NextResponse) {
  response.cookies.set(ADMIN_COOKIE, createAdminToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export function clearAdminCookie(response: NextResponse) {
  response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}
