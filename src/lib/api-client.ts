"use client";

import { demoAdminPin, isHostedDemoBrowser, isSupabaseConfigured } from "./config";
import {
  archiveDemoProduct,
  confirmDemoOrder,
  createDemoOrder,
  deleteDemoPaymentMethod,
  deleteDemoShippingService,
  endDemoLiveSession,
  getActiveDemoSession,
  getDemoAuditLogs,
  getDemoLiveSessions,
  getDemoOrder,
  getDemoOrders,
  getDemoPaymentMethods,
  getDemoProducts,
  getDemoShippingServices,
  releaseDemoOrder,
  saveDemoPaymentMethod,
  saveDemoProduct,
  saveDemoShippingService,
  setLiveDemoProduct,
  startDemoLiveSession,
  updateDemoFulfillment,
  updateDemoOrder,
} from "./demo-store";
import type {
  AuditLog,
  LiveSession,
  NewOrderInput,
  Order,
  OverlayEvent,
  OverlayHealth,
  PaymentMethodConfig,
  PaymentMethodDraft,
  Product,
  ProductDraft,
  ShippingOption,
  ShippingService,
  ShippingServiceDraft,
} from "./types";
import { maskBuyerName } from "./format";

async function json<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Terjadi kesalahan pada server.");
  return body as T;
}

