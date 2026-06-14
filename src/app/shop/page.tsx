import type { Metadata } from "next";
import { ShopClient } from "@/components/shop/shop-client";

export const metadata: Metadata = {
  title: "Belanja dari LIVE",
};

export default function ShopPage() {
  return <ShopClient />;
}
