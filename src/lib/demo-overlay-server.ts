import "server-only";

import { randomUUID } from "node:crypto";
import type { OverlayEvent } from "./types";

const hostedDemoUrl =
  process.env.HOSTED_DEMO_OVERLAY_URL ||
  "https://slswehtkrutimadzizco.supabase.co/functions/v1/anggi-overlay-demo";

function usesHostedDemo() {
  return process.env.VERCEL === "1";
}

async function requestHostedDemo<T>(action: string, payload: Record<string, unknown> = {}) {
  const response = await fetch(hostedDemoUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-overlay-key": process.env.OVERLAY_STREAM_KEY || "anggi-live-demo",
    },
    body: JSON.stringify({ action, ...payload }),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "Hosted demo overlay tidak dapat dihubungi.");
  return body;
}

type DemoOverlayClient = {
  lastSeen: string;
  userAgent?: string;
  currentEventId?: string;
};

type DemoOverlayState = {
  latestEvent: OverlayEvent | null;
  clients: Map<string, DemoOverlayClient>;
};

const globalStore = globalThis as typeof globalThis & {
  anggiDemoOverlayState?: DemoOverlayState;
};

function getState() {
  globalStore.anggiDemoOverlayState ??= {
    latestEvent: null,
    clients: new Map(),
  };
  return globalStore.anggiDemoOverlayState;
}

export async function publishDemoOverlayEvent(
  value: Omit<OverlayEvent, "id" | "createdAt" | "deliveredAt" | "deliveryCount">,
) {
  if (usesHostedDemo()) return requestHostedDemo<OverlayEvent>("publish", { event: value });
  const event: OverlayEvent = {
    ...value,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    deliveryCount: 0,
  };
  getState().latestEvent = event;
  return event;
}

export async function getDemoOverlayEvent(after?: string | null) {
  if (usesHostedDemo()) {
    const result = await requestHostedDemo<{ event: OverlayEvent | null }>("feed", { after });
    return result.event;
  }
  const event = getState().latestEvent;
  if (!event || !after || Number.isNaN(Date.parse(after))) return event;
  return new Date(event.createdAt).getTime() > new Date(after).getTime() ? event : null;
}

export async function heartbeatDemoOverlayClient(clientId: string, userAgent?: string | null) {
  if (usesHostedDemo()) {
    await requestHostedDemo("heartbeat", { clientId, userAgent });
    return;
  }
  const current = getState().clients.get(clientId);
  getState().clients.set(clientId, {
    ...current,
    lastSeen: new Date().toISOString(),
    userAgent: userAgent || current?.userAgent,
  });
}

export async function acknowledgeDemoOverlayEvent(eventId: string, clientId: string) {
  if (usesHostedDemo()) {
    const result = await requestHostedDemo<{ event: OverlayEvent | null }>("ack", { eventId, clientId });
    return result.event;
  }
  const state = getState();
  const event = state.latestEvent;
  if (!event || event.id !== eventId) return null;
  const deliveredAt = new Date().toISOString();
  state.latestEvent = {
    ...event,
    deliveredAt,
    deliveryCount: (event.deliveryCount || 0) + 1,
  };
  const current = state.clients.get(clientId);
  state.clients.set(clientId, {
    ...current,
    lastSeen: deliveredAt,
    currentEventId: eventId,
  });
  return state.latestEvent;
}

export async function getDemoOverlayHealth(maxAgeMs = 20_000) {
  if (usesHostedDemo()) return requestHostedDemo<ReturnType<typeof localDemoOverlayHealth>>("health", { maxAgeMs });
  return localDemoOverlayHealth(maxAgeMs);
}

function localDemoOverlayHealth(maxAgeMs: number) {
  const state = getState();
  const cutoff = Date.now() - maxAgeMs;
  const activeClients = [...state.clients.values()]
    .filter((client) => new Date(client.lastSeen).getTime() >= cutoff)
    .sort((left, right) => new Date(right.lastSeen).getTime() - new Date(left.lastSeen).getTime());

  return {
    connected: activeClients.length > 0,
    clientCount: activeClients.length,
    lastSeen: activeClients[0]?.lastSeen,
    latestEvent: state.latestEvent || undefined,
  };
}
