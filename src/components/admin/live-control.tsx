"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Download, MonitorPlay, Play, Radio, Square, Wifi, WifiOff } from "lucide-react";
import { endLiveSession, publishOverlay, setLiveProduct, startLiveSession } from "@/lib/api-client";
import { formatRupiah, maskBuyerName } from "@/lib/format";
import type { LiveSession, Order, OverlayHealth, Product } from "@/lib/types";

type ToastSetter = (toast: { message: string; type: "success" | "error" }) => void;

export function LiveControl({ products, orders, sessions, health, refresh, toast }: { products: Product[]; orders: Order[]; sessions: LiveSession[]; health: OverlayHealth | null; refresh: () => Promise<void>; toast: ToastSetter }) {
  const active = sessions.find((session) => session.status === "active");
  const liveProduct = products.find((product) => product.isLive) || products.find((product) => product.active);
  const recentBuyer = orders.find((order) => order.status === "paid");
  const [name, setName] = useState(`Live Anggi ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long" })}`);
  const [duration, setDuration] = useState(7);
  const [sound, setSound] = useState(true);
  const streamUrl = health?.streamUrl || `${typeof window === "undefined" ? "" : window.location.origin}/overlay`;
  const previewUrl = streamUrl.replace("/overlay", "/overlay?preview=1");

  async function run(task: () => Promise<unknown>, message: string) {
    try { await task(); await refresh(); toast({ message, type: "success" }); }
    catch (error) { toast({ message: error instanceof Error ? error.message : "Kontrol LIVE gagal.", type: "error" }); }
  }

  return <section className="min-w-0 overflow-x-hidden p-4 sm:p-5">
    <div className="mb-4"><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#a33c5b]">Broadcast control</p><h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">LIVE control center</h1><p className="mt-1 text-sm text-[#756a6e]">Hubungkan Browser Source TikTok Live Studio, jalankan sesi, dan picu overlay dari satu layar.</p></div>

    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <div className="surface min-w-0 p-4">
        <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:justify-between"><div className="min-w-0"><p className="text-xs font-extrabold text-[#817379]">OVERLAY CONNECTION</p><h2 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">Live Studio Browser Source</h2></div><span className={`status-pill shrink-0 ${health?.connected ? "status-paid" : "status-waiting"}`}>{health?.connected ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}{health?.connected ? `${health.clientCount} terhubung` : "Belum terhubung"}</span></div>
        <p className="mt-3 text-sm leading-5 text-[#756a6e]">Tambahkan URL berikut sebagai Browser/Web Source. Kunci berada di fragment URL sehingga tidak ikut masuk log server.</p>
        <div className="mt-3 flex min-w-0 gap-2"><input readOnly value={streamUrl} className="input-shell min-w-0 flex-1 font-mono text-xs" /><button onClick={() => navigator.clipboard.writeText(streamUrl)} className="ghost-button shrink-0 px-3" aria-label="Salin URL overlay"><Copy className="size-4" /></button></div>
        <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-[#756a6e]"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#218457]" /> Heartbeat dan fallback polling aktif otomatis.</div>
      </div>

      <div className="surface min-w-0 p-4">
        <p className="text-xs font-extrabold text-[#817379]">LIVE SESSION</p>
        {active ? <><div className="mt-1 flex min-w-0 items-center gap-3"><span className="size-3 shrink-0 animate-pulse rounded-full bg-[#df5276]" /><h2 className="min-w-0 truncate font-display text-2xl font-semibold sm:text-3xl">{active.name}</h2></div><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Order" value={String(active.orderCount)} /><Metric label="Revenue" value={formatRupiah(active.revenue)} /></div><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => run(() => endLiveSession(active.id), "Sesi live diakhiri dan laporan dikunci.")} className="danger-button min-h-10"><Square className="size-4" /> Akhiri sesi</button><a href={`/api/reports/orders?sessionId=${active.id}`} className="ghost-button min-h-10"><Download className="size-4" /> Export sesi</a></div></> : <><h2 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">Mulai pencatatan live</h2><input className="input-shell mt-3" value={name} onChange={(event) => setName(event.target.value)} /><button onClick={() => run(() => startLiveSession(name), "Sesi live dimulai. Order baru akan ditandai ke sesi ini.")} className="primary-button mt-3 min-h-10"><Play className="size-4" /> Mulai sesi</button></>}
      </div>

      <div className="surface min-w-0 p-4 xl:col-span-2">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0"><p className="text-xs font-extrabold text-[#817379]">PRODUCT SPOTLIGHT</p><h2 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">Produk yang sedang dibahas Anggi</h2></div><div className="flex flex-wrap items-end gap-3"><label className="grid gap-1 text-xs font-bold">Durasi<input className="input-shell min-h-10 w-24" type="number" min="3" max="30" value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label><label className="flex min-h-10 items-center gap-2 text-xs font-bold"><input type="checkbox" checked={sound} onChange={(event) => setSound(event.target.checked)} className="size-4 accent-[#8a2949]" /> Suara</label></div></div>
        <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-3">{products.filter((product) => product.active).map((product) => <button key={product.id} onClick={() => run(() => setLiveProduct(product.id), `Kode ${product.code} sekarang menjadi produk LIVE.`)} className={`min-w-0 rounded-2xl border p-3 text-left transition ${product.isLive ? "border-[#df5276] bg-[#fff0f4] shadow-md" : "border-[#eadedd] bg-white hover:border-[#dcb7c1]"}`}><span className="text-[11px] font-extrabold text-[#a33c5b]">KODE {product.code}</span><strong className="mt-1 block truncate text-sm">{product.name}</strong><div className="mt-2 flex min-w-0 items-center justify-between gap-2"><span className="text-xs text-[#756a6e]">{product.stock - product.reserved} tersedia</span>{product.isLive ? <span className="status-pill status-waiting shrink-0"><Radio className="size-3" /> LIVE</span> : null}</div></button>)}</div>
        <div className="mt-4 flex flex-wrap gap-2"><button disabled={!liveProduct} onClick={() => liveProduct && run(() => publishOverlay({ type: "product", productCode: liveProduct.code, productName: liveProduct.name, productPrice: liveProduct.price, message: "Order via link bio atau WhatsApp", duration, sound: false }), "Spotlight produk dikirim ke LIVE.")} className="primary-button min-h-10 px-4"><MonitorPlay className="size-4" /> Tampilkan produk</button><button disabled={!liveProduct} onClick={() => liveProduct && run(() => publishOverlay({ type: "purchase", buyerDisplay: maskBuyerName(recentBuyer?.buyerName || "Pembeli"), productCode: liveProduct.code, productName: liveProduct.name, productPrice: liveProduct.price, source: recentBuyer?.source || "website", message: "Pembayaran dikonfirmasi", duration, sound }), "Notifikasi tes pembelian dikirim ke LIVE.")} className="secondary-button min-h-10 px-4"><Radio className="size-4" /> Tes notifikasi beli</button><a href={previewUrl} target="_blank" className="ghost-button min-h-10 px-4">Buka preview</a><a href="/api/reports/orders" className="ghost-button min-h-10 px-4"><Download className="size-4" /> Export semua order</a></div>
      </div>
    </div>
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-2xl bg-[#fff7f5] p-3"><span className="text-xs text-[#817379]">{label}</span><strong className="mt-1 block truncate text-lg">{value}</strong></div>; }
