import { z } from "zod";

export const addressSchema = z.object({
  line: z.string().min(8).max(300),
  province: z.string().min(2).max(100),
  city: z.string().min(2).max(100),
  district: z.string().min(2).max(100),
  postalCode: z.string().regex(/^\d{5}$/),
});

export const shippingSchema = z.object({
  id: z.string().min(2),
  courier: z.string().min(2).max(30),
  service: z.string().min(1).max(50),
  price: z.number().int().min(0).max(2_000_000),
  eta: z.string().min(2).max(100),
  token: z.string().min(20).optional(),
});

export const newOrderSchema = z.object({
  source: z.enum(["website", "whatsapp"]),
  productId: z.string().uuid().or(z.string().startsWith("prod-")),
  variantId: z.string().uuid().or(z.string().startsWith("var-")),
  productCode: z.string().min(1).max(20),
  productName: z.string().min(2).max(200),
  productImage: z.string().min(1).max(500),
  unitPrice: z.number().int().min(1),
  quantity: z.number().int().min(1).max(10),
  color: z.string().min(1).max(80),
  size: z.string().min(1).max(20),
  buyerName: z.string().min(2).max(120),
  whatsapp: z.string().min(8).max(30),
  address: addressSchema,
  shipping: shippingSchema,
  paymentMethod: z.enum(["bank_transfer", "qris"]),
  proofName: z.string().max(255).optional(),
});

const productVariantSchema = z.object({
  id: z.string().optional(),
  sku: z.string().trim().min(2).max(80),
  color: z.string().trim().min(1).max(80),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  size: z.string().trim().min(1).max(30),
  stock: z.number().int().min(0).max(100_000),
  active: z.boolean(),
});

export const productSchema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2_000),
  price: z.number().int().min(1).max(1_000_000_000),
  images: z.array(z.string().min(1).max(1_000)).min(1).max(8),
  active: z.boolean(),
  weightGrams: z.number().int().min(1).max(100_000),
  lengthCm: z.number().int().min(1).max(500),
  widthCm: z.number().int().min(1).max(500),
  heightCm: z.number().int().min(1).max(500),
  variants: z.array(productVariantSchema).min(1).max(200),
});

export const shippingServiceSchema = z.object({
  id: z.string().optional(),
  courierCode: z.string().trim().min(2).max(30).transform((value) => value.toLowerCase()),
  courierName: z.string().trim().min(2).max(80),
  serviceCode: z.string().trim().min(1).max(30).transform((value) => value.toLowerCase()),
  serviceName: z.string().trim().min(1).max(80),
  flatPrice: z.number().int().min(0).max(2_000_000),
  eta: z.string().trim().min(2).max(100),
  enabled: z.boolean(),
});

export const orderActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm"), showInLive: z.boolean().optional() }),
  z.object({ action: z.literal("release") }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(2).max(300) }),
  z.object({ action: z.literal("pack") }),
  z.object({ action: z.literal("ship"), waybill: z.string().trim().min(3).max(100), trackingUrl: z.string().url().max(500).optional().or(z.literal("")) }),
  z.object({ action: z.literal("complete") }),
  z.object({ action: z.literal("note"), adminNote: z.string().trim().max(1_000) }),
]);

export const overlaySchema = z.object({
  type: z.enum(["purchase", "product"]),
  buyerDisplay: z.string().max(80).optional(),
  productCode: z.string().min(1).max(20),
  productName: z.string().min(2).max(200),
  productPrice: z.number().int().min(0),
  source: z.enum(["website", "whatsapp"]).optional(),
  message: z.string().min(2).max(200),
  duration: z.number().int().min(3).max(30),
  sound: z.boolean(),
});
