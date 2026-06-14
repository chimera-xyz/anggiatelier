"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  FileCheck2,
  LoaderCircle,
  MapPin,
  MessageCircle,
  PackageCheck,
  ShieldCheck,
  Truck,
  UploadCloud,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { PaymentLogo } from "@/components/payment-logo";
import { QrisCode } from "@/components/qris-code";
import { Toast } from "@/components/toast";
import { bankAccount, adminWhatsApp } from "@/lib/config";
import { createOrder, getOrder, getShippingRates, listPaymentMethods, listProducts, uploadPaymentProof } from "@/lib/api-client";
import { formatRupiah, whatsappInvoiceTemplate } from "@/lib/format";
import { defaultPaymentMethods, paymentDetailsFromConfig } from "@/lib/payments";
import { formatPaymentDeadline, paymentWindowMinutes } from "@/lib/order-policy";
import { generateDynamicQrisPayload } from "@/lib/qris";
import type { Order, PaymentDetails, PaymentMethodConfig, Product, ShippingOption } from "@/lib/types";

type Props = { initialCode: string; initialColor?: string; initialSize?: string };

const initialForm = {
  buyerName: "",
  whatsapp: "",
  line: "",
  province: "",
  city: "",
  district: "",
  postalCode: "",
};

export function CheckoutClient({ initialCode, initialColor, initialSize }: Props) {
  const [product, setProduct] = useState<Product | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState("");
  const [form, setForm] = useState(initialForm);
  const [shipping, setShipping] = useState<ShippingOption[]>([]);
  const [shippingSource, setShippingSource] = useState("estimate");
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [proofUploading, setProofUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    Promise.all([listProducts(), listPaymentMethods()])
      .then(([items, methods]) => {
        setProduct(items.find((item) => item.code === initialCode) || items[0] || null);
        const activeMethods = methods.length ? methods : defaultPaymentMethods.filter((method) => method.enabled);
        setPaymentMethods(activeMethods);
        setSelectedPaymentId((current) => current || activeMethods[0]?.id || "");
      })
      .catch(() => {
        const fallback = defaultPaymentMethods.filter((method) => method.enabled);
        setPaymentMethods(fallback);
        setSelectedPaymentId((current) => current || fallback[0]?.id || "");
      });
  }, [initialCode]);

  useEffect(() => {
    if (!/^\d{5}$/.test(form.postalCode) || !product) return;
    const timer = window.setTimeout(async () => {
      try {
        setShippingLoading(true);
        const data = await getShippingRates(product.id, form.postalCode);
        setShipping(data.rates);
        setSelectedShipping(data.rates[0] || null);
        setShippingSource(data.source);
      } catch {
        setShipping([]);
        setSelectedShipping(null);
      } finally {
        setShippingLoading(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [form.postalCode, product]);

  const requestedVariant = product?.variants.find((item) => item.active && item.color === initialColor && item.size === initialSize);
  const activeVariants = product?.variants.filter((item) => item.active && item.stock - item.reserved > 0) || [];
  const variant = requestedVariant && requestedVariant.stock - requestedVariant.reserved > 0 ? requestedVariant : activeVariants[0];
  const variantUnavailable = Boolean(requestedVariant && requestedVariant.id !== variant?.id);
  const color = variant?.color || "";
  const size = variant?.size || "";
  const total = (product?.price || 0) + (selectedShipping?.price || 0);
  const selectedPayment = paymentMethods.find((method) => method.id === selectedPaymentId) || paymentMethods[0];
  const qrisPayload = useMemo(() => {
    if (selectedPayment?.type !== "qris" || !selectedPayment.qrisPayload || total <= 0) return "";
    try {
      return generateDynamicQrisPayload(selectedPayment.qrisPayload, total);
    } catch {
      return "";
    }
  }, [selectedPayment, total]);

  useEffect(() => {
    if (!order?.accessToken || !["awaiting_payment", "pending_confirmation"].includes(order.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const next = await getOrder(order.id, order.accessToken);
        if (next) setOrder((current) => current ? { ...current, ...next, accessToken: current.accessToken } : next);
      } catch {
        // Keep the success screen usable when polling briefly fails.
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [order?.accessToken, order?.id, order?.status]);

  function updateField(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!product || !variant || !selectedShipping || !selectedPayment || !agreed) return;
    setSubmitting(true);
    try {
      const created = await createOrder({
        source: "website",
        productId: product.id,
        variantId: variant.id,
        productCode: product.code,
        productName: product.name,
        productImage: product.image,
        unitPrice: product.price,
        quantity: 1,
        color,
        size,
        buyerName: form.buyerName,
        whatsapp: form.whatsapp,
        address: {
          line: form.line,
          province: form.province,
          city: form.city,
          district: form.district,
          postalCode: form.postalCode,
        },
        shipping: selectedShipping,
        paymentMethod: selectedPayment.type,
        paymentMethodId: selectedPayment.id,
        paymentDetails: paymentDetailsFromConfig(selectedPayment),
      });
      setOrder(created);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Pesanan gagal dibuat.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadProof(file?: File) {
    if (!file || !order) return;
    setProofUploading(true);
    try {
      const updated = await uploadPaymentProof(order, file);
      setOrder(updated);
      setToast({ message: "Bukti pembayaran diterima. Admin akan segera memeriksanya.", type: "success" });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Bukti gagal diunggah.", type: "error" });
    } finally {
      setProofUploading(false);
    }
  }

  const invoiceLink = useMemo(() => {
    if (!order) return "#";
    return `https://wa.me/${adminWhatsApp}?text=${encodeURIComponent(`${whatsappInvoiceTemplate(order)}\n\nSaya ingin mengirim bukti pembayaran untuk pesanan ini.`)}`;
  }, [order]);

  if (!product) {
    return <main className="grid min-h-screen place-items-center bg-[#fffaf6]"><LoaderCircle className="size-7 animate-spin text-[#8a2949]" /></main>;
  }

  if (order) {
    return <OrderSuccess order={order} proofUploading={proofUploading} uploadProof={uploadProof} invoiceLink={invoiceLink} />;
  }

  return (
    <main className="min-h-screen bg-[#fffaf6] paper-noise">
      <header className="border-b border-[#eadedd] bg-white/90 px-4 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Brand compact />
          <Link href="/shop" className="ghost-button"><ArrowLeft className="size-4" /> Kembali ke LIVE</Link>
        </div>
      </header>

      <form onSubmit={submit} className="mx-auto grid max-w-6xl gap-7 px-4 py-8 sm:px-8 lg:grid-cols-[.76fr_1.24fr] lg:py-12">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="surface overflow-hidden">
            <div className="relative aspect-[4/4.5] bg-[#f0e5de]"><Image src={product.image} alt={product.name} fill loading="eager" sizes="(max-width: 1024px) 100vw, 38vw" className="object-cover" /></div>
            <div className="p-6">
              <span className="text-xs font-extrabold tracking-[0.14em] text-[#a33c5b]">KODE {product.code}</span>
              <h1 className="mt-2 font-display text-3xl font-semibold">{product.name}</h1>
              <p className="mt-2 text-sm text-[#756a6e]">{variant ? `${color} / ${size} · SKU ${variant.sku}` : "Varian tersedia belum dipilih"}</p>
              <p className="mt-5 font-display text-3xl font-semibold text-[#9c2347]">{formatRupiah(product.price)}</p>
              {variantUnavailable ? <div className="mt-5 rounded-xl bg-[#fff6f7] px-3 py-2 text-xs font-bold text-[#9a3451]">Varian dari link sudah habis, sistem memilih varian tersedia.</div> : <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#eef8f2] px-3 py-2 text-xs font-bold text-[#218457]"><Check className="size-4" /> Stok direservasi setelah pesanan dibuat</div>}
            </div>
          </div>
        </aside>

        <div className="space-y-6">
          <section className="surface p-5 sm:p-7">
            <div className="flex items-center gap-3"><MapPin className="size-5 text-[#a33c5b]" /><h2 className="font-display text-3xl font-semibold">Data pengiriman</h2></div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Nama lengkap"><input required className="input-shell" value={form.buyerName} onChange={(e) => updateField("buyerName", e.target.value)} placeholder="Nama penerima" /></Field>
              <Field label="Nomor WhatsApp"><input required className="input-shell" value={form.whatsapp} onChange={(e) => updateField("whatsapp", e.target.value)} placeholder="08xxxxxxxxxx" inputMode="tel" /></Field>
              <div className="sm:col-span-2"><Field label="Alamat lengkap"><textarea required className="input-shell" value={form.line} onChange={(e) => updateField("line", e.target.value)} placeholder="Nama jalan, nomor rumah, RT/RW, patokan" /></Field></div>
              <Field label="Provinsi"><input required className="input-shell" value={form.province} onChange={(e) => updateField("province", e.target.value)} placeholder="Jawa Barat" /></Field>
              <Field label="Kota / Kabupaten"><input required className="input-shell" value={form.city} onChange={(e) => updateField("city", e.target.value)} placeholder="Bandung" /></Field>
              <Field label="Kecamatan"><input required className="input-shell" value={form.district} onChange={(e) => updateField("district", e.target.value)} placeholder="Cicendo" /></Field>
              <Field label="Kode pos"><input required className="input-shell" value={form.postalCode} onChange={(e) => updateField("postalCode", e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="40172" inputMode="numeric" pattern="\d{5}" /></Field>
            </div>
          </section>

          <section className="surface p-5 sm:p-7">
            <div className="flex items-center gap-3"><Truck className="size-5 text-[#a33c5b]" /><div><h2 className="font-display text-3xl font-semibold">Pilih kurir</h2><p className="mt-1 text-xs text-[#756a6e]">{shippingSource === "biteship" ? "Tarif langsung dari agregator kurir" : "Tarif layanan yang diatur admin"}</p></div></div>
            <div className="mt-5 grid gap-3">
              {shippingLoading ? <div className="flex items-center gap-2 rounded-2xl border border-[#eadedd] p-4 text-sm text-[#756a6e]"><LoaderCircle className="size-4 animate-spin" /> Menghitung ongkir...</div> : null}
              {!shippingLoading && /^\d{5}$/.test(form.postalCode) && !shipping.length ? <p className="rounded-2xl border border-[#efc7cc] bg-[#fff6f7] p-4 text-sm text-[#9a3451]">Ongkir belum tersedia untuk kode pos ini. Hubungi admin lewat WhatsApp.</p> : null}
              {shipping.map((option) => (
                <label key={option.id} className={`flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition ${selectedShipping?.id === option.id ? "border-[#d65376] bg-[#fff5f7]" : "border-[#eadedd] bg-white hover:border-[#d7b7bf]"}`}>
                  <input type="radio" name="shipping" checked={selectedShipping?.id === option.id} onChange={() => setSelectedShipping(option)} className="size-4 accent-[#9c2347]" />
                  <div className="flex-1"><strong className="text-sm">{option.courier} {option.service}</strong><p className="mt-1 text-xs text-[#756a6e]">Estimasi {option.eta}</p></div>
                  <strong className="text-sm text-[#a33c5b]">{formatRupiah(option.price)}</strong>
                </label>
              ))}
            </div>
          </section>

          <section className="surface p-5 sm:p-7">
            <div className="flex items-center gap-3"><Banknote className="size-5 text-[#a33c5b]" /><div><h2 className="font-display text-3xl font-semibold">Pembayaran manual</h2><p className="mt-1 text-xs text-[#756a6e]">Admin mengonfirmasi setelah bukti diperiksa.</p></div></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {paymentMethods.map((method) => (
                <PaymentChoice
                  key={method.id}
                  active={selectedPayment?.id === method.id}
                  onClick={() => setSelectedPaymentId(method.id)}
                  method={method}
                />
              ))}
              {!paymentMethods.length ? <p className="rounded-2xl border border-[#efc7cc] bg-[#fff6f7] p-4 text-sm text-[#9a3451] sm:col-span-2">Metode pembayaran belum tersedia.</p> : null}
            </div>
            {selectedPayment ? <PaymentInformation method={selectedPayment} total={total} qrisPayload={qrisPayload} ready={Boolean(selectedShipping)} /> : null}
          </section>

          <section className="surface p-5 sm:p-7">
            <h2 className="font-display text-3xl font-semibold">Rincian pembayaran</h2>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between text-[#756a6e]"><span>Subtotal (1 produk)</span><span>{formatRupiah(product.price)}</span></div>
              <div className="flex justify-between text-[#756a6e]"><span>Ongkos kirim</span><span>{selectedShipping ? formatRupiah(selectedShipping.price) : "Belum dipilih"}</span></div>
              <div className="flex items-end justify-between border-t border-[#eadedd] pt-4"><span className="font-bold">Total pembayaran</span><span className="font-display text-3xl font-semibold text-[#a02249]">{formatRupiah(total)}</span></div>
            </div>
            <label className="mt-6 flex cursor-pointer items-start gap-3 text-xs leading-5 text-[#756a6e]"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-4 accent-[#9c2347]" /> Saya menyetujui data pesanan dan memahami bahwa stok baru terjual setelah pembayaran dikonfirmasi admin.</label>
            <button type="submit" disabled={!agreed || !selectedShipping || !selectedPayment || !variant || submitting} className="primary-button mt-6 min-h-[56px] w-full text-base">
              {submitting ? <LoaderCircle className="size-5 animate-spin" /> : <ShieldCheck className="size-5" />} Buat Pesanan
            </button>
            <p className="mt-3 flex items-center justify-center gap-2 text-center text-[11px] text-[#8a7c81]"><Clock3 className="size-3.5" /> Selesaikan pembayaran maksimal {paymentWindowMinutes} menit setelah pesanan dibuat.</p>
          </section>
        </div>
      </form>
      {toast ? <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
    </main>
  );
}

function OrderSuccess({ order, proofUploading, uploadProof, invoiceLink }: { order: Order; proofUploading: boolean; uploadProof: (file?: File) => void; invoiceLink: string }) {
  const payment: PaymentDetails = order.paymentDetails || {
    type: order.paymentMethod,
    name: bankAccount.bank,
    accountNumber: bankAccount.number,
    accountHolder: bankAccount.holder,
  };
  let qrisPayload = "";
  if (payment.type === "qris" && payment.qrisPayload) {
    try {
      qrisPayload = generateDynamicQrisPayload(payment.qrisPayload, order.total);
    } catch {
      qrisPayload = "";
    }
  }
  const remainingSeconds = usePaymentCountdown(order.reservedUntil);
  const activeReservation = ["reserved", "awaiting_payment", "pending_confirmation"].includes(order.status);
  const expired = ["cancelled", "rejected"].includes(order.status) || (activeReservation && remainingSeconds <= 0);
  const waiting = order.status === "pending_confirmation" && !expired;
  const paid = order.status === "paid";

  return (
    <main className="min-h-screen bg-[#fffaf6] paper-noise px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between"><Brand compact /><Link href="/shop" className="ghost-button"><ArrowLeft className="size-4" /> Kembali</Link></div>
        <div className="surface overflow-hidden">
          <div className="bg-[#4a1326] px-6 py-7 text-white sm:px-9">
            <div className="flex size-12 items-center justify-center rounded-full bg-white/12"><PackageCheck className="size-6 text-[#f2b6c5]" /></div>
            <h1 className="mt-5 font-display text-4xl font-semibold">Pesanan berhasil dibuat</h1>
            <p className="mt-2 text-sm text-white/70">Nomor pesanan <strong className="text-white">{order.orderNumber}</strong>. Stok dikunci selama {paymentWindowMinutes} menit.</p>
            <PaymentCountdown remainingSeconds={remainingSeconds} deadline={order.reservedUntil} paid={paid} expired={expired} />
          </div>
          <div className="grid gap-7 p-6 sm:p-9 lg:grid-cols-[1fr_.88fr]">
            <div>
              <div className="flex gap-4 rounded-2xl border border-[#eadedd] bg-[#fff9f7] p-4">
                <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-[#f0e4dc]"><Image src={order.productImage} alt="" fill sizes="96px" className="object-cover" /></div>
                <div className="min-w-0"><span className="text-xs font-extrabold text-[#a33c5b]">KODE {order.productCode}</span><h2 className="mt-1 font-display text-2xl font-semibold leading-tight">{order.productName}</h2><p className="mt-2 text-xs text-[#756a6e]">{order.color} / {order.size}</p><p className="mt-2 font-bold text-[#8a2949]">{formatRupiah(order.subtotal)}</p></div>
              </div>
              <div className="mt-6 rounded-2xl border border-[#eadedd] p-5"><h3 className="font-display text-2xl font-semibold">Rincian pembayaran</h3><div className="mt-4 space-y-3 text-sm"><div className="flex justify-between text-[#756a6e]"><span>Subtotal</span><span>{formatRupiah(order.subtotal)}</span></div><div className="flex justify-between text-[#756a6e]"><span>{order.shipping.courier} {order.shipping.service}</span><span>{formatRupiah(order.shipping.price)}</span></div><div className="flex justify-between border-t border-[#eadedd] pt-3 text-base font-extrabold"><span>Total</span><span className="text-[#9c2347]">{formatRupiah(order.total)}</span></div></div></div>
            </div>
            <div>
              {payment.type === "qris" ? (
                <div className="rounded-2xl border border-[#e6c2ca] bg-[#fff3f6] p-5">
                  <div className="mb-4 flex items-center gap-3"><PaymentLogo payment={payment} compact /><h3 className="font-bold">{payment.name}</h3></div>
                  {qrisPayload ? <QrisCode payload={qrisPayload} label={`Total ${formatRupiah(order.total)}`} /> : <p className="rounded-xl bg-white p-4 text-xs text-[#9a3451]">Payload QRIS belum valid. Hubungi admin untuk pembayaran manual.</p>}
                  <PaymentMeta holder={payment.accountHolder} total={order.total} deadline={order.reservedUntil} />
                </div>
              ) : (
                <div className="rounded-2xl border border-[#e6c2ca] bg-[#fff3f6] p-5"><div className="flex items-center gap-3"><PaymentLogo payment={payment} compact /><h3 className="font-bold">Transfer {payment.name}</h3></div><p className="mt-4 text-xs uppercase tracking-[0.12em] text-[#8b6f78]">Nomor rekening</p><div className="mt-1 flex items-center justify-between gap-3"><strong className="text-xl tracking-[0.06em]">{payment.accountNumber || "Hubungi admin"}</strong>{payment.accountNumber ? <button onClick={() => navigator.clipboard.writeText(payment.accountNumber || "")} className="rounded-lg border border-[#e2b8c3] bg-white p-2 text-[#8a2949]" aria-label="Salin rekening"><Copy className="size-4" /></button> : null}</div><PaymentMeta holder={payment.accountHolder || bankAccount.holder} total={order.total} deadline={order.reservedUntil} /></div>
              )}
              <div className="mt-5 rounded-2xl border border-dashed border-[#dba5b3] p-5 text-center">
                {expired ? <><Clock3 className="mx-auto size-9 text-[#b4234a]" /><h3 className="mt-3 font-bold text-[#9a2345]">Waktu pembayaran habis</h3><p className="mt-1 text-xs leading-5 text-[#756a6e]">Reservasi sudah dilepas. Produk dapat dipesan buyer lain; buat pesanan baru jika masih tersedia.</p></> : paid ? <><CheckCircle2 className="mx-auto size-9 text-[#218457]" /><h3 className="mt-3 font-bold">Pembayaran dikonfirmasi</h3><p className="mt-1 text-xs leading-5 text-[#756a6e]">Order aman dan masuk proses admin.</p></> : waiting ? <><CheckCircle2 className="mx-auto size-9 text-[#218457]" /><h3 className="mt-3 font-bold">Bukti sudah diterima</h3><p className="mt-1 text-xs leading-5 text-[#756a6e]">Menunggu konfirmasi admin. Notifikasi LIVE muncul setelah admin menyetujui pembayaran.</p></> : <><UploadCloud className="mx-auto size-9 text-[#bf4a6a]" /><h3 className="mt-3 font-bold">Unggah bukti pembayaran</h3><p className="mt-1 text-xs leading-5 text-[#756a6e]">Kirim sebelum timer habis. JPG, PNG, WebP, atau PDF maksimal 5 MB.</p><label className="primary-button mt-4 w-full">{proofUploading ? <LoaderCircle className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />} Pilih Bukti<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" disabled={proofUploading} onChange={(event) => uploadProof(event.target.files?.[0])} /></label></>}
              </div>
              <a href={invoiceLink} target="_blank" rel="noreferrer" className="secondary-button mt-4 w-full"><MessageCircle className="size-4" /> Hubungi Admin</a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-xs font-bold text-[#5f5055]"><span>{label}</span>{children}</label>;
}

function PaymentChoice({ active, onClick, method }: { active: boolean; onClick: () => void; method: PaymentMethodConfig }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-h-[94px] items-center gap-4 rounded-2xl border p-4 text-left transition ${active ? "border-[#d65376] bg-[#fff4f6] text-[#7a1837] shadow-sm" : "border-[#eadedd] bg-white hover:border-[#d7b7bf]"}`}>
      <PaymentLogo payment={method} />
      <span>
        <strong className="block text-sm">{method.name}</strong>
        <span className="mt-1 block text-xs text-[#756a6e]">{method.type === "qris" ? "QR otomatis sesuai total" : method.accountNumber ? `Rek ${method.accountNumber}` : "Rekening diisi admin"}</span>
      </span>
    </button>
  );
}

function PaymentInformation({ method, total, qrisPayload, ready }: { method: PaymentMethodConfig; total: number; qrisPayload: string; ready: boolean }) {
  const holder = method.accountHolder || (method.type === "qris" ? "Nama merchant muncul saat QR dipindai" : "Belum diatur");
  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-[#e5c5cd] bg-[linear-gradient(145deg,#fff8f7,#fff0f4)]">
      <div className="flex items-center gap-3 border-b border-[#ecd6db] px-4 py-4 sm:px-5">
        <PaymentLogo payment={method} compact />
        <div className="min-w-0 flex-1"><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#a33c5b]">Metode terpilih</p><h3 className="truncate font-bold">{method.name}</h3></div>
        <span className="rounded-full bg-[#4a1326] px-3 py-1 text-[10px] font-black text-white">{paymentWindowMinutes} MENIT</span>
      </div>
      <div className="p-4 sm:p-5">
        {method.type === "bank_transfer" ? (
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8b6f78]">Nomor rekening</p>
            <div className="mt-1 flex items-center justify-between gap-3"><strong className="text-xl tracking-[.06em]">{method.accountNumber || "Belum tersedia"}</strong>{method.accountNumber ? <button type="button" onClick={() => navigator.clipboard.writeText(method.accountNumber || "")} className="rounded-lg border border-[#e2b8c3] p-2 text-[#8a2949]" aria-label="Salin nomor rekening"><Copy className="size-4" /></button> : null}</div>
          </div>
        ) : ready && qrisPayload ? <QrisCode payload={qrisPayload} label={`QRIS ${method.name} · ${formatRupiah(total)}`} /> : <p className="rounded-xl bg-white p-4 text-sm text-[#756a6e]">Pilih kurir dulu agar nominal QRIS final.</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <PaymentInfoItem label={method.type === "qris" ? "Atas nama QRIS" : "Atas nama rekening"} value={holder} />
          <PaymentInfoItem label="Total pembayaran" value={ready ? formatRupiah(total) : "Pilih kurir dulu"} strong />
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#4a1326] px-4 py-3 text-xs leading-5 text-white"><Clock3 className="mt-0.5 size-4 shrink-0 text-[#f4b5c5]" /><p>Timer dimulai setelah pesanan dibuat. Bayar dan kirim bukti maksimal <strong>{paymentWindowMinutes} menit</strong>; setelah itu stok otomatis bisa dipesan buyer lain.</p></div>
      </div>
    </div>
  );
}

function PaymentMeta({ holder, total, deadline }: { holder?: string; total: number; deadline: string }) {
  return <div className="mt-4 grid gap-3"><PaymentInfoItem label="Atas nama" value={holder || "Konfirmasi ke admin"} /><PaymentInfoItem label="Total pembayaran" value={formatRupiah(total)} strong /><PaymentInfoItem label="Bayar sebelum" value={`${formatPaymentDeadline(deadline)} WIB`} /></div>;
}

function PaymentInfoItem({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="rounded-xl border border-[#ecdde0] bg-white px-4 py-3"><span className="block text-[10px] font-bold uppercase tracking-[.1em] text-[#8b6f78]">{label}</span><strong className={`mt-1 block break-words ${strong ? "text-lg text-[#9c2347]" : "text-sm"}`}>{value}</strong></div>;
}

function secondsUntil(deadline: string) {
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000));
}

function usePaymentCountdown(deadline: string) {
  const [remaining, setRemaining] = useState(() => secondsUntil(deadline));
  useEffect(() => {
    const update = () => setRemaining(secondsUntil(deadline));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);
  return remaining;
}

function PaymentCountdown({ remainingSeconds, deadline, paid, expired }: { remainingSeconds: number; deadline: string; paid: boolean; expired: boolean }) {
  const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, "0");
  const seconds = (remainingSeconds % 60).toString().padStart(2, "0");
  return <div className={`mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${paid ? "border-emerald-300/30 bg-emerald-400/15" : expired ? "border-red-300/30 bg-red-400/15" : "border-white/15 bg-white/10"}`}><div><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-white/60">{paid ? "Status pembayaran" : expired ? "Reservasi berakhir" : "Sisa waktu pembayaran"}</p><strong className="mt-1 block text-sm">{paid ? "Sudah dikonfirmasi" : expired ? `${formatPaymentDeadline(deadline)} WIB` : `Bayar sebelum ${formatPaymentDeadline(deadline)} WIB`}</strong></div>{!paid && !expired ? <strong className="font-mono text-3xl tracking-[.08em]">{minutes}:{seconds}</strong> : null}</div>;
}
