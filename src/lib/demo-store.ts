"use client";

import { products as seedProducts, seedOrders, shippingServices as seedShippingServices } from "./seed";
import { maskBuyerName } from "./format";
import type {
  AuditLog,
  LiveSession,
  NewOrderInput,
  Order,
  OverlayEvent,
  Product,
  ProductDraft,
  ShippingService,
  ShippingServiceDraft,
} from "./types";

const PRODUCT_KEY = "anggi-products-v2";
const ORDER_KEY = "anggi-orders-v2";
const SHIPPING_KEY = "anggi-shipping-v2";
const SESSION_KEY = "anggi-live-sessions-v2";
const AUDIT_KEY = "anggi-audit-v2";
const OVERLAY_KEY = "anggi-overlay-v2";
const EVENT_NAME = "anggi-store-change";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return clone(fallback);
  const value = window.localStorage.getItem(key);
  if (!value) {
    window.localStorage.setItem(key, JSON.stringify(fallback));
    return clone(fallback);
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return clone(fallback);
  }
}

function write<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { key } }));
}

function makeOrderNumber(source: "website" | "whatsapp") {
  const now = new Date();
  const prefix = source === "website" ? "WEB" : "WA";
  const date = `${String(now.getDate()).padStart(2, "0")}${String(now.getMonth() + 1).padStart(2, "0")}`;
  return `${prefix}-${date}-${String(Date.now()).slice(-5)}`;
}

function syncTotals(product: Product): Product {
  const activeVariants = product.variants.filter((variant) => variant.active);
  const colors = [...new Set(activeVariants.map((variant) => variant.color))];
  const sizes = [...new Set(activeVariants.map((variant) => variant.size))];
  const colorHex = Object.fromEntries(activeVariants.map((variant) => [variant.color, variant.colorHex]));
  return {
    ...product,
    colors,
    sizes,
    colorHex,
    stock: activeVariants.reduce((sum, variant) => sum + variant.stock, 0),
    reserved: activeVariants.reduce((sum, variant) => sum + variant.reserved, 0),
    image: product.images[0] || product.image,
  };
}

function rawOrders() {
  return read<Order[]>(ORDER_KEY, seedOrders);
}

function rawProducts() {
  return read<Product[]>(PRODUCT_KEY, seedProducts).map(syncTotals);
}

function addAudit(action: string, entityType: string, entityId?: string, details: Record<string, unknown> = {}) {
  const log: AuditLog = {
    id: crypto.randomUUID(),
    action,
    entityType,
    entityId,
    details,
    createdAt: new Date().toISOString(),
  };
  write(AUDIT_KEY, [log, ...read<AuditLog[]>(AUDIT_KEY, [])].slice(0, 100));
}

export function expireDemoReservations() {
  const now = Date.now();
  const orders = rawOrders();
  const products = rawProducts();
  let changed = false;
  for (const order of orders) {
    if (!["awaiting_payment", "pending_confirmation", "reserved"].includes(order.status)) continue;
    if (new Date(order.reservedUntil).getTime() > now) continue;
    const product = products.find((item) => item.id === order.productId);
    const variant = product?.variants.find((item) => item.id === order.variantId);
    if (variant) variant.reserved = Math.max(0, variant.reserved - order.quantity);
    order.status = "cancelled";
    order.adminNote = "Reservasi dilepas otomatis karena melewati batas waktu.";
    changed = true;
  }
  if (changed) {
    write(PRODUCT_KEY, products.map(syncTotals));
    write(ORDER_KEY, orders);
  }
}

export function getDemoProducts() {
  expireDemoReservations();
  return rawProducts();
}