export async function adminSession() {
  const result = await json<{ authenticated: boolean }>(await fetch("/api/admin/session", { cache: "no-store" }));
  if (result.authenticated || isSupabaseConfigured || window.sessionStorage.getItem("anggi-demo-admin") !== "yes") return result.authenticated;
  await json(await fetch("/api/admin/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin: demoAdminPin }) }));
  return true;
}

export async function loginAdmin(pin: string) {
  await json(await fetch("/api/admin/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin }) }));
  if (!isSupabaseConfigured) window.sessionStorage.setItem("anggi-demo-admin", "yes");
  return true;
}

export async function logoutAdmin() {
  if (!isSupabaseConfigured) window.sessionStorage.removeItem("anggi-demo-admin");
  await fetch("/api/admin/session", { method: "DELETE" });
}

export async function listProducts(all = false): Promise<Product[]> {
  if (isHostedDemoBrowser()) return json(await fetch(`/api/products${all ? "?all=1" : ""}`, { cache: "no-store" }));
  if (!isSupabaseConfigured) return getDemoProducts().filter((product) => all || product.active);
  return json(await fetch(`/api/products${all ? "?all=1" : ""}`, { cache: "no-store" }));
}

export async function saveProduct(input: ProductDraft, id?: string): Promise<Product> {
  if (!isSupabaseConfigured) return saveDemoProduct(input, id);
  return json(await fetch(id ? `/api/products/${id}` : "/api/products", { method: id ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }));
}

export async function archiveProduct(id: string): Promise<unknown> {
  if (!isSupabaseConfigured) return archiveDemoProduct(id);
  return json(await fetch(`/api/products/${id}`, { method: "DELETE" }));
}

export async function uploadProductImage(file: File) {
  if (!isSupabaseConfigured) return URL.createObjectURL(file);
  const form = new FormData();
  form.set("file", file);
  return (await json<{ url: string }>(await fetch("/api/products/image", { method: "POST", body: form }))).url;
}

export async function listShippingServices(): Promise<ShippingService[]> {
  if (!isSupabaseConfigured) return getDemoShippingServices();
  return json(await fetch("/api/shipping/services?all=1", { cache: "no-store" }));
}

export async function saveShippingService(input: ShippingServiceDraft): Promise<ShippingService> {
  if (!isSupabaseConfigured) return saveDemoShippingService(input);
  return json(await fetch(input.id ? `/api/shipping/services/${input.id}` : "/api/shipping/services", { method: input.id ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }));
}

export async function deleteShippingService(id: string) {
  if (!isSupabaseConfigured) return deleteDemoShippingService(id);
  await json(await fetch(`/api/shipping/services/${id}`, { method: "DELETE" }));
}

export async function listPaymentMethods(all = false): Promise<PaymentMethodConfig[]> {
  if (!isSupabaseConfigured) return getDemoPaymentMethods(all);
  return json(await fetch(`/api/payments${all ? "?all=1" : ""}`, { cache: "no-store" }));
}

export async function savePaymentMethod(input: PaymentMethodDraft): Promise<PaymentMethodConfig> {
  if (!isSupabaseConfigured) return saveDemoPaymentMethod(input);
  return json(await fetch(input.id ? `/api/payments/${input.id}` : "/api/payments", { method: input.id ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }));
}

export async function deletePaymentMethod(id: string) {
  if (!isSupabaseConfigured) return deleteDemoPaymentMethod(id);
  await json(await fetch(`/api/payments/${id}`, { method: "DELETE" }));
}

export async function getShippingRates(productId: string, postalCode: string): Promise<{ source: string; rates: ShippingOption[] }> {
  if (!isSupabaseConfigured) {
    return { source: "estimate", rates: getDemoShippingServices().filter((service) => service.enabled).map((service) => ({ id: `manual:${service.id}`, courier: service.courierName, service: service.serviceName, price: service.flatPrice, eta: service.eta, token: `demo-${service.id}-${productId}-${postalCode}` })) };
  }
  return json(await fetch("/api/shipping/rates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId, postalCode }) }));
}

export async function listOrders(): Promise<Order[]> {
  if (!isSupabaseConfigured) return getDemoOrders();
  return json(await fetch("/api/orders", { cache: "no-store" }));
}

export async function getOrder(id: string, accessToken?: string): Promise<Order | null> {
  if (!isSupabaseConfigured) return getDemoOrder(id);
  const query = accessToken ? `?token=${encodeURIComponent(accessToken)}` : "";
  return json(await fetch(`/api/orders/${id}${query}`, { cache: "no-store" }));
}

export async function createOrder(input: NewOrderInput): Promise<Order> {
  if (!isSupabaseConfigured) return createDemoOrder(input);
  return json(await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }));
}

export type OrderAction = "confirm" | "release" | "reject" | "pack" | "ship" | "complete" | "note";
export async function updateOrder(id: string, action: OrderAction, payload: Record<string, unknown> = {}) {
  if (!isSupabaseConfigured) {
    if (action === "confirm") {
      const showInLive = payload.showInLive !== false;
      const paid = confirmDemoOrder(id, false);
      if (showInLive) {
        await publishOverlay({ type: "purchase", buyerDisplay: maskBuyerName(paid.buyerName), productCode: paid.productCode, productName: paid.productName, productPrice: paid.unitPrice, source: paid.source, message: "Pembayaran dikonfirmasi", duration: 7, sound: true });
      }
      return paid;
    }
    if (action === "release") return releaseDemoOrder(id);
    if (action === "reject") return releaseDemoOrder(id, true, String(payload.reason || "Bukti pembayaran ditolak."));
    if (["pack", "ship", "complete", "note"].includes(action)) return updateDemoFulfillment(id, action as "pack" | "ship" | "complete" | "note", payload);
    return updateDemoOrder(id, payload);
  }
  return json<Order>(await fetch(`/api/orders/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...payload }) }));
}

export async function uploadPaymentProof(order: Order, file: File) {
  if (!isSupabaseConfigured) return updateDemoOrder(order.id, { proofName: file.name, status: "pending_confirmation" });
  const formData = new FormData();
  formData.set("file", file);
  formData.set("accessToken", order.accessToken || "");
  return json<Order>(await fetch(`/api/orders/${order.id}/proof`, { method: "POST", body: formData }));
}

export async function getPaymentProofUrl(orderId: string) {
  if (!isSupabaseConfigured) return null;
  return (await json<{ url: string }>(await fetch(`/api/orders/${orderId}/proof`, { cache: "no-store" }))).url;
}

export async function publishOverlay(event: Omit<OverlayEvent, "id" | "createdAt">) {
  return json<OverlayEvent>(await fetch("/api/overlay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(event) }));
}

export async function setLiveProduct(productId: string) {
  if (isHostedDemoBrowser()) {
    return json<Product>(await fetch("/api/products/live", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId }) }));
  }
  if (!isSupabaseConfigured) {
    const product = setLiveDemoProduct(productId);
    if (product) await publishOverlay({ type: "product", productCode: product.code, productName: product.name, productPrice: product.price, message: "Order via link bio atau WhatsApp", duration: 10, sound: false });
    return product;
  }
  return json<Product>(await fetch("/api/products/live", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId }) }));
}

export async function getOverlayHealth(): Promise<OverlayHealth> {
  return json(await fetch("/api/overlay/health", { cache: "no-store" }));
}

export async function listLiveSessions(): Promise<LiveSession[]> {
  if (!isSupabaseConfigured) return getDemoLiveSessions();
  return json(await fetch("/api/live/session", { cache: "no-store" }));
}

export async function startLiveSession(name: string): Promise<LiveSession> {
  if (!isSupabaseConfigured) return startDemoLiveSession(name);
  return json(await fetch("/api/live/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) }));
}

export async function endLiveSession(id: string): Promise<LiveSession | null> {
  if (!isSupabaseConfigured) return endDemoLiveSession(id);
  return json(await fetch("/api/live/session", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }));
}

export function activeDemoSession() { return isSupabaseConfigured ? null : getActiveDemoSession(); }

export async function listAuditLogs(): Promise<AuditLog[]> {
  if (!isSupabaseConfigured) return getDemoAuditLogs();
  return json(await fetch("/api/audit", { cache: "no-store" }));
}
