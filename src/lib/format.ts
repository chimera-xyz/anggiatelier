import type { Order, OrderStatus } from "./types";

export function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function maskBuyerName(name: string) {
  const first = name.trim().split(/\s+/)[0] || "Pembeli";
  return `${first.charAt(0).toUpperCase()}${"*".repeat(Math.max(2, Math.min(first.length - 1, 4)))}`;
}

export function statusLabel(status: OrderStatus) {
  return {
    reserved: "Direservasi",
    awaiting_payment: "Menunggu Pembayaran",
    pending_confirmation: "Menunggu Konfirmasi",
    paid: "Dibayar",
    rejected: "Bukti Ditolak",
    cancelled: "Dibatalkan",
  }[status];
}

export function whatsappOrderTemplate() {
  return `FORMAT ORDER ANGGI ATELIER

Kode Produk:
Warna:
Ukuran:
Jumlah: 1

Nama Penerima:
Nomor WhatsApp:
Alamat Lengkap:
Kecamatan:
Kota/Kabupaten:
Provinsi:
Kode Pos:
Pilihan Kurir:
Catatan:`;
}

export function whatsappInvoiceTemplate(order: Order) {
  return `Halo Kak ${order.buyerName}, pesanan Anggi Atelier sudah dicatat.

No. Order: ${order.orderNumber}
Produk: ${order.productName} (Kode ${order.productCode})
Varian: ${order.color} / ${order.size}
Harga: ${formatRupiah(order.subtotal)}
Ongkir ${order.shipping.courier} ${order.shipping.service}: ${formatRupiah(order.shipping.price)}
Total: ${formatRupiah(order.total)}

Silakan transfer ke rekening/QRIS yang dikirim admin.
Setelah transfer, kirim bukti pembayaran di chat ini ya, Kak.
Stok sementara kami reservasi sampai ${new Date(order.reservedUntil).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}.`;
}
