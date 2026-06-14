export type OrderSource = "website" | "whatsapp";
export type OrderStatus =
  | "reserved"
  | "awaiting_payment"
  | "pending_confirmation"
  | "paid"
  | "rejected"
  | "cancelled";

export type PaymentMethod = "bank_transfer" | "qris";

export type FulfillmentStatus = "unfulfilled" | "packed" | "shipped" | "completed";

export type ProductVariant = {
  id: string;
  productId: string;
  sku: string;
  color: string;
  colorHex: string;
  size: string;
  stock: number;
  reserved: number;
  active: boolean;
};

export type Product = {
  id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  image: string;
  images: string[];
  colors: string[];
  colorHex: Record<string, string>;
  sizes: string[];
  stock: number;
  reserved: number;
  isLive: boolean;
  active: boolean;
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  variants: ProductVariant[];
};

export type ShippingOption = {
  id: string;
  courier: string;
  service: string;
  price: number;
  eta: string;
  token?: string;
};

export type ShippingService = {
  id: string;
  courierCode: string;
  courierName: string;
  serviceCode: string;
  serviceName: string;
  flatPrice: number;
  eta: string;
  enabled: boolean;
  source: "manual" | "biteship";
};

export type Address = {
  line: string;
  province: string;
  city: string;
  district: string;
  postalCode: string;
};

export type Order = {
  id: string;
  orderNumber: string;
  source: OrderSource;
  status: OrderStatus;
  productId: string;
  variantId: string;
  variantSku: string;
  productCode: string;
  productName: string;
  productImage: string;
  unitPrice: number;
  quantity: number;
  color: string;
  size: string;
  buyerName: string;
  whatsapp: string;
  address: Address;
  shipping: ShippingOption;
  paymentMethod: PaymentMethod;
  proofName?: string;
  subtotal: number;
  total: number;
  createdAt: string;
  reservedUntil: string;
  paidAt?: string;
  accessToken?: string;
  fulfillmentStatus: FulfillmentStatus;
  adminNote?: string;
  rejectionReason?: string;
  waybill?: string;
  trackingUrl?: string;
  packedAt?: string;
  shippedAt?: string;
  completedAt?: string;
  liveSessionId?: string;
};

export type NewOrderInput = Omit<
  Order,
  | "id"
  | "orderNumber"
  | "status"
  | "variantSku"
  | "subtotal"
  | "total"
  | "createdAt"
  | "reservedUntil"
  | "paidAt"
  | "accessToken"
  | "fulfillmentStatus"
  | "adminNote"
  | "rejectionReason"
  | "waybill"
  | "trackingUrl"
  | "packedAt"
  | "shippedAt"
  | "completedAt"
  | "liveSessionId"
>;

export type OverlayEvent = {
  id: string;
  type: "purchase" | "product";
  buyerDisplay?: string;
  productCode: string;
  productName: string;
  productPrice: number;
  source?: OrderSource;
  message: string;
  duration: number;
  sound: boolean;
  createdAt: string;
  deliveredAt?: string;
  deliveryCount?: number;
};

export type ProductDraft = {
  code: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  active: boolean;
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  variants: Array<Omit<ProductVariant, "id" | "productId" | "reserved"> & { id?: string }>;
};

export type ShippingServiceDraft = Omit<ShippingService, "id" | "source"> & { id?: string };

export type LiveSession = {
  id: string;
  name: string;
  status: "active" | "ended";
  startedAt: string;
  endedAt?: string;
  orderCount: number;
  revenue: number;
};

export type OverlayHealth = {
  connected: boolean;
  lastSeen?: string;
  clientCount: number;
  latestEvent?: OverlayEvent;
  streamUrl: string;
};

export type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  details: Record<string, unknown>;
  createdAt: string;
};
