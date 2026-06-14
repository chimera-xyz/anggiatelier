import "server-only";

import { randomUUID } from "node:crypto";
import { defaultPaymentMethods, fallbackPaymentMethod } from "./payments";
import { mapPaymentMethod } from "./server-helpers";
import { createServerSupabase } from "./supabase/server";
import type { PaymentMethod, PaymentMethodConfig, PaymentMethodDraft } from "./types";

type Supabase = NonNullable<ReturnType<typeof createServerSupabase>>;

const snapshotAction = "payment_methods.snapshot";
const snapshotEntity = "settings";
const snapshotId = "payment-methods";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sortMethods(methods: PaymentMethodConfig[]) {
  return [...methods].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

function normalize(methods: PaymentMethodConfig[]) {
  return methods.map((method) => method.name.toLowerCase().includes("shield")
    ? { ...method, id: method.id === "pay-shield-bank" ? "pay-seabank" : method.id, name: "SeaBank", bankCode: "seabank" }
    : method);
}

function dbPayload(input: PaymentMethodDraft) {
  return {
    type: input.type,
    name: input.name,
    bank_code: input.bankCode || null,
    account_number: input.accountNumber || null,
    account_holder: input.accountHolder || null,
    qris_payload: input.qrisPayload || null,
    instructions: input.instructions || null,
    enabled: input.enabled,
    sort_order: input.sortOrder,
  };
}

async function readSnapshot(supabase: Supabase) {
  const { data } = await supabase
    .from("audit_logs")
    .select("details")
    .eq("action", snapshotAction)
    .eq("entity_type", snapshotEntity)
    .eq("entity_id", snapshotId)
    .order("created_at", { ascending: false })
    .limit(1);
  const methods = (data?.[0]?.details as { methods?: PaymentMethodConfig[] } | undefined)?.methods;
  return sortMethods(normalize(methods?.length ? methods : defaultPaymentMethods));
}

async function writeSnapshot(supabase: Supabase, methods: PaymentMethodConfig[]) {
  await supabase.from("audit_logs").insert({
    action: snapshotAction,
    entity_type: snapshotEntity,
    entity_id: snapshotId,
    details: { methods: sortMethods(normalize(methods)) },
  });
}

export async function listPaymentMethodsServer(supabase: Supabase, all = false) {
  try {
    let query = supabase.from("payment_methods").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true });
    if (!all) query = query.eq("enabled", true);
    const { data, error } = await query;
    if (!error && data) return sortMethods(normalize(data.map(mapPaymentMethod)));
  } catch {
    // Older deployments may not have the payment_methods table yet.
  }

  const methods = await readSnapshot(supabase);
  return methods.filter((method) => all || method.enabled);
}

export async function savePaymentMethodServer(supabase: Supabase, input: PaymentMethodDraft) {
  const canUseTableId = Boolean(input.id && uuidPattern.test(input.id));
  try {
    const query = canUseTableId
      ? supabase.from("payment_methods").update(dbPayload(input)).eq("id", input.id).select("*").single()
      : supabase.from("payment_methods").insert(dbPayload(input)).select("*").single();
    const { data, error } = await query;
    if (!error && data) return mapPaymentMethod(data);
  } catch {
    // Fall back to the snapshot store below.
  }

  const methods = await listPaymentMethodsServer(supabase, true);
  const current = input.id ? methods.find((method) => method.id === input.id) : undefined;
  const method: PaymentMethodConfig = { ...input, id: current?.id || input.id || randomUUID() };
  const next = current ? methods.map((item) => (item.id === method.id ? method : item)) : [...methods, method];
  await writeSnapshot(supabase, next);
  return method;
}

export async function deletePaymentMethodServer(supabase: Supabase, id: string) {
  try {
    if (uuidPattern.test(id)) {
      const { error } = await supabase.from("payment_methods").delete().eq("id", id);
      if (!error) return;
    }
  } catch {
    // Fall back to snapshot delete.
  }

  const methods = await listPaymentMethodsServer(supabase, true);
  await writeSnapshot(supabase, methods.filter((method) => method.id !== id));
}

export async function resolvePaymentMethodServer(supabase: Supabase, id: string | undefined, type: PaymentMethod) {
  const methods = await listPaymentMethodsServer(supabase, true);
  const byId = id ? methods.find((method) => method.id === id && method.enabled) : undefined;
  const byType = methods.find((method) => method.type === type && method.enabled);
  if (id && !byId && !byType) throw new Error("Metode pembayaran tidak aktif atau tidak ditemukan.");
  return byId || byType || fallbackPaymentMethod(type);
}
