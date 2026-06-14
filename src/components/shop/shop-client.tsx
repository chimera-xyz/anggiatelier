"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  LockKeyhole,
  MessageCircle,
  PackageCheck,
  Radio,
  Search,
  ShoppingBag,
  Sparkles,
  Truck,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Toast } from "@/components/toast";
import { adminWhatsApp } from "@/lib/config";
import { formatRupiah, whatsappOrderTemplate } from "@/lib/format";
import { listProducts } from "@/lib/api-client";
import { subscribeDemoStore } from "@/lib/demo-store";
import { isSupabaseConfigured } from "@/lib/config";
import type { Product } from "@/lib/types";

export function ShopClient() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCode, setSelectedCode] = useState("101");
  const [query, setQuery] = useState("101");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const refresh = () => listProducts().then(setProducts).catch(() => setProducts([]));
    refresh();
    if (!isSupabaseConfigured) return subscribeDemoStore(refresh);
  }, []);

  const liveProduct = products.find((item) => item.isLive) || products[0];
  const selected = products.find((item) => item.code === selectedCode) || liveProduct;
  const variants = selected?.variants.filter((variant) => variant.active) || [];
  const colorOptions = [...new Set(variants.map((variant) => variant.color))];
  const color = colorOptions.includes(selectedColor) ? selectedColor : colorOptions[0] || "";
  const sizeOptions = variants.filter((variant) => variant.color === color).map((variant) => variant.size);
  const size = sizeOptions.includes(selectedSize) ? selectedSize : sizeOptions[0] || "";
  const selectedVariant = variants.find((variant) => variant.color === color && variant.size === size);
  const available = selectedVariant ? selectedVariant.stock - selectedVariant.reserved : 0;

  const whatsappHref = useMemo(() => {
    const message = `${whatsappOrderTemplate()}\n\nKode yang ingin dipesan: ${selected?.code || query}`;
    return `https://wa.me/${adminWhatsApp}?text=${encodeURIComponent(message)}`;
  }, [query, selected?.code]);

  function searchProduct() {
    const code = query.trim();
    const found = products.find((item) => item.code.toLowerCase() === code.toLowerCase());
    if (!found) {
      setToast({ message: `Kode ${code || "tersebut"} belum ditemukan. Cek lagi kode yang disebut host.`, type: "error" });
      return;
    }
    setSelectedCode(found.code);
    document.getElementById("active-product")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function checkout() {
    if (!selected || !color || !size) return;
    router.push(`/checkout?code=${selected.code}&color=${encodeURIComponent(color)}&size=${encodeURIComponent(size)}`);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#fffaf6] text-[#241b1e]">
      <section className="relative overflow-hidden bg-[#350b1a] text-white">
        <div className="absolute inset-0 opacity-80 [background:radial-gradient(circle_at_75%_20%,#7c2749_0,transparent_33%),linear-gradient(135deg,#280813,#4a1326_65%,#250812)]" />
        <div className="absolute -right-14 top-16 h-64 w-64 rounded-full border border-white/10" />
        <div className="absolute -right-32 top-2 h-96 w-96 rounded-full border border-[#e9a4b7]/15" />
        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-6 sm:px-8 lg:pb-24">
          <header className="flex items-center justify-between">
            <Brand light compact />
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-[11px] font-extrabold tracking-[0.14em]">
              <span className="size-2 animate-pulse rounded-full bg-[#ff5f83]" /> LIVE
            </div>
          </header>

          <div className="grid items-end gap-9 pt-14 lg:grid-cols-[1.08fr_.92fr] lg:pt-20">
            <div className="max-w-xl">
              <p className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[#e9a4b7]">
                <Radio className="size-4" /> Belanja sambil nonton
              </p>
              <h1 className="font-display text-[58px] font-semibold leading-[0.88] tracking-[-0.04em] sm:text-[78px]">
                Belanja dari <span className="text-[#f1bdc9]">LIVE</span>
              </h1>
              <p className="mt-6 max-w-md text-[15px] leading-7 text-white/74 sm:text-base">
                Masukkan kode produk yang disebut Anggi di LIVE. Pilih varian, isi alamat, lalu selesaikan pembayaran manual bersama admin.
              </p>
            </div>

            <div className="rounded-[26px] border border-white/16 bg-white/10 p-3 shadow-2xl backdrop-blur-xl">
              <label htmlFor="product-code" className="sr-only">Masukkan kode produk</label>
              <div className="flex gap-2 rounded-[19px] bg-white p-2 text-[#241b1e]">
                <div className="flex flex-1 items-center gap-3 px-3">
                  <Search className="size-5 text-[#9c6676]" />
                  <input
                    id="product-code"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && searchProduct()}
                    className="h-12 w-full bg-transparent text-lg font-semibold outline-none placeholder:text-[#a99ca0]"
                    placeholder="Contoh: 101"
                    inputMode="numeric"
                  />
                </div>
                <button onClick={searchProduct} className="primary-button min-w-[130px] rounded-[14px]">
                  Cari Produk
                </button>
              </div>
              <p className="px-3 pb-1 pt-3 text-xs text-white/62">Kode aktif saat ini: {liveProduct?.code || "-"}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="active-product" className="relative z-10 mx-auto -mt-10 max-w-6xl px-4 sm:px-8">
        {selected ? (
          <div className="overflow-hidden rounded-[30px] border border-[#eadedd] bg-white shadow-[0_28px_80px_rgba(74,19,38,.15)]">
            <div className="flex items-center justify-between bg-[#4a1326] px-5 py-4 text-white sm:px-7">
              <div className="flex items-center gap-2 text-xs font-extrabold tracking-[0.16em]">
                <span className="size-2 animate-pulse rounded-full bg-[#ff6285]" /> {selected.isLive ? "LIVE SEKARANG" : "KOLEKSI TERSEDIA"}
              </div>
              <span className="text-sm font-bold">Kode {selected.code}</span>
            </div>

            <div className="grid lg:grid-cols-[.92fr_1.08fr]">
              <div className="relative min-h-[430px] overflow-hidden bg-[#f2e7df] sm:min-h-[560px]">
                <Image
                  src={selected.image}
                  alt={selected.name}
                  fill
                  loading="eager"
                  sizes="(max-width: 1024px) 100vw, 46vw"
                  className="object-cover"
                />
                <div className="absolute bottom-5 left-5 rounded-full bg-white/90 px-4 py-2 text-xs font-bold text-[#4a1326] shadow-lg backdrop-blur">
                  Foto produk asli koleksi
                </div>
              </div>

              <div className="flex flex-col p-6 sm:p-9 lg:p-12">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-[39px] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-[52px]">{selected.name}</h2>
                    <p className="mt-4 max-w-xl text-sm leading-6 text-[#756a6e]">{selected.description}</p>
                  </div>
                  <span className="status-pill status-paid"><Check className="size-3.5" /> {available} tersedia</span>
                </div>

                <p className="mt-7 font-display text-[39px] font-semibold text-[#9c2347]">{formatRupiah(selected.price)}</p>

                <div className="mt-8 grid gap-7 sm:grid-cols-2">
                  <fieldset>
                    <legend className="mb-3 text-sm font-bold">Pilih warna</legend>
                    <div className="flex flex-wrap gap-3">
                      {colorOptions.map((item) => (
                        <button
                          key={item}
                          onClick={() => { setSelectedColor(item); setSelectedSize(""); }}
                          className={`focus-ring group flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${color === item ? "border-[#9c2347] bg-[#fff2f5] text-[#7a1837]" : "border-[#eadedd] bg-white"}`}
                          aria-pressed={color === item}
                        >
                          <span className="size-5 rounded-full border border-black/10 shadow-inner" style={{ background: selected.colorHex[item] }} />
                          {item}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className="mb-3 text-sm font-bold">Pilih ukuran</legend>
                    <div className="flex gap-2">
                      {sizeOptions.map((item) => {
                        const variant = variants.find((entry) => entry.color === color && entry.size === item);
                        const inStock = Boolean(variant && variant.stock - variant.reserved > 0);
                        return (
                        <button
                          key={item}
                          onClick={() => setSelectedSize(item)}
                          disabled={!inStock}
                          className={`focus-ring size-11 rounded-xl border text-sm font-extrabold ${size === item ? "border-[#4a1326] bg-[#4a1326] text-white" : "border-[#e4d7d8] bg-white"}`}
                          aria-pressed={size === item}
                        >
                          {item}
                        </button>
                        );
                      })}
                    </div>
                  </fieldset>
                </div>

                <div className="mt-9 grid grid-cols-3 divide-x divide-[#eadedd] rounded-2xl border border-[#eadedd] bg-[#fff9f7] py-4 text-center text-[11px] font-semibold text-[#7a4655]">
                  <span className="px-2"><Sparkles className="mx-auto mb-2 size-5 text-[#d64d73]" />Premium knit</span>
                  <span className="px-2"><PackageCheck className="mx-auto mb-2 size-5 text-[#d64d73]" />Dicek admin</span>
                  <span className="px-2"><Truck className="mx-auto mb-2 size-5 text-[#d64d73]" />Banyak kurir</span>
                </div>

                <div className="mt-auto grid gap-3 pt-9 sm:grid-cols-[1fr_auto]">
                  <button onClick={checkout} disabled={available < 1} className="primary-button min-h-[56px] text-base">
                    <ShoppingBag className="size-5" /> Pesan Sekarang
                  </button>
                  <a href={whatsappHref} target="_blank" rel="noreferrer" className="secondary-button min-h-[56px] px-6 text-base">
                    <MessageCircle className="size-5" /> WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="surface p-10 text-center">Memuat koleksi...</div>
        )}
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-5 py-20 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:py-28">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#a93a5b]">Alur sederhana</p>
          <h2 className="mt-4 font-display text-5xl font-semibold leading-[1.02]">Cara belanja dari LIVE</h2>
          <p className="mt-5 max-w-md text-sm leading-7 text-[#756a6e]">Website dan order WhatsApp berbagi stok yang sama. Ketika satu item direservasi, buyer lain langsung melihat ketersediaan terbaru.</p>
          <Link href="/admin" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-[#7f1d3b] hover:underline">
            Buka demo admin <ArrowRight className="size-4" />
          </Link>
        </div>
        <ol className="grid gap-3">
          {[
            ["01", "Masukkan kode produk", "Ketik kode yang disebut Anggi pada kolom pencarian."],
            ["02", "Pilih varian dan kurir", "Pilih warna, ukuran, alamat, serta layanan pengiriman."],
            ["03", "Transfer dan kirim bukti", "Admin memeriksa pembayaran sebelum stok dianggap terjual."],
          ].map(([number, title, text]) => (
            <li key={number} className="group flex gap-5 rounded-2xl border border-[#eadedd] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg sm:p-6">
              <span className="font-display text-3xl font-semibold text-[#c94a6e]">{number}</span>
              <div className="flex-1">
                <h3 className="font-display text-2xl font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-[#756a6e]">{text}</p>
              </div>
              <ChevronRight className="mt-2 size-5 text-[#ccb9bd] transition group-hover:translate-x-1 group-hover:text-[#9c2347]" />
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-[#eadedd] bg-white py-16">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#a93a5b]">Koleksi lainnya</p>
              <h2 className="mt-3 font-display text-4xl font-semibold">Cari dengan kode</h2>
            </div>
            <span className="hidden text-sm text-[#756a6e] sm:block">Stok diperbarui bersama order WhatsApp</span>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => { setSelectedCode(product.code); setQuery(product.code); window.scrollTo({ top: 380, behavior: "smooth" }); }}
                className="group overflow-hidden rounded-[22px] border border-[#eadedd] bg-[#fffaf7] text-left transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="relative aspect-[4/4.4] overflow-hidden">
                  <Image src={product.image} alt={product.name} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" />
                  <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-extrabold text-[#4a1326] shadow-sm">Kode {product.code}</span>
                </div>
                <div className="p-5">
                  <h3 className="font-display text-2xl font-semibold">{product.name}</h3>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-bold text-[#9c2347]">{formatRupiah(product.price)}</span>
                    <span className="text-xs text-[#756a6e]">{product.stock - product.reserved} tersedia</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[#2b0915] px-5 py-9 text-white sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <Brand light compact />
          <div className="flex items-center gap-2 text-xs text-white/65"><LockKeyhole className="size-4" /> Data order hanya dapat dibuka admin.</div>
        </div>
      </footer>

      {toast ? <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
    </main>
  );
}
