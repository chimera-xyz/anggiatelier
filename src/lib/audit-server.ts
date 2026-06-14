import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function writeAudit(supabase: SupabaseClient, action: string, entityType: string, entityId?: string, details: Record<string, unknown> = {}) {
  await supabase.from("audit_logs").insert({ actor: "admin", action, entity_type: entityType, entity_id: entityId || null, details });
}
