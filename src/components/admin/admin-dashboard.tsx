"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Bell, Box, CircleDollarSign, Clipboard, CreditCard, LayoutDashboard, LoaderCircle, LockKeyhole, LogOut, MessageCircle, MonitorPlay, Package, PackageCheck, RefreshCcw, Settings, ShoppingBag, Truck } from "lucide-react";
import { Brand } from "@/components/brand";
import { Toast } from "@/components/toast";
import { LiveControl } from "./live-control";
import { OrderWorkspace } from "./order-workspace";
import { PaymentManager } from "./payment-manager";
import { ProductManager } from "./product-manager";
import { ShippingManager } from "./shipping-manager";
import { WhatsAppOrderModal } from "./whatsapp-order-modal";
import { adminSession, getOverlayHealth, listAuditLogs, listLiveSessions, listOrders, listPaymentMethods, listProducts, listShippingServices, loginAdmin, logoutAdmin } from "@/lib/api-client";
import { isSupabaseConfigured } from "@/lib/config";
import { resetDemoStore, subscribeDemoStore } from "@/lib/demo-store";
import { formatRupiah, statusLabel } from "@/lib/format";
import type { AuditLog, LiveSession, Order, OverlayHealth, PaymentMethodConfig, Product, ShippingService } from "@/lib/types";

type View = "overview" | "orders" | "products" | "shipping" | "payments" | "whatsapp" | "live" | "settings";
const nav: Array<{ id: View; label: string; icon: React.ReactNode }> = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard className="size-[18px]" /> },
  { id: "orders", label: "Orders", icon: <Clipboard className="size-[18px]" /> },
  { id: "products", label: "Products", icon: <Box className="size-[18px]" /> },
  { id: "shipping", label: "Shipping", icon: <Truck className="size-[18px]" /> },
  { id: "payments", label: "Payment", icon: <CreditCard className="size-[18px]" /> },
  { id: "whatsapp", label: "WhatsApp Orders", icon: <MessageCircle className="size-[18px]" /> },
  { id: "live", label: "LIVE Control", icon: <MonitorPlay className="size-[18px]" /> },
  { id: "settings", label: "Settings & Audit", icon: <Settings className="size-[18px]" /> },
];

