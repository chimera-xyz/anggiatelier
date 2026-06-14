"use client";

import { useState } from "react";
import { Copy, Download, ExternalLink, Layers3, MonitorPlay, Play, Radio, Square, Wifi, WifiOff } from "lucide-react";
import { endLiveSession, publishOverlay, setLiveProduct, startLiveSession } from "@/lib/api-client";
import { formatRupiah, maskBuyerName } from "@/lib/format";
import type { LiveSession, Order, OverlayHealth, Product } from "@/lib/types";

type ToastSetter = (toast: { message: string; type: "success" | "error" }) => void;

const overlayLayers = [
  { id: "purchase", name: "Notifikasi pembelian", size: "1080 × 320", description: "Muncul sementara saat pembayaran dikonfirmasi." },
  { id: "product", name: "Produk aktif", size: "720 × 960", description: "Kartu produk persisten yang mengikuti pilihan produk LIVE." },
  { id: "brand", name: "Brand header", size: "1080 × 180", description: "Logo Anggi Atelier dan indikator LIVE minimal." },
  { id: "footer", name: "Cara order", size: "1080 × 240", description: "Instruksi kode, warna, link bio, dan WhatsApp." },
] as const;

export function LiveControl({ products, orders, sessions, health, refresh, toast }: { products: Product[]; orders: Order[]; sessions: LiveSession[]; health: OverlayHealth | null; refresh: () => Promise<void>; toast: ToastSetter }) {
  const active = sessions.find((session) => session.status === "active");
  const liveProduct = products.find((product) => product.isLive) || products.find((product) => product.active);
  const recentBuyer = orders.find((order) => order.status === "paid");
  const [name, setName] = useState(`Live Anggi ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long" })}`);
  const [duration, setDuration] = useState(7);
  const [sound, setSound] = useState(true);
  const streamUrl = health?.streamUrl || "/overlay#key=anggi-live-demo";
  const sources = overlayLayers.map((layer) => ({ ...layer, url: makeLayerUrl(streamUrl, layer.id) }));

  async function run(task: () => Promise<unknown>, message: string) {
    try { await task(); await refresh(); toast({ message, type: "success" }); }
    catch (error) { toast({ message: error instanceof Error ? error.message : "Kontrol LIVE gagal.", type: "error" }); }
  }

  return <section className="min-w-0 overflow-x-hidden p-4 sm:p-5">
    <div className="mb-4"><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#a33c5b]">Broadcast control</p><h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">LIVE control center</h1><p className="mt-1 text-sm text-[#756a6e]">Hubungkan Browser Source TikTok Live Studio, jalankan sesi, dan picu overlay dari satu layar.</p></div>

    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <div className="surface min-w-0 p-4 xl:col-span-2">
        <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:justify-between"><div className="min-w-0"><p className="text-xs font-extrabold text-[#817379]">INDEPENDENT OVERLAY SOURCES</p><h2 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">Empat layer, bebas atur posisi</h2><p className="mt-2 max-w-3xl text-sm leading-5 text-[#756a6e]">Tambahkan setiap URL sebagai Link Source terpisah di TikTok LIVE Studio. Semua background transparan dan tidak memiliki frame layar.</p></div><span className={`status-pill shrink-0 ${health?.connected ? "status-paid" : "status-waiting"}`}>{health?.connected ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}{health?.connected ? `${health.clientCount} source aktif` : "Belum terhubung"}</span></div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">{sources.map((source, index) => <article key={source.id} className="min-w-0 rounded-2xl border border-[#eadedd] bg-[#fffaf8] p-4"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f7e5ea] text-sm font-extrabold text-[#8a2949]">{index + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{source.name}</strong><span className="rounded-full bg-white px-2.5 py-1 font-mono text-[10px] font-bold text-[#756a6e]">{source.size}</span></div><p className="mt-1 text-xs leading-5 text-[#756a6e]">{source.description}</p></div></div><div className="mt-3 flex min-w-0 gap-2"><input readOnly value={source.url} className="input-shell min-w-0 flex-1 font-mono text-[11px]" /><button onClick={() => { void navigator.clipboard.writeText(source.url); toast({ message: `URL ${source.name} disalin.`, type: "success" }); }} className="ghost-button shrink-0 px-3" aria-label={`Salin URL ${source.name}`}><Copy className="size-4" /></button><a href={makePreviewUrl(source.url)} target="_blank" className="ghost-button shrink-0 px-3" aria-label={`Preview ${source.name}`}><ExternalLink className="size-4" /></a></div></article>)}</div>
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#f7f1ef] px-3 py-2.5 text-xs leading-5 text-[#756a6e]"><Layers3 className="size-4 shrink-0 text-[#8a2949]" /> Posisi dan skala setiap layer diatur langsung di TikTok Studio. Jangan crop isi source; sesuaikan ukuran source memakai rekomendasi di atas.</div>
      </div>

      <div className="surface min-w-0 p-4 xl:col-span-2">
        <p className="text-xs font-extrabold text-[#817379]">LIVE SESSION</p>
        {active ? <><div className="mt-1 flex min-w-0 items-center gap-3"><span className="size-3 shrink-0 animate-pulse rounded-full bg-[#df5276]" /><h2 className="min-w-0 truncate font-display text-2xl font-semibold sm:text-3xl">{active.name}</h2></div><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Order" value={String(active.orderCount)} /><Metric label="Revenue" value={formatRupiah(active.revenue)} /></div><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => run(() => endLiveSession(active.id), "Sesi live diakhiri dan laporan dikunci.")} className="danger-button min-h-10"><Square className="size-4" /> Akhiri sesi</button><a href={`/api/reports/orders?sessionId=${active.id}`} className="ghost-button min-h-10"><Download className="size-4" /> Export sesi</a></div></> : <><h2 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">Mulai pencatatan live</h2><input className="input-shell mt-3" value={name} onChange={(event) => setName(event.target.value)} /><button onClick={() => run(() => startLiveSession(name), "Sesi live dimulai. Order baru akan ditandai ke sesi ini.")} className="primary-button mt-3 min-h-10"><Play className="size-4" /> Mulai sesi</button></>}
      </div>

      <div className="surface min-w-0 p-4 xl:col-span-2">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0"><p className="text-xs font-extrabold text-[#817379]">PRODUCT SPOTLIGHT</p><h2 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">Produk yang sedang dibahas Anggi</h2></div><div className="flex flex-wrap items-end gap-3"><label className="grid gap-1 text-xs font-bold">Durasi<input className="input-shell min-h-10 w-24" type="number" min="3" max="30" value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label><label className="flex min-h-10 items-center gap-2 text-xs font-bold"><input type="checkbox" checked={sound} onChange={(event) => setSound(event.target.checked)} className="size-4 accent-[#8a2949]" /> Suara</label></div></div>
        <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-3">{products.filter((product) => product.active).map((product) => <button key={product.id} onClick={() => run(() => setLiveProduct(product.id), `Kode ${product.code} sekarang menjadi produk LIVE.`)} className={`min-w-0 rounded-2xl border p-3 text-left transition ${product.isLive ? "border-[#df5276] bg-[#fff0f4] shadow-md" : "border-[#eadedd] bg-white hover:border-[#dcb7c1]"}`}><span className="text-[11px] font-extrabold text-[#a33c5b]">KODE {product.code}</span><strong className="mt-1 block truncate text-sm">{product.name}</strong><div className="mt-2 flex min-w-0 items-center justify-between gap-2"><span className="text-xs text-[#756a6e]">{product.stock - product.reserved} tersedia</span>{product.isLive ? <span className="status-pill status-waiting shrink-0"><Radio className="size-3" /> LIVE</span> : null}</div></button>)}</div>
        <div className="mt-4 flex flex-wrap gap-2"><button disabled={!liveProduct} onClick={() => liveProduct && run(() => publishOverlay({ type: "product", productCode: liveProduct.code, productName: liveProduct.name, productPrice: liveProduct.price, message: "Order via link bio atau WhatsApp", duration, sound: false }), "Kartu produk LIVE diperbarui.")} className="primary-button min-h-10 px-4"><MonitorPlay className="size-4" /> Perbarui kartu produk</button><button disabled={!liveProduct} onClick={() => liveProduct && run(() => publishOverlay({ type: "purchase", buyerDisplay: maskBuyerName(recentBuyer?.buyerName || "Pembeli"), productCode: liveProduct.code, productName: liveProduct.name, productPrice: liveProduct.price, source: recentBuyer?.source || "website", message: "Pembayaran dikonfirmasi", duration, sound }), "Notifikasi tes pembelian dikirim ke LIVE.")} className="secondary-button min-h-10 px-4"><Radio className="size-4" /> Tes notifikasi beli</button><a href="/api/reports/orders" className="ghost-button min-h-10 px-4"><Download className="size-4" /> Export semua order</a></div>
      </div>
    </div>
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-2xl bg-[#fff7f5] p-3"><span className="text-xs text-[#817379]">{label}</span><strong className="mt-1 block truncate text-lg">{value}</strong></div>; }

function makeLayerUrl(streamUrl: string, layer: typeof overlayLayers[number]["id"]) {
  const [path, key] = streamUrl.split("#");
  const base = path.replace(/\/overlay(?:\/[^/?#]+)?(?:\?[^#]*)?$/, "");
  return `${base}/overlay/${layer}${key ? `#${key}` : ""}`;
}

function makePreviewUrl(url: string) {
  const [path, key] = url.split("#");
  return `${path}?preview=1${key ? `#${key}` : ""}`;
}
