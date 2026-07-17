import { supabaseAdmin } from "@/lib/supabase";

/**
 * Log a sensitive admin action to gw_audit_logs.
 * IMPORTANT: Never pass raw secret/key values in `detail`.
 */
export async function logAudit(params: {
  action: string;
  actorEmail?: string;
  targetType?: string;
  targetId?: string;
  detail?: Record<string, unknown>;
  ipAddress?: string;
}) {
  if (!supabaseAdmin) return;

  try {
    await supabaseAdmin.from("gw_audit_logs").insert({
      action: params.action,
      actor_email: params.actorEmail ?? null,
      target_type: params.targetType ?? null,
      target_id: params.targetId ?? null,
      detail: params.detail ?? {},
      ip_address: params.ipAddress ?? null,
    });
  } catch (err) {
    // Non-fatal: log to console but don't break the main request
    console.error("[audit] Failed to write audit log:", err);
  }
}
