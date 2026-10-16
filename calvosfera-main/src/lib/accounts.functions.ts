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
    return { ok: true };
  });


/** Apenas admins podem atribuir cargos; a checagem acontece no servidor. */
export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; role: "admin" | "moderator" | "vip" | "user" | "none" }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && data.role !== "admin") {
      throw new Error("Você não pode remover seu próprio cargo de admin por aqui");
    }
    const db = await admin();
    const { data: targetRoles } = await db.from("user_roles").select("role").eq("user_id", data.userId);
    const targetIsAdmin = (targetRoles ?? []).some((r) => r.role === "admin");
    if (targetIsAdmin && data.role !== "admin") {
      const { count } = await db.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin");
      if ((count ?? 0) <= 1) throw new Error("A Calvosfera precisa ter pelo menos um admin");
    }

    if (data.role === "none") {
      await db.from("user_roles").delete().eq("user_id", data.userId);
      return { ok: true };
    }
    if (targetIsAdmin && data.role !== "admin") {
      await db.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
    }
    if (data.role === "user") {
      await db.from("user_roles").delete().eq("user_id", data.userId).neq("role", "admin");
      return { ok: true };
    }
    const { error } = await db.from("user_roles").upsert(
      { user_id: data.userId, role: data.role },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
    if (data.role !== "admin") {
      await db.from("user_roles").delete().eq("user_id", data.userId).neq("role", "admin").neq("role", data.role);
    }
    return { ok: true };
  });