export function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [view, setView] = useState<View>("overview");
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [shipping, setShipping] = useState<ShippingService[]>([]);
  const [payments, setPayments] = useState<PaymentMethodConfig[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [health, setHealth] = useState<OverlayHealth | null>(null);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [waOpen, setWaOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextOrders, nextProducts, nextShipping, nextPayments, nextSessions, nextHealth, nextAudit] = await Promise.all([
        listOrders(), listProducts(true), listShippingServices(), listPaymentMethods(true), listLiveSessions(), getOverlayHealth(), listAuditLogs(),
      ]);
      setOrders(nextOrders); setProducts(nextProducts); setShipping(nextShipping); setPayments(nextPayments); setSessions(nextSessions); setHealth(nextHealth); setAudit(nextAudit);
    } catch (error) {
      if (error instanceof Error && /sesi admin|unauthorized/i.test(error.message)) setAuthenticated(false);
      else setToast({ message: error instanceof Error ? error.message : "Data operasional gagal dimuat.", type: "error" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { adminSession().then(setAuthenticated).catch(() => setAuthenticated(false)); }, []);
  useEffect(() => {
    if (!authenticated) return;
    const first = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 6000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [authenticated, refresh]);
  useEffect(() => { if (!authenticated || isSupabaseConfigured) return; return subscribeDemoStore(() => void refresh()); }, [authenticated, refresh]);

  const metrics = useMemo(() => {
    const paid = orders.filter((order) => order.status === "paid");
    return { revenue: paid.reduce((sum, order) => sum + order.total, 0), paid: paid.length, pending: orders.filter((order) => order.status === "pending_confirmation").length, reserved: products.reduce((sum, product) => sum + product.reserved, 0), stock: products.reduce((sum, product) => sum + product.stock, 0) };
  }, [orders, products]);

  async function unlock(event: FormEvent) { event.preventDefault(); try { await loginAdmin(pin); setAuthenticated(true); setPin(""); } catch (error) { setToast({ message: error instanceof Error ? error.message : "Login gagal.", type: "error" }); } }
  async function signOut() { await logoutAdmin(); setAuthenticated(false); }

  if (authenticated === null) return <main className="grid min-h-screen place-items-center bg-[#2b0915]"><LoaderCircle className="size-8 animate-spin text-[#f1bdc9]" /></main>;
  if (!authenticated) return <main className="grid min-h-screen place-items-center bg-[#2b0915] px-4 paper-noise"><form onSubmit={unlock} className="w-full max-w-sm rounded-[28px] border border-white/12 bg-white p-8 shadow-2xl"><Brand /><div className="mt-9 grid size-12 place-items-center rounded-2xl bg-[#f9e9ed] text-[#8a2949]"><LockKeyhole className="size-6" /></div><h1 className="mt-5 font-display text-4xl font-semibold">Command Center</h1><p className="mt-2 text-sm leading-6 text-[#756a6e]">Data buyer, stok, pembayaran, dan overlay hanya tersedia untuk admin.</p><label className="mt-6 grid gap-2 text-xs font-bold">PIN admin<input value={pin} onChange={(e) => setPin(e.target.value)} className="input-shell" type="password" inputMode="numeric" autoFocus placeholder="••••" /></label><button className="primary-button mt-5 w-full">Masuk dashboard</button>{!isSupabaseConfigured ? <p className="mt-4 text-center text-xs text-[#8a7c81]">Mode demo · PIN <strong>1234</strong></p> : null}</form>{toast ? <Toast {...toast} onClose={() => setToast(null)} /> : null}</main>;

  return <main className="min-h-screen bg-[#f8f4f2] text-[#241b1e] lg:grid lg:grid-cols-[248px_1fr]"><aside className="hidden min-h-screen flex-col bg-[linear-gradient(180deg,#350b1a,#4a1326_55%,#2b0915)] px-4 py-6 text-white lg:sticky lg:top-0 lg:flex lg:h-screen"><div className="px-3"><Brand light /><p className="mt-2 text-[9px] font-bold tracking-[.32em] text-[#dda1b2]">COMMAND CENTER</p></div><nav className="mt-9 space-y-1.5">{nav.map((item) => <button key={item.id} onClick={() => setView(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition ${view === item.id ? "bg-white/13 text-white shadow-inner" : "text-white/68 hover:bg-white/7 hover:text-white"}`}>{item.icon}<span className="flex-1">{item.label}</span>{item.id === "orders" && metrics.pending ? <span className="rounded-full bg-[#df5276] px-2 py-0.5 text-[10px]">{metrics.pending}</span> : null}</button>)}</nav><div className="mt-auto rounded-2xl border border-white/12 bg-white/6 p-3"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-full bg-[#812a48] text-xs font-extrabold">AA</div><div className="flex-1"><p className="text-sm font-bold">Anggi Atelier</p><p className="text-xs text-white/55">Administrator</p></div></div><button onClick={signOut} className="mt-3 flex w-full items-center gap-2 border-t border-white/10 pt-3 text-xs text-white/55 hover:text-white"><LogOut className="size-4" /> Keluar</button></div></aside>
    <div className="min-w-0"><header className="sticky top-0 z-30 flex h-[68px] items-center gap-3 border-b border-[#eadedd] bg-white/90 px-4 backdrop-blur-xl sm:px-6"><div className="lg:hidden"><Brand compact /></div><div className="hidden items-center gap-3 lg:flex"><span className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-extrabold ${health?.connected ? "bg-[#e8f7ee] text-[#197245]" : "bg-[#fff0f4] text-[#8a2949]"}`}><span className={`size-2 rounded-full ${health?.connected ? "animate-pulse bg-[#218457]" : "bg-[#df5276]"}`} /> {health?.connected ? "OVERLAY CONNECTED" : "LIVE READY"}</span><span className="text-sm text-[#756a6e]">{sessions.find((session) => session.status === "active")?.name || "Belum ada sesi aktif"}</span></div><select value={view} onChange={(e) => setView(e.target.value as View)} className="input-shell ml-auto max-w-44 lg:hidden">{nav.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><div className="ml-auto hidden items-center gap-2 lg:flex"><button onClick={() => void refresh()} className="grid size-10 place-items-center rounded-xl border border-[#eadedd] bg-white text-[#6e5b62]" aria-label="Refresh"><RefreshCcw className={`size-4 ${loading ? "animate-spin" : ""}`} /></button><button className="grid size-10 place-items-center rounded-xl border border-[#eadedd] bg-white text-[#6e5b62]"><Bell className="size-4" /></button><button onClick={() => setWaOpen(true)} className="primary-button"><MessageCircle className="size-4" /> New WhatsApp Order</button></div></header>
      {view === "overview" ? <Overview metrics={metrics} orders={orders} products={products} health={health} setView={setView} /> : null}
      {view === "orders" ? <OrderWorkspace orders={orders} refresh={refresh} toast={setToast} /> : null}
      {view === "whatsapp" ? <OrderWorkspace orders={orders} refresh={refresh} toast={setToast} whatsappOnly /> : null}
      {view === "products" ? <ProductManager products={products} refresh={refresh} toast={setToast} /> : null}
      {view === "shipping" ? <ShippingManager services={shipping} refresh={refresh} toast={setToast} /> : null}
      {view === "payments" ? <PaymentManager methods={payments} refresh={refresh} toast={setToast} /> : null}
      {view === "live" ? <LiveControl products={products} orders={orders} sessions={sessions} health={health} refresh={refresh} toast={setToast} /> : null}
      {view === "settings" ? <SettingsAudit audit={audit} refresh={refresh} toast={setToast} /> : null}
    </div>{waOpen ? <WhatsAppOrderModal products={products} paymentMethods={payments} close={() => setWaOpen(false)} created={async () => { setWaOpen(false); await refresh(); setView("whatsapp"); setToast({ message: "Order WhatsApp dibuat dan stok varian langsung direservasi.", type: "success" }); }} toast={setToast} /> : null}{toast ? <Toast {...toast} onClose={() => setToast(null)} /> : null}</main>;
}

function Overview({ metrics, orders, products, health, setView }: { metrics: { revenue: number; paid: number; pending: number; reserved: number; stock: number }; orders: Order[]; products: Product[]; health: OverlayHealth | null; setView: (view: View) => void }) {
  const cards = [["Revenue dikonfirmasi", formatRupiah(metrics.revenue), <CircleDollarSign key="a" />], ["Perlu dicek", String(metrics.pending), <Bell key="b" />], ["Stok direservasi", String(metrics.reserved), <Package key="c" />], ["Total stok", String(metrics.stock), <Box key="d" />]];
  return <section className="p-4 sm:p-6"><div className="mb-5 flex items-end justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#a33c5b]">Operational snapshot</p><h1 className="mt-2 font-display text-4xl font-semibold">Selamat datang, Admin</h1><p className="mt-2 text-sm text-[#756a6e]">Prioritas saat live: cek pembayaran, jaga stok, lalu proses pengiriman.</p></div></div><div className="grid overflow-hidden rounded-[20px] border border-[#eadedd] bg-white shadow-sm sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, icon], index) => <div key={String(label)} className={`flex items-center gap-4 p-5 ${index ? "border-t border-[#eadedd] sm:border-l sm:border-t-0" : ""}`}><span className="grid size-11 place-items-center rounded-2xl bg-[#fff0f3] text-[#8a2949] [&>svg]:size-5">{icon}</span><div><p className="text-[11px] font-semibold text-[#7c6c72]">{label}</p><p className="mt-1 text-xl font-extrabold">{value}</p></div></div>)}</div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_.75fr]"><div className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-[#eadedd] p-5"><h2 className="font-display text-2xl font-semibold">Pesanan terbaru</h2><button onClick={() => setView("orders")} className="text-xs font-bold text-[#8a2949]">Lihat semua</button></div><div className="divide-y divide-[#eadedd]">{orders.slice(0, 6).map((order) => <button key={order.id} onClick={() => setView("orders")} className="flex w-full items-center gap-4 p-4 text-left hover:bg-[#fff9f7]"><span className={`grid size-10 place-items-center rounded-xl ${order.source === "whatsapp" ? "bg-[#e9f7ef] text-[#218457]" : "bg-[#eef2fb] text-[#355a9b]"}`}>{order.source === "whatsapp" ? <MessageCircle className="size-4" /> : <ShoppingBag className="size-4" />}</span><div className="min-w-0 flex-1"><strong className="block truncate">{order.buyerName} · Kode {order.productCode}</strong><span className="text-xs text-[#756a6e]">{order.orderNumber}</span></div><span className="text-sm font-bold">{formatRupiah(order.total)}</span><span className={`status-pill ${order.status === "paid" ? "status-paid" : order.status === "pending_confirmation" ? "status-waiting" : "status-reserved"}`}>{statusLabel(order.status)}</span></button>)}</div></div>
      <div className="space-y-5"><div className={`surface p-5 ${health?.connected ? "border-[#b9dfca]" : "border-[#efc7cc]"}`}><div className="flex items-center justify-between"><span className={`grid size-11 place-items-center rounded-2xl ${health?.connected ? "bg-[#e8f7ee] text-[#218457]" : "bg-[#fff0f4] text-[#a33c5b]"}`}><Activity className="size-5" /></span><span className={`status-pill ${health?.connected ? "status-paid" : "status-waiting"}`}>{health?.connected ? "Connected" : "Standby"}</span></div><h2 className="mt-4 font-display text-2xl font-semibold">LIVE Overlay</h2><p className="mt-2 text-sm text-[#756a6e]">{health?.connected ? `${health.clientCount} Browser Source aktif dan siap menerima notifikasi.` : "Buka Browser Source di TikTok Live Studio untuk mengaktifkan heartbeat."}</p><button onClick={() => setView("live")} className="ghost-button mt-4 w-full"><MonitorPlay className="size-4" /> Buka control center</button></div><div className="surface p-5"><h2 className="font-display text-2xl font-semibold">Stok menipis</h2><div className="mt-3 space-y-2">{products.flatMap((product) => product.variants.map((variant) => ({ product, variant }))).filter(({ variant }) => variant.active && variant.stock - variant.reserved <= 2).slice(0, 5).map(({ product, variant }) => <div key={variant.id} className="flex items-center justify-between rounded-xl bg-[#fff8f5] p-3 text-xs"><span><strong>Kode {product.code}</strong><span className="block text-[#756a6e]">{variant.color} / {variant.size}</span></span><strong className="text-[#a33c5b]">{variant.stock - variant.reserved} tersisa</strong></div>)}</div></div></div></div>
  </section>;
}

function SettingsAudit({ audit, refresh, toast }: { audit: AuditLog[]; refresh: () => Promise<void>; toast: (value: { message: string; type: "success" | "error" }) => void }) {
  return <section className="p-4 sm:p-6"><div className="mb-5"><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#a33c5b]">System controls</p><h1 className="mt-2 font-display text-4xl font-semibold">Settings & audit trail</h1></div><div className="grid gap-5 xl:grid-cols-[.72fr_1.28fr]"><div className="surface p-5"><h2 className="font-display text-2xl font-semibold">Mode aplikasi</h2><div className="mt-4 rounded-2xl bg-[#fff7f5] p-4 text-sm"><strong>{isSupabaseConfigured ? "Production data mode" : "Demo local mode"}</strong><p className="mt-1 text-xs leading-5 text-[#756a6e]">{isSupabaseConfigured ? "Data tersimpan di Supabase dan dapat digunakan lintas perangkat." : "Data hanya tersimpan di browser ini. Hubungkan Supabase sebelum live launching."}</p></div>{!isSupabaseConfigured ? <button onClick={() => { resetDemoStore(); void refresh(); toast({ message: "Data demo dikembalikan ke kondisi awal.", type: "success" }); }} className="danger-button mt-4 w-full"><RefreshCcw className="size-4" /> Reset data demo</button> : null}<div className="mt-5 space-y-2 text-xs"><Check label="Admin session HttpOnly" /><Check label="Signed shipping quote" /><Check label="Stock reservation expiry" /><Check label="Private payment proof" /><Check label="Overlay heartbeat & acknowledgement" /></div></div><div className="surface overflow-hidden"><div className="border-b border-[#eadedd] p-5"><h2 className="font-display text-2xl font-semibold">Aktivitas admin terbaru</h2></div><div className="max-h-[560px] divide-y divide-[#eadedd] overflow-y-auto">{audit.length ? audit.map((entry) => <div key={entry.id} className="flex gap-4 p-4"><span className="mt-1 size-2 shrink-0 rounded-full bg-[#df5276]" /><div className="min-w-0 flex-1"><strong className="text-sm">{entry.action}</strong><p className="mt-1 text-xs text-[#756a6e]">{entry.entityType}{entry.entityId ? ` · ${entry.entityId}` : ""}</p></div><time className="text-[10px] text-[#8a7c81]">{new Date(entry.createdAt).toLocaleString("id-ID")}</time></div>) : <p className="p-8 text-center text-sm text-[#756a6e]">Belum ada aktivitas tercatat.</p>}</div></div></div></section>;
}
function Check({ label }: { label: string }) { return <div className="flex items-center gap-2 rounded-xl border border-[#eadedd] bg-white p-3"><PackageCheck className="size-4 text-[#218457]" /> {label}</div>; }
