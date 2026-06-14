import { PackingSlip } from "@/components/admin/packing-slip";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";
import { requestHostedAdmin, requestHostedDemo, usesHostedDemo } from "@/lib/demo-overlay-server";
import { mapOrder } from "@/lib/server-helpers";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";
import { cookies } from "next/headers";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
};

const orderSelect = "*, products(code,name,image_url)";

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

async function loadOrder(id: string, accessToken?: string): Promise<Order | null> {
  const supabase = createServerSupabase();
  const cookieStore = await cookies();
  const isAdmin = verifyAdminToken(cookieStore.get(ADMIN_COOKIE)?.value);

  if (!supabase) {
    if (!usesHostedDemo() || (!isAdmin && !accessToken)) return null;
    try {
      if (isAdmin) {
        const { order } = await requestHostedAdmin<{ order: Record<string, unknown> }>("admin_order_get", { id });
        return mapOrder(order);
      }
      const { order } = await requestHostedDemo<{ order: Record<string, unknown> }>("order_get", {
        orderId: id,
        token: accessToken || "",
      });
      return mapOrder(order);
    } catch {
      return null;
    }
  }

  await supabase.rpc("expire_reservations");
  const { data, error } = await supabase.from("orders").select(orderSelect).eq("id", id).single();
  if (error || !data) return null;

  const tokenMatches = accessToken && String(data.public_token || "") === accessToken;
  if (!isAdmin && !tokenMatches) return null;

  return mapOrder(data);
}

export default async function PackingSlipPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { token } = await searchParams;
  const order = await loadOrder(id, firstParam(token));

  if (!order) {
    return <main className="grid min-h-screen place-items-center p-6 text-center text-[#33272c]">Tautan pesanan tidak valid.</main>;
  }

  return <PackingSlip order={order} />;
}
