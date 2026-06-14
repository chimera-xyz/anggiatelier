import { defaultQrisStaticPayload } from "./qris";
import type { PaymentDetails, PaymentMethod, PaymentMethodConfig } from "./types";

const holder = process.env.NEXT_PUBLIC_BANK_HOLDER || "ANGGI ATELIER";
const bcaAccount = process.env.NEXT_PUBLIC_BANK_ACCOUNT?.trim() || "";

export const defaultPaymentMethods: PaymentMethodConfig[] = [
  {
    id: "pay-bca",
    type: "bank_transfer",
    name: "BCA",
    bankCode: "bca",
    accountNumber: bcaAccount,
    accountHolder: holder,
    instructions: "Transfer sesuai total order, lalu kirim bukti pembayaran.",
    enabled: Boolean(bcaAccount),
    sortOrder: 10,
  },
  {
    id: "pay-blu-bca",
    type: "bank_transfer",
    name: "Blu BCA Digital",
    bankCode: "blu-bca",
    accountNumber: "",
    accountHolder: holder,
    instructions: "Isi nomor rekening dari menu Payment sebelum live.",
    enabled: false,
    sortOrder: 20,
  },
  {
    id: "pay-seabank",
    type: "bank_transfer",
    name: "SeaBank",
    bankCode: "seabank",
    accountNumber: "",
    accountHolder: holder,
    instructions: "Isi nomor rekening dari menu Payment sebelum live.",
    enabled: false,
    sortOrder: 30,
  },
  {
    id: "pay-qris",
    type: "qris",
    name: "QRIS Dinamis",
    qrisPayload: defaultQrisStaticPayload,
    instructions: "QRIS otomatis mengikuti total produk dan ongkir.",
    enabled: true,
    sortOrder: 40,
  },
];

export function paymentDetailsFromConfig(method: PaymentMethodConfig): PaymentDetails {
  return {
    methodId: method.id,
    type: method.type,
    name: method.name,
    bankCode: method.bankCode,
    accountNumber: method.accountNumber,
    accountHolder: method.accountHolder,
    qrisPayload: method.qrisPayload,
    instructions: method.instructions,
  };
}

export function fallbackPaymentMethod(type: PaymentMethod): PaymentMethodConfig {
  return defaultPaymentMethods.find((method) => method.type === type && method.enabled) || defaultPaymentMethods[0]!;
}
