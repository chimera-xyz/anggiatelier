"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Check, MessageCircle, ShoppingBag } from "lucide-react";
import { overlayContactName, overlayOrderInstruction } from "@/lib/overlay-copy";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { listProducts } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";
import type { OverlayEvent, Product } from "@/lib/types";

export type OverlayLayer = "purchase" | "product" | "brand" | "footer";

type OverlayState = {
  connected: boolean;
  event: OverlayEvent | null;
  product: Product | null;
};

export function LiveOverlay({ layer, preview }: { layer: OverlayLayer; preview: boolean }) {
  const { connected, event, product } = useOverlayState(layer, preview);

  return (
    <main className={`overlay-canvas ${preview ? "overlay-preview" : ""}`}>
      {preview ? <span className={`overlay-preview-status ${connected ? "is-connected" : ""}`}>{connected ? "CONNECTED" : "PREVIEW"}</span> : null}
      {layer === "purchase" ? <PurchaseOverlay event={event} preview={preview} /> : null}
      {layer === "product" ? <ProductOverlay product={product} /> : null}
      {layer === "brand" ? <BrandOverlay /> : null}
      {layer === "footer" ? <FooterOverlay /> : null}
    </main>
  );
}

function useOverlayState(layer: OverlayLayer, preview: boolean): OverlayState {
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
    const storageKey = `anggi-overlay-client-${layer}`;
    const clientId = window.sessionStorage.getItem(storageKey) || crypto.randomUUID();
    window.sessionStorage.setItem(storageKey, clientId);
    const headers: Record<string, string> = key ? { "x-overlay-key": key } : {};
    let after = preview ? "" : new Date().toISOString();

    const receive = (next: OverlayEvent | null) => {
      if (!next || next.id === lastEventId.current) return;
      lastEventId.current = next.id;
      after = next.createdAt;

      if (layer === "product" && next.type === "product") {
        setProduct((current) => current
          ? { ...current, code: next.productCode, name: next.productName, price: next.productPrice }
          : previewProduct(next));
        return;
      }
      if (layer !== "purchase" || next.type !== "purchase") return;

      setEvent(next);
      if (next.sound) playNotificationSound();
      if (next.id !== "preview") {
        fetch("/api/overlay/ack", {
          method: "POST",
          headers: { "content-type": "application/json", ...headers },
          body: JSON.stringify({ clientId, eventId: next.id }),
        }).catch(() => undefined);
      }
      window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => setEvent(null), next.duration * 1000);
    };

    const loadProduct = () => listProducts()
      .then((items) => {
        if (!stopped) setProduct(items.find((item) => item.isLive) || items[0] || null);
      })
      .catch(() => undefined);

    if (layer === "product") void loadProduct();
    if (preview && layer === "purchase") {
      receive({
        id: "preview",
        type: "purchase",
        buyerDisplay: "R***",
        productCode: "3303",
        productName: "Rose Cable Cardigan",
        productPrice: 249000,
        source: "website",
        message: "Pembayaran dikonfirmasi",
        duration: 3600,
        sound: false,
        createdAt: new Date().toISOString(),
      });
    }

    const needsFeed = layer === "purchase" || layer === "product";
    const supabase = needsFeed ? createBrowserSupabase() : null;
    let channel: RealtimeChannel | null = null;
    const poll = async () => {
      if (!needsFeed) return;
      try {
        const response = await fetch(`/api/overlay/feed${after ? `?after=${encodeURIComponent(after)}` : ""}`, { headers, cache: "no-store" });
        if (!response.ok) { setConnected(false); return; }
        const data = await response.json() as { event: OverlayEvent | null; topic: string };
        setConnected(true);
        receive(data.event);
        if (supabase && !channel && data.topic) {
          channel = supabase.channel(data.topic)
            .on("broadcast", { event: "overlay" }, ({ payload }) => receive(payload as OverlayEvent))
            .subscribe((status) => setConnected(status === "SUBSCRIBED"));
        }
      } catch {
        setConnected(false);
      }
    };
    const heartbeat = () => fetch("/api/overlay/heartbeat", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ clientId }),
    }).then((response) => setConnected(response.ok)).catch(() => setConnected(false));

    void poll();
    void heartbeat();
    const pollTimer = needsFeed ? window.setInterval(() => void poll(), 1500) : undefined;
    const heartbeatTimer = window.setInterval(heartbeat, 5000);
    const productTimer = layer === "product" ? window.setInterval(loadProduct, 4000) : undefined;

    return () => {
      stopped = true;
      window.clearTimeout(clearTimer);
      if (pollTimer) window.clearInterval(pollTimer);
      window.clearInterval(heartbeatTimer);
      if (productTimer) window.clearInterval(productTimer);
      if (channel && supabase) void supabase.removeChannel(channel);
    };
  }, [layer, preview]);

  return { connected, event, product };
}

function PurchaseOverlay({ event, preview }: { event: OverlayEvent | null; preview: boolean }) {
  if (!event && !preview) return null;
  const shown = event || {
    buyerDisplay: "R***",
    productCode: "3303",
    message: "Pembayaran dikonfirmasi",
    source: "website",
  };

  return (
    <section key={event?.id || "purchase-preview"} className="overlay-widget overlay-purchase overlay-enter">
      <span className="overlay-purchase-icon"><ShoppingBag aria-hidden="true" /></span>
      <div className="overlay-purchase-copy">
        <p><strong>{shown.buyerDisplay}</strong> baru saja membeli <b>Kode {shown.productCode}</b></p>
        <span><Check aria-hidden="true" /> {shown.message}</span>
      </div>
      <small>{shown.source === "whatsapp" ? overlayContactName.toUpperCase() : "WEB"}</small>
    </section>
  );
}

function ProductOverlay({ product }: { product: Product | null }) {
  if (!product) return null;
  return (
    <section className="overlay-widget overlay-product">
      <div className="overlay-product-code"><span>Kode</span><strong>{product.code}</strong></div>
      <div className="overlay-product-body"><h1>{product.name}</h1><div className="overlay-product-rule" /><p className="overlay-product-price">{formatRupiah(product.price)}</p></div>
      <p className="overlay-product-order"><span><MessageCircle aria-hidden="true" /></span> {overlayOrderInstruction}</p>
    </section>
  );
}

function BrandOverlay() {
  return (
    <header className="overlay-widget overlay-brand">
      <span className="overlay-brand-name">Anggi Atelier</span>
      <span className="overlay-live"><i /> LIVE</span>
    </header>
  );
}

function FooterOverlay() {
  return (
    <footer className="overlay-widget overlay-footer">
      <div><strong>KETIK KODE + WARNA</strong><p>{overlayOrderInstruction}</p></div>
      <span className="overlay-footer-icon"><MessageCircle aria-hidden="true" /></span>
    </footer>
  );
}

function previewProduct(event: OverlayEvent): Product {
  return {
    id: "preview",
    code: event.productCode,
    name: event.productName,
    description: "",
    price: event.productPrice,
    image: "",
    images: [],
    colors: [],
    colorHex: {},
    sizes: [],
    stock: 0,
    reserved: 0,
    isLive: true,
    active: true,
    weightGrams: 0,
    lengthCm: 0,
    widthCm: 0,
    heightCm: 0,
    variants: [],
  };
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
