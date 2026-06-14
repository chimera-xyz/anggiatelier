"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { CheckCircle2, MessageCircle, Radio, ShoppingBag, Sparkles } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/config";
import { listProducts } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";
import type { OverlayEvent, Product } from "@/lib/types";

export function LiveOverlay({ preview }: { preview: boolean }) {
  const [event, setEvent] = useState<OverlayEvent | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [connected, setConnected] = useState(false);
  const lastEventId = useRef<string | null>(null);

  useEffect(() => {
    const htmlBackground = document.documentElement.style.background;
    const bodyBackground = document.body.style.background;
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    return () => {
      document.documentElement.style.background = htmlBackground;
      document.body.style.background = bodyBackground;
    };
  }, []);

  useEffect(() => {
    let clearTimer: number | undefined;
    let stopped = false;
    const key = new URLSearchParams(window.location.hash.slice(1)).get("key") || "";
    const clientId = window.sessionStorage.getItem("anggi-overlay-client") || crypto.randomUUID();
    window.sessionStorage.setItem("anggi-overlay-client", clientId);
    const headers: Record<string, string> = key ? { "x-overlay-key": key } : {};
    let after = preview ? "" : new Date().toISOString();
    const receive = (next: OverlayEvent | null) => {
      if (!next || next.id === lastEventId.current) return;
      lastEventId.current = next.id;
      after = next.createdAt;
      setEvent(next);
      if (next.sound) playNotificationSound();
      if (next.id !== "preview") {
        fetch("/api/overlay/ack", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ clientId, eventId: next.id }) }).catch(() => undefined);
      }
      window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => setEvent(null), next.duration * 1000);
    };

    listProducts().then((items) => setProduct(items.find((item) => item.isLive) || items[0] || null));

    if (preview && !isSupabaseConfigured) receive({ id: "preview", type: "purchase", buyerDisplay: "R***", productCode: "101", productName: "Cardigan Knit Elegance", productPrice: 199000, source: "website", message: "Pembayaran dikonfirmasi", duration: 120, sound: false, createdAt: new Date().toISOString() });

    const supabase = createBrowserSupabase();
    let channel: RealtimeChannel | null = null;
    const poll = async () => {
      try {
        const response = await fetch(`/api/overlay/feed${after ? `?after=${encodeURIComponent(after)}` : ""}`, { headers, cache: "no-store" });
        if (!response.ok) { setConnected(false); return; }
        const data = await response.json() as { event: OverlayEvent | null; topic: string };
        setConnected(true);
        receive(data.event);
        if (supabase && !channel && data.topic) {
          channel = supabase.channel(data.topic).on("broadcast", { event: "overlay" }, ({ payload }) => receive(payload as OverlayEvent)).subscribe((status) => setConnected(status === "SUBSCRIBED"));
        }
      } catch { setConnected(false); }
    };
    const heartbeat = () => fetch("/api/overlay/heartbeat", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ clientId }) }).then((response) => setConnected(response.ok)).catch(() => setConnected(false));
    void poll(); void heartbeat();
    const pollTimer = window.setInterval(() => void poll(), 1500);
    const heartbeatTimer = window.setInterval(heartbeat, 5000);
    const productTimer = window.setInterval(() => listProducts().then((items) => { if (!stopped) setProduct(items.find((item) => item.isLive) || items[0] || null); }), 5000);
    return () => { stopped = true; window.clearTimeout(clearTimer); window.clearInterval(pollTimer); window.clearInterval(heartbeatTimer); window.clearInterval(productTimer); if (channel && supabase) void supabase.removeChannel(channel); };
  }, [preview]);

  const shownProduct = event?.type === "product" && product
    ? { ...product, code: event.productCode, name: event.productName, price: event.productPrice }
    : product;

  return (
    <main className={`relative h-screen w-screen overflow-hidden text-white ${preview ? "bg-[radial-gradient(circle_at_35%_20%,#633047,#17080e_70%)]" : "bg-transparent"}`}>
      {preview ? <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(45deg,#ffffff08_25%,transparent_25%,transparent_75%,#ffffff08_75%),linear-gradient(45deg,#ffffff08_25%,transparent_25%,transparent_75%,#ffffff08_75%)] [background-position:0_0,18px_18px] [background-size:36px_36px]" /> : null}
      {preview ? <span className={`absolute left-[4.4%] top-[11%] z-20 rounded-full px-3 py-1 text-[1.1vh] font-bold ${connected ? "bg-[#1b7a4b]" : "bg-[#9a3451]"}`}>{connected ? "OVERLAY CONNECTED" : "OVERLAY STANDBY"}</span> : null}
      <div className="absolute inset-x-[4.4%] top-[3.3%] flex h-[6.4%] items-center justify-between rounded-[2.2vh] border border-white/15 bg-[linear-gradient(90deg,rgba(63,10,29,.95),rgba(91,22,48,.91))] px-[4.2%] shadow-2xl backdrop-blur-xl">
        <span className="font-display text-[3vh] font-semibold tracking-[.04em]">Anggi Atelier</span>
        <span className="flex items-center gap-[.8vh] rounded-full bg-[#fff8f2] px-[2.2%] py-[.65vh] text-[1.15vh] font-extrabold tracking-[.11em] text-[#8a2949]"><span className="size-[.75vh] animate-pulse rounded-full bg-[#df5276]" /> LIVE SALE</span>
      </div>

      <span className="absolute left-[4.7%] top-[12.5%] h-[5.5%] w-[8%] border-l-[.35vh] border-t-[.35vh] border-[#f3c2cd]/80" />
      <span className="absolute right-[4.7%] top-[12.5%] h-[5.5%] w-[8%] border-r-[.35vh] border-t-[.35vh] border-[#f3c2cd]/80" />
      <span className="absolute bottom-[17%] left-[4.7%] h-[5.5%] w-[8%] border-b-[.35vh] border-l-[.35vh] border-[#f3c2cd]/80" />
      <span className="absolute bottom-[17%] right-[4.7%] h-[5.5%] w-[8%] border-b-[.35vh] border-r-[.35vh] border-[#f3c2cd]/80" />

      {event?.type === "purchase" ? (
        <div key={event.id} className="overlay-enter absolute inset-x-[7%] bottom-[21.5%] flex items-center gap-[2.4%] rounded-[2.6vh] border border-[#e8a3b5]/70 bg-[linear-gradient(135deg,rgba(64,9,28,.96),rgba(106,28,56,.94))] px-[4%] py-[2.2vh] shadow-[0_2vh_7vh_rgba(39,4,17,.48)] backdrop-blur-xl">
          <span className="grid size-[6.4vh] shrink-0 place-items-center rounded-full bg-[linear-gradient(145deg,#f07795,#c73a61)] shadow-lg"><ShoppingBag className="size-[3vh]" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[2.1vh] font-semibold leading-tight"><strong>{event.buyerDisplay}</strong> baru saja membeli <span className="font-extrabold text-[#f4a8bb]">Kode {event.productCode}</span></p>
            <p className="mt-[.8vh] flex items-center gap-[.8vh] text-[1.45vh] font-semibold text-[#70dda1]"><CheckCircle2 className="size-[1.8vh]" /> {event.message}</p>
          </div>
          <span className="text-[1.1vh] font-bold uppercase tracking-[.16em] text-white/45">{event.source === "whatsapp" ? "WA" : "WEB"}</span>
        </div>
      ) : null}

      {event?.type === "product" && shownProduct ? (
        <div key={event.id} className="overlay-enter absolute right-[6%] top-[15%] w-[44%] rounded-[2.6vh] border border-[#d7a443]/80 bg-[linear-gradient(155deg,rgba(55,8,25,.96),rgba(96,25,50,.94))] px-[5%] py-[3vh] text-center shadow-2xl backdrop-blur-xl">
          <span className="rounded-full border border-[#e7afc0]/35 px-[3%] py-[.55vh] text-[1.05vh] font-bold uppercase tracking-[.16em] text-[#f2b0c1]">Kode</span>
          <p className="mt-[1vh] font-display text-[6vh] font-semibold leading-none">{shownProduct.code}</p>
          <h2 className="mt-[1.4vh] font-display text-[3.35vh] font-semibold leading-[1.02]">{shownProduct.name}</h2>
          <div className="mx-auto my-[2vh] h-px w-4/5 bg-[#e8a3b5]/40" />
          <p className="text-[2.4vh] font-extrabold text-[#f091aa]">{formatRupiah(shownProduct.price)}</p>
          <p className="mt-[2.3vh] flex items-center justify-center gap-[1vh] text-[1.45vh] leading-tight text-[#fff4ee]/80"><MessageCircle className="size-[2vh]" /> Order via link bio<br />atau WhatsApp</p>
        </div>
      ) : null}

      <div className="absolute inset-x-[4.4%] bottom-[4%] flex h-[10.5%] items-center gap-[3%] rounded-[2.4vh] border border-[#e9a4b7]/55 bg-[linear-gradient(110deg,rgba(69,13,33,.96),rgba(106,29,57,.93))] px-[4%] shadow-2xl backdrop-blur-xl">
        <span className="grid size-[6.8vh] shrink-0 place-items-center rounded-full bg-[linear-gradient(145deg,#ef7996,#c73a61)]"><Radio className="size-[3.2vh]" /></span>
        <div className="min-w-0 flex-1"><p className="text-[1.9vh] font-extrabold tracking-[.05em]">KETIK KODE + WARNA</p><p className="mt-[.6vh] text-[1.25vh] text-[#fff4ee]/75">Pesan melalui link bio atau WhatsApp admin</p></div>
        <Sparkles className="size-[2.5vh] text-[#f3b5c4]" />
      </div>
    </main>
  );
}

function playNotificationSound() {
  try {
    const context = new AudioContext();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.65);
    gain.connect(context.destination);
    [659.25, 783.99].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.12);
      oscillator.stop(context.currentTime + 0.5 + index * 0.12);
    });
  } catch {
    // Browser sources may block audio until the page is activated.
  }
}
