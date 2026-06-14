import type { Metadata } from "next";
import { LiveOverlay } from "@/components/overlay/live-overlay";

export const metadata: Metadata = { title: "LIVE Overlay" };

type Props = { searchParams: Promise<{ preview?: string }> };

export default async function OverlayPage({ searchParams }: Props) {
  const params = await searchParams;
  return <LiveOverlay layer="purchase" preview={params.preview === "1"} />;
}
