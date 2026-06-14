import { NextRequest, NextResponse } from "next/server";
import { products as demoProducts, shippingServices as demoServices } from "@/lib/seed";
import { createServerSupabase } from "@/lib/supabase/server";
import { signShippingQuote } from "@/lib/shipping-quote";
import type { ShippingOption } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const postalCode = String(body.postalCode || "");
  const productId = String(body.productId || "");
  if (!/^\d{5}$/.test(postalCode) || !productId) return NextResponse.json({ error: "Produk dan kode pos wajib diisi." }, { status: 400 });

  const supabase = createServerSupabase();
  let product = demoProducts.find((item) => item.id === productId);
  let enabledServices = demoServices.filter((item) => item.enabled);
  if (supabase) {
    const [{ data: productRow }, { data: serviceRows }] = await Promise.all([
      supabase.from("products").select("id,name,price,weight_grams,length_cm,width_cm,height_cm").eq("id", productId).eq("active", true).single(),
      supabase.from("shipping_services").select("*").eq("enabled", true),
    ]);
    if (!productRow) return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
    product = { ...demoProducts[0], id: productRow.id, name: productRow.name, price: productRow.price, weightGrams: productRow.weight_grams, lengthCm: productRow.length_cm, widthCm: productRow.width_cm, heightCm: productRow.height_cm };
    enabledServices = (serviceRows || []).map((row) => ({ id: row.id, courierCode: row.courier_code, courierName: row.courier_name, serviceCode: row.service_code, serviceName: row.service_name, flatPrice: row.flat_price, eta: row.eta, enabled: row.enabled, source: row.source }));
  }
  if (!product) return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });

  let source: "estimate" | "biteship" = "estimate";
  let rates: ShippingOption[] = enabledServices.map((service) => ({ id: `manual:${service.id}`, courier: service.courierName, service: service.serviceName, price: service.flatPrice, eta: service.eta }));
  const apiKey = process.env.BITESHIP_API_KEY;
  if (apiKey && process.env.ORIGIN_POSTAL_CODE && enabledServices.length) {
    const response = await fetch("https://api.biteship.com/v1/rates/couriers", {
      method: "POST",
      headers: { authorization: apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        origin_postal_code: process.env.ORIGIN_POSTAL_CODE,
        destination_postal_code: postalCode,
        couriers: [...new Set(enabledServices.map((service) => service.courierCode))].join(","),
        items: [{ name: product.name, value: product.price, weight: product.weightGrams, length: product.lengthCm, width: product.widthCm, height: product.heightCm, quantity: 1 }],
      }),
      cache: "no-store",
    });
    if (response.ok) {
      const data = await response.json();
      const pricing = (data.pricing || []) as Record<string, unknown>[];
      if (pricing.length) {
        source = "biteship";
        rates = pricing.slice(0, 12).map((rate, index) => ({ id: `biteship:${rate.courier_code}-${rate.courier_service_code}-${index}`, courier: String(rate.courier_name || rate.courier_code).toUpperCase(), service: String(rate.courier_service_name || rate.courier_service_code), price: Number(rate.price || 0), eta: String(rate.duration || "Estimasi tersedia saat checkout") }));
      }
    }
  }
  const signedRates = rates.map((rate) => ({ ...rate, token: signShippingQuote(rate, productId, postalCode) }));
  return NextResponse.json({ source, rates: signedRates });
}