export function getDemoOrders() {
  expireDemoReservations();
  return rawOrders().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getDemoOrder(id: string) {
  return getDemoOrders().find((order) => order.id === id) || null;
}

export function saveDemoProduct(input: ProductDraft, productId?: string) {
  const products = rawProducts();
  const current = productId ? products.find((item) => item.id === productId) : undefined;
  if (products.some((item) => item.code.toLowerCase() === input.code.toLowerCase() && item.id !== productId)) {
    throw new Error("Kode produk sudah digunakan.");
  }
  const id = current?.id || crypto.randomUUID();
  const product: Product = syncTotals({
    id,
    ...input,
    image: input.images[0] || current?.image || "/products/cardigan-101.png",
    colors: [],
    sizes: [],
    colorHex: {},
    stock: 0,
    reserved: 0,
    isLive: current?.isLive || false,
    variants: input.variants.map((variant) => ({
      ...variant,
      id: variant.id || crypto.randomUUID(),
      productId: id,
      reserved: current?.variants.find((item) => item.id === variant.id)?.reserved || 0,
    })),
  });
  const next = current ? products.map((item) => (item.id === id ? product : item)) : [product, ...products];
  write(PRODUCT_KEY, next);
  addAudit(current ? "product.updated" : "product.created", "product", id, { code: product.code });
  return product;
}

export function archiveDemoProduct(id: string) {
  const products = rawProducts();
  const product = products.find((item) => item.id === id);
  if (!product) throw new Error("Produk tidak ditemukan.");
  if (product.reserved > 0) throw new Error("Produk masih memiliki stok yang direservasi.");
  product.active = false;
  product.isLive = false;
  write(PRODUCT_KEY, products);
  addAudit("product.archived", "product", id, { code: product.code });
  return product;
}

export function getDemoShippingServices() {
  return read<ShippingService[]>(SHIPPING_KEY, seedShippingServices);
}

export function saveDemoShippingService(input: ShippingServiceDraft) {
  const services = getDemoShippingServices();
  const current = input.id ? services.find((item) => item.id === input.id) : undefined;
  const service: ShippingService = { ...input, id: current?.id || crypto.randomUUID(), source: "manual" };
  write(SHIPPING_KEY, current ? services.map((item) => (item.id === service.id ? service : item)) : [service, ...services]);
  addAudit(current ? "shipping.updated" : "shipping.created", "shipping_service", service.id, { courier: service.courierName, service: service.serviceName });
  return service;
}

export function deleteDemoShippingService(id: string) {
  write(SHIPPING_KEY, getDemoShippingServices().filter((item) => item.id !== id));
  addAudit("shipping.deleted", "shipping_service", id);
}

export function createDemoOrder(input: NewOrderInput) {
  const products = getDemoProducts();
  const product = products.find((item) => item.id === input.productId && item.active);
  const variant = product?.variants.find((item) => item.id === input.variantId && item.active);
  if (!product || !variant || variant.stock - variant.reserved < input.quantity) {
    throw new Error("Stok varian sudah habis atau sedang direservasi pembeli lain.");
  }

  variant.reserved += input.quantity;
  write(PRODUCT_KEY, products.map(syncTotals));

  const now = new Date();
  const session = getActiveDemoSession();
  const order: Order = {
    ...input,
    variantSku: variant.sku,
    color: variant.color,
    size: variant.size,
    id: crypto.randomUUID(),
    orderNumber: makeOrderNumber(input.source),
    status: input.proofName ? "pending_confirmation" : "awaiting_payment",
    subtotal: product.price * input.quantity,
    total: product.price * input.quantity + input.shipping.price,
    createdAt: now.toISOString(),
    reservedUntil: new Date(now.getTime() + 30 * 60_000).toISOString(),
    accessToken: crypto.randomUUID(),
    fulfillmentStatus: "unfulfilled",
    liveSessionId: session?.id,
  };
  write(ORDER_KEY, [order, ...rawOrders()]);
  addAudit("order.created", "order", order.id, { source: order.source, number: order.orderNumber });
  return order;
}

export function updateDemoOrder(id: string, patch: Partial<Order>) {
  const orders = getDemoOrders();
  const index = orders.findIndex((order) => order.id === id);
  if (index < 0) throw new Error("Pesanan tidak ditemukan.");
  orders[index] = { ...orders[index], ...patch };
  write(ORDER_KEY, orders);
  return orders[index];
}

export function sendDemoOverlay(event: Omit<OverlayEvent, "id" | "createdAt">) {
  const fullEvent: OverlayEvent = { ...event, id: crypto.randomUUID(), createdAt: new Date().toISOString(), deliveryCount: 0 };
  write(OVERLAY_KEY, fullEvent);
  return fullEvent;
}

export function confirmDemoOrder(id: string, showInLive = true) {
  const order = getDemoOrder(id);
  if (!order) throw new Error("Pesanan tidak ditemukan.");
  if (["cancelled", "rejected"].includes(order.status)) throw new Error("Pesanan sudah tidak aktif.");
  if (order.status !== "paid") {
    const products = getDemoProducts();
    const product = products.find((item) => item.id === order.productId);
    const variant = product?.variants.find((item) => item.id === order.variantId);
    if (!variant || variant.stock < order.quantity) throw new Error("Stok varian tidak mencukupi.");
    variant.reserved = Math.max(0, variant.reserved - order.quantity);
    variant.stock = Math.max(0, variant.stock - order.quantity);
    write(PRODUCT_KEY, products.map(syncTotals));
  }
  const paid = updateDemoOrder(id, { status: "paid", paidAt: new Date().toISOString() });
  addAudit("payment.confirmed", "order", id, { showInLive });
  if (showInLive) {
    sendDemoOverlay({ type: "purchase", buyerDisplay: maskBuyerName(order.buyerName), productCode: order.productCode, productName: order.productName, productPrice: order.unitPrice, source: order.source, message: "Pembayaran dikonfirmasi", duration: 7, sound: true });
  }
  return paid;
}

function releaseVariant(order: Order) {
  const products = getDemoProducts();
  const variant = products.find((item) => item.id === order.productId)?.variants.find((item) => item.id === order.variantId);
  if (variant) variant.reserved = Math.max(0, variant.reserved - order.quantity);
  write(PRODUCT_KEY, products.map(syncTotals));
}

export function releaseDemoOrder(id: string, rejected = false, reason?: string) {
  const order = getDemoOrder(id);
  if (!order) throw new Error("Pesanan tidak ditemukan.");
  if (!["paid", "cancelled", "rejected"].includes(order.status)) releaseVariant(order);
  const updated = updateDemoOrder(id, { status: rejected ? "rejected" : "cancelled", rejectionReason: reason });
  addAudit(rejected ? "payment.rejected" : "order.cancelled", "order", id, { reason });
  return updated;
}

export function updateDemoFulfillment(id: string, action: "pack" | "ship" | "complete" | "note", payload: Record<string, unknown>) {
  const order = getDemoOrder(id);
  if (!order) throw new Error("Pesanan tidak ditemukan.");
  if (action !== "note" && order.status !== "paid") throw new Error("Pesanan harus dibayar sebelum diproses.");
  const now = new Date().toISOString();
  const patch: Partial<Order> = action === "pack"
    ? { fulfillmentStatus: "packed", packedAt: now }
    : action === "ship"
      ? { fulfillmentStatus: "shipped", shippedAt: now, waybill: String(payload.waybill || ""), trackingUrl: String(payload.trackingUrl || "") }
      : action === "complete"
        ? { fulfillmentStatus: "completed", completedAt: now }
        : { adminNote: String(payload.adminNote || "") };
  const updated = updateDemoOrder(id, patch);
  addAudit(`fulfillment.${action}`, "order", id, payload);
  return updated;
}

export function getLatestDemoOverlay() {
  return read<OverlayEvent | null>(OVERLAY_KEY, null);
}

export function acknowledgeDemoOverlay(id: string) {
  const event = getLatestDemoOverlay();
  if (!event || event.id !== id) return;
  write(OVERLAY_KEY, { ...event, deliveredAt: new Date().toISOString(), deliveryCount: (event.deliveryCount || 0) + 1 });
}

export function setLiveDemoProduct(productId: string) {
  const products = getDemoProducts().map((product) => ({ ...product, isLive: product.id === productId }));
  write(PRODUCT_KEY, products);
  const product = products.find((item) => item.id === productId);
  return product;
}

export function getDemoLiveSessions() {
  const sessions = read<LiveSession[]>(SESSION_KEY, []);
  const orders = rawOrders();
  return sessions.map((session) => {
    const sessionOrders = orders.filter((order) => order.liveSessionId === session.id);
    return { ...session, orderCount: sessionOrders.length, revenue: sessionOrders.filter((order) => order.status === "paid").reduce((sum, order) => sum + order.total, 0) };
  });
}

export function getActiveDemoSession() {
  return getDemoLiveSessions().find((session) => session.status === "active") || null;
}

export function startDemoLiveSession(name: string) {
  const sessions = getDemoLiveSessions().map((session) => session.status === "active" ? { ...session, status: "ended" as const, endedAt: new Date().toISOString() } : session);
  const live: LiveSession = { id: crypto.randomUUID(), name, status: "active", startedAt: new Date().toISOString(), orderCount: 0, revenue: 0 };
  write(SESSION_KEY, [live, ...sessions]);
  addAudit("live.started", "live_session", live.id, { name });
  return live;
}

export function endDemoLiveSession(id: string) {
  const sessions = getDemoLiveSessions().map((session) => session.id === id ? { ...session, status: "ended" as const, endedAt: new Date().toISOString() } : session);
  write(SESSION_KEY, sessions);
  addAudit("live.ended", "live_session", id);
  return sessions.find((session) => session.id === id) || null;
}

export function getDemoAuditLogs() {
  return read<AuditLog[]>(AUDIT_KEY, []);
}

export function subscribeDemoStore(callback: () => void) {
  const keys = [PRODUCT_KEY, ORDER_KEY, SHIPPING_KEY, SESSION_KEY, AUDIT_KEY, OVERLAY_KEY];
  const onStorage = (event: StorageEvent) => { if (keys.includes(event.key || "")) callback(); };
  const onCustom = () => callback();
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT_NAME, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT_NAME, onCustom);
  };
}

export function resetDemoStore() {
  write(PRODUCT_KEY, seedProducts);
  write(ORDER_KEY, seedOrders);
  write(SHIPPING_KEY, seedShippingServices);
  write(SESSION_KEY, []);
  write(AUDIT_KEY, []);
  window.localStorage.removeItem(OVERLAY_KEY);
}
