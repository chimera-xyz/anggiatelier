import type { Metadata } from "next";
import { CheckoutClient } from "@/components/shop/checkout-client";

export const metadata: Metadata = { title: "Checkout" };

type Props = {
  searchParams: Promise<{ code?: string; color?: string; size?: string }>;
};

export default async function CheckoutPage({ searchParams }: Props) {
  const params = await searchParams;
  return <CheckoutClient initialCode={params.code || "101"} initialColor={params.color} initialSize={params.size} />;
}
