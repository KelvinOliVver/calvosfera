import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ident = { device: string; fp: string };
const USER_RE = /^[a-zA-Z0-9_.]{3,20}$/;

function clientIp() {
  const ip = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim();
  return ip || "unknown";
}

function idents(i: Ident) {
  const list = [
    { kind: "device", value: String(i.device).slice(0, 100) },
    { kind: "fp", value: String(i.fp).slice(0, 100) },
  ];
  const ip = clientIp();
  if (ip !== "unknown") list.push({ kind: "ip", value: ip });
  return list;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function anyBanned(db: Awaited<ReturnType<typeof admin>>, list: { kind: string; value: string }[], kinds: string[]) {
  const filtered = list.filter((x) => kinds.includes(x.kind));
  for (const x of filtered) {
    const { data } = await db.from("banned_identifiers").select("kind").eq("kind", x.kind).eq("value", x.value).maybeSingle();
    if (data) return true;
  }
  return false;
}

export const registerAccount = createServerFn({ method: "POST" })
  .inputValidator((d: { username: string; password: string } & Ident) => d)
  .handler(async ({ data }) => {
    const username = String(data.username ?? "").trim();
    if (!USER_RE.test(username)) return { error: "Nick deve ter 3–20 caracteres: letras, números, _ ou ." };
    if (String(data.password ?? "").length < 6) return { error: "Senha precisa de pelo menos 6 caracteres" };
    const db = await admin();
    const list = idents(data);

    if (await anyBanned(db, list, ["device", "fp", "ip"])) {
      return { error: "Este aparelho ou rede está banido da Calvosfera." };
    }

    const ip = list.find((x) => x.kind === "ip");
    if (ip) {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count } = await db
        .from("user_identifiers")
        .select("user_id", { count: "exact", head: true })
        .eq("kind", "ip")
        .eq("value", ip.value)
        .gte("last_seen", since);
      if ((count ?? 0) >= 3) return { error: "Muitas contas criadas desta rede hoje. Tente amanhã." };
    }

    const { data: taken } = await db.from("profiles").select("id").ilike("username", username).maybeSingle();
    if (taken) return { error: "Esse nick já está em uso" };

    const { data: created, error } = await db.auth.admin.createUser({
      email: `${username.toLowerCase()}@calvosfera.app`,
      password: data.password,
      email_confirm: true,
      user_metadata: { username },
    });
    if (error || !created.user) {
      return { error: error?.message?.includes("already") ? "Esse nick já está em uso" : "Não foi possível criar a conta" };
    }
    await db.from("user_identifiers").upsert(list.map((x) => ({ ...x, user_id: created.user.id, last_seen: new Date().toISOString() })));
    return { ok: true };
  });

export const checkIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Ident) => d)
  .handler(async ({ data, context }) => {
    const db = await admin();
    const uid = context.userId;
    const list = idents(data);
    await db.from("user_identifiers").upsert(list.map((x) => ({ ...x, user_id: uid, last_seen: new Date().toISOString() })));

    const { data: role } = await db.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
    const isAdmin = !!role;
    let { data: ban } = await db.from("bans").select("reason").eq("user_id", uid).maybeSingle();

    // Evasão: conta nova num aparelho banido é banida automaticamente (IP sozinho não, por causa de redes compartilhadas)
    if (!ban && !isAdmin && (await anyBanned(db, list, ["device", "fp"]))) {
      await db.from("bans").insert({ user_id: uid, reason: "Tentativa de burlar ban" });
      ban = { reason: "Tentativa de burlar ban" };
    }
    if (ban) {
      await db.from("banned_identifiers").upsert(list.map((x) => ({ ...x, source_user: uid })), { ignoreDuplicates: true });
    }
    return { isAdmin, banned: !!ban, reason: ban?.reason ?? null };
  });

async function assertAdmin(supabase: { rpc: Function }, uid: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
  if (!data) throw new Error("Apenas o admin pode fazer isso");
}

export const banUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; reason?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { data: targetAdmin } = await db.from("user_roles").select("role").eq("user_id", data.userId).eq("role", "admin").maybeSingle();
    if (targetAdmin) throw new Error("Não dá pra banir um admin");
    await db.from("bans").upsert({ user_id: data.userId, reason: data.reason?.slice(0, 200) || null, banned_by: context.userId });
    await db.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: "member_banned",
      target_user_id: data.userId,
      details: { reason: data.reason?.slice(0, 200) || null },
    });
    const { data: ids } = await db.from("user_identifiers").select("kind,value").eq("user_id", data.userId);
    if (ids?.length) {
      await db.from("banned_identifiers").upsert(ids.map((x) => ({ ...x, source_user: data.userId })), { ignoreDuplicates: true });
    }
    return { ok: true };
  });

export const unbanUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    await db.from("bans").delete().eq("user_id", data.userId);
    await db.from("banned_identifiers").delete().eq("source_user", data.userId);
    await db.from("admin_audit_log").insert({ actor_id: context.userId, action: "member_unbanned", target_user_id: data.userId });
    return { ok: true };
  });

export const setAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; enabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.userId)) throw new Error("Identificador de usuário inválido");
    const db = await admin();
    const { error } = await db.rpc("admin_set_role", {
      _actor: context.userId,
      _target: data.userId,
      _enabled: data.enabled,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resolveCommunityReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reportId: string; status: "resolved" | "dismissed" }) => d)
  .handler(async ({ data, context }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.reportId)) throw new Error("Identificador de denúncia inválido");
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { data: report, error: readError } = await db
      .from("community_reports")
      .select("target_user_id")
      .eq("id", data.reportId)
      .single();
    if (readError) throw new Error(readError.message);
    const { error } = await db
      .from("community_reports")
      .update({ status: data.status, resolved_at: new Date().toISOString() })
      .eq("id", data.reportId);
    if (error) throw new Error(error.message);
    await db.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: `report_${data.status}`,
      target_user_id: report.target_user_id,
      details: { reportId: data.reportId },
    });
    return { ok: true };
  });
