import "server-only";

import { randomUUID } from "node:crypto";
import type { OverlayEvent } from "./types";

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

export function publishDemoOverlayEvent(
  value: Omit<OverlayEvent, "id" | "createdAt" | "deliveredAt" | "deliveryCount">,
) {
  const event: OverlayEvent = {
    ...value,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    deliveryCount: 0,
  };
  getState().latestEvent = event;
  return event;
}

export function getDemoOverlayEvent(after?: string | null) {
  const event = getState().latestEvent;
  if (!event || !after || Number.isNaN(Date.parse(after))) return event;
  return new Date(event.createdAt).getTime() > new Date(after).getTime() ? event : null;
}

export function heartbeatDemoOverlayClient(clientId: string, userAgent?: string | null) {
  const current = getState().clients.get(clientId);
  getState().clients.set(clientId, {
    ...current,
    lastSeen: new Date().toISOString(),
    userAgent: userAgent || current?.userAgent,
  });
}

export function acknowledgeDemoOverlayEvent(eventId: string, clientId: string) {
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

export function getDemoOverlayHealth(maxAgeMs = 20_000) {
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
