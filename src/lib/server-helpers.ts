import { NextRequest } from "next/server";
import { isAdminRequest } from "./admin-auth";
import type { AuditLog, LiveSession, Order, PaymentMethodConfig, Product, ProductVariant, ShippingService } from "./types";

export function verifyAdmin(request: NextRequest) {
  return isAdminRequest(request);
}

export function mapVariant(row: Record<string, unknown>): ProductVariant {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    sku: String(row.sku),
    color: String(row.color),
    colorHex: String(row.color_hex || "#8a2949"),
    size: String(row.size),
    stock: Number(row.stock_quantity),
    reserved: Number(row.reserved_quantity),
    active: Boolean(row.active),
  };
}

export function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    description: String(row.description || ""),
    price: Number(row.price),
    image: String(row.image_url),
    images: Array.isArray(row.images) && row.images.length ? row.images as string[] : [String(row.image_url)],
    colors: row.colors as string[],
    colorHex: row.color_hex as Record<string, string>,
    sizes: row.sizes as string[],
    stock: Number(row.stock_quantity),
    reserved: Number(row.reserved_quantity),
    isLive: Boolean(row.is_live),
    active: row.active === undefined ? true : Boolean(row.active),
    weightGrams: Number(row.weight_grams || 500),
    lengthCm: Number(row.length_cm || 20),
    widthCm: Number(row.width_cm || 20),
    heightCm: Number(row.height_cm || 5),
    variants: Array.isArray(row.product_variants) ? (row.product_variants as Record<string, unknown>[]).map(mapVariant) : [],
  };
}

export function mapOrder(row: Record<string, unknown>): Order {
  const product = (row.products || {}) as Record<string, unknown>;
  return {
    id: String(row.id),
    orderNumber: String(row.order_number),
    source: row.source as Order["source"],
    status: row.status as Order["status"],
    productId: String(row.product_id),
    variantId: String(row.variant_id || ""),
    variantSku: String(row.variant_sku || ""),
    productCode: String(row.product_code || product.code),
    productName: String(row.product_name || product.name),
    productImage: String(row.product_image || product.image_url),
    unitPrice: Number(row.unit_price),
    quantity: Number(row.quantity),
    color: String(row.color),
    size: String(row.size),
    buyerName: String(row.buyer_name),
    whatsapp: String(row.whatsapp),
    address: row.address as Order["address"],
    shipping: row.shipping as Order["shipping"],
    paymentMethod: row.payment_method as Order["paymentMethod"],
    paymentMethodId: row.payment_method_id ? String(row.payment_method_id) : undefined,
    paymentDetails: row.payment_details as Order["paymentDetails"],
    proofName: row.proof_name ? String(row.proof_name) : undefined,
    subtotal: Number(row.subtotal),
    total: Number(row.total),
    createdAt: String(row.created_at),
    reservedUntil: String(row.reserved_until),
    paidAt: row.paid_at ? String(row.paid_at) : undefined,
    accessToken: row.public_token ? String(row.public_token) : undefined,
    fulfillmentStatus: (row.fulfillment_status || "unfulfilled") as Order["fulfillmentStatus"],
    adminNote: row.admin_note ? String(row.admin_note) : undefined,
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : undefined,
    waybill: row.waybill ? String(row.waybill) : undefined,
    trackingUrl: row.tracking_url ? String(row.tracking_url) : undefined,
    packedAt: row.packed_at ? String(row.packed_at) : undefined,
    shippedAt: row.shipped_at ? String(row.shipped_at) : undefined,
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
    liveSessionId: row.live_session_id ? String(row.live_session_id) : undefined,
  };
}

export function mapPaymentMethod(row: Record<string, unknown>): PaymentMethodConfig {
  return {
    id: String(row.id),
    type: row.type as PaymentMethodConfig["type"],
    name: String(row.name),
    bankCode: row.bank_code ? String(row.bank_code) : undefined,
    accountNumber: row.account_number ? String(row.account_number) : undefined,
    accountHolder: row.account_holder ? String(row.account_holder) : undefined,
    qrisPayload: row.qris_payload ? String(row.qris_payload) : undefined,
    instructions: row.instructions ? String(row.instructions) : undefined,
    enabled: Boolean(row.enabled),
    sortOrder: Number(row.sort_order || 0),
  };
}

export function mapShippingService(row: Record<string, unknown>): ShippingService {
  return {
    id: String(row.id),
    courierCode: String(row.courier_code),
    courierName: String(row.courier_name),
    serviceCode: String(row.service_code),
    serviceName: String(row.service_name),
    flatPrice: Number(row.flat_price),
    eta: String(row.eta),
    enabled: Boolean(row.enabled),
    source: row.source as ShippingService["source"],
  };
}

export function mapLiveSession(row: Record<string, unknown>): LiveSession {
  return {
    id: String(row.id),
    name: String(row.name),
    status: row.status as LiveSession["status"],
    startedAt: String(row.started_at),
    endedAt: row.ended_at ? String(row.ended_at) : undefined,
    orderCount: Number(row.order_count || 0),
    revenue: Number(row.revenue || 0),
  };
}

export function mapAuditLog(row: Record<string, unknown>): AuditLog {
  return {
    id: String(row.id),
    action: String(row.action),
    entityType: String(row.entity_type),
    entityId: row.entity_id ? String(row.entity_id) : undefined,
    details: (row.details || {}) as Record<string, unknown>,
    createdAt: String(row.created_at),
  };
}
