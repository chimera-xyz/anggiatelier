import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveOverlay, type OverlayLayer } from "@/components/overlay/live-overlay";

export const metadata: Metadata = { title: "LIVE Overlay Layer" };

const layers = new Set<OverlayLayer>(["purchase", "product", "brand", "footer"]);

type Props = {
  params: Promise<{ layer: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export default async function OverlayLayerPage({ params, searchParams }: Props) {
  const [{ layer }, query] = await Promise.all([params, searchParams]);
  if (!layers.has(layer as OverlayLayer)) notFound();
  return <LiveOverlay layer={layer as OverlayLayer} preview={query.preview === "1"} />;
}
