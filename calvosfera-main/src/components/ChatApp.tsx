import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Paperclip, FileText, Menu, X, Users, Hash, Volume2, Mic, MicOff, PhoneOff, LogOut, Pencil, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useVoice } from "@/hooks/useVoice";
import { useServerFn } from "@tanstack/react-start";
import { checkIn, banUser, unbanUser, setUserRole } from "@/lib/accounts.functions";
import { getIdentity } from "@/lib/device";
import { uploadAttachment } from "@/lib/media";
import { Avatar, EditProfile, ViewProfile, PROFILE_COLS, type Profile } from "./ProfileDialogs";

type Channel = { id: string; name: string; kind: string; position: number };
type Message = {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
};

const HELP = [
  "/limpar — apaga todas as mensagens deste canal",
  "/timeout nick minutos — silencia alguém",
  "/untimeout nick — tira o silêncio",
  "/ban nick motivo — bane a pessoa",
  "/unban nick — desbane",
  "/cargo nick admin|moderador|vip|membro — define o cargo",
  "/cargos — mostra os cargos disponíveis",
  "/canal nome — cria canal de texto",
  "/call nome — cria canal de voz",
  "/apagarsala — apaga este canal",
  "/apagarcall nome — apaga um canal de voz",
];

const IMG_RE = /^https?:\/\/\S+\.(gif|png|jpe?g|webp)(\?\S*)?$/i;

export function ChatApp({ userId }: { userId: string }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [online, setOnline] = useState<string[]>([]);
  const [viewing, setViewing] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [mutedUntil, setMutedUntil] = useState<Date | null>(null);
  const [, tick] = useState(0);
  const voice = useVoice(userId);
  const [status, setStatus] = useState<{ isAdmin: boolean; banned: boolean; reason: string | null } | null>(null);
  const [bannedIds, setBannedIds] = useState<string[]>([]);
  const checkInFn = useServerFn(checkIn);
  const banFn = useServerFn(banUser);
  const unbanFn = useServerFn(unbanUser);
  const setRoleFn = useServerFn(setUserRole);

  useEffect(() => {
    getIdentity()
      .then((ident) => checkInFn({ data: ident }))
      .then((r) => {
        setStatus(r);
        if (r.isAdmin) supabase.from("bans").select("user_id").then(({ data }) => setBannedIds((data ?? []).map((b) => b.user_id)));
      })
      .catch(() => setStatus({ isAdmin: false, banned: false, reason: null }));
  }, [userId]);

  async function toggleBan(p: Profile) {
    const isBanned = bannedIds.includes(p.id);
    try {
      if (isBanned) {
        await unbanFn({ data: { userId: p.id } });
        setBannedIds((b) => b.filter((x) => x !== p.id));
        toast.success(`${p.username} foi desbanido`);
      } else {
        const reason = window.prompt(`Motivo do ban de ${p.username}?`) ?? "";
        await banFn({ data: { userId: p.id, reason } });
        setBannedIds((b) => [...b, p.id]);
        toast.success(`${p.username} foi banido`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const loadProfiles = async () => {
    const [{ data: people }, { data: roleRows }] = await Promise.all([
      supabase.from("profiles").select(PROFILE_COLS),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    if (!people) return;
    const roleMap: Record<string, string[]> = {};
    for (const row of roleRows ?? []) (roleMap[row.user_id] ??= []).push(row.role);
    setProfiles(Object.fromEntries(people.map((p) => [p.id, { ...p, roles: roleMap[p.id] ?? [] }])));
  };

  const loadChannels = async () => {
    const { data } = await supabase.from("channels").select("*").order("position");
    if (!data) return;
    setChannels(data);
    setActive((a) => (a && data.some((c) => c.id === a) ? a : (data.find((c) => c.kind === "text")?.id ?? null)));
  };

  const loadTimeout = async () => {
    const { data } = await supabase.from("timeouts").select("until").eq("user_id", userId).maybeSingle();
    setMutedUntil(data && new Date(data.until) > new Date() ? new Date(data.until) : null);
  };

  useEffect(() => {
    loadChannels();
    loadTimeout();
    loadProfiles();
    const t = setInterval(() => tick((n) => n + 1), 15000);
    const rt = supabase
      .channel("server-state")
      .on("postgres_changes", { event: "*", schema: "public", table: "channels" }, () => loadChannels())
      .on("postgres_changes", { event: "*", schema: "public", table: "timeouts" }, () => loadTimeout())
      .subscribe();
    return () => {
      clearInterval(t);
      supabase.removeChannel(rt);
    };
  }, [userId]);

  useEffect(() => {
    const ch = supabase.channel("online", { config: { presence: { key: userId } } });
    ch.on("presence", { event: "sync" }, () => setOnline(Object.keys(ch.presenceState())))
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
        const row = payload.new as Profile;
        if (row?.id) setProfiles((all) => ({ ...all, [row.id]: { ...row, roles: all[row.id]?.roles ?? [] } }));
      })
      .subscribe((s) => {
        if (s === "SUBSCRIBED") ch.track({ at: Date.now() });
      });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId]);

  useEffect(() => {
    if (!active) return;
    setMessages([]);
    setLoadingMsgs(true);
    supabase
      .from("messages")
      .select("*")
      .eq("channel_id", active)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data) setMessages(data.reverse());
        setLoadingMsgs(false);
      });
    const ch = supabase
      .channel(`msgs-${active}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${active}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          setProfiles((p) => {
            if (!p[m.user_id]) loadProfiles();
            return p;
          });
        },
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
        const id = (payload.old as { id: string }).id;
        setMessages((prev) => prev.filter((x) => x.id !== id));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [active]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (voice.error) toast.error(voice.error);
  }, [voice.error]);

  const findUser = (nick?: string) =>
    Object.values(profiles).find((p) => p.username.toLowerCase() === (nick ?? "").replace(/^@/, "").toLowerCase());

  async function runCommand(raw: string) {
    const [cmd = "", ...args] = raw.slice(1).split(/\s+/);
    if (!status?.isAdmin) return toast.error("Só o admin pode usar comandos");
    const err = (m: string) => toast.error(m);
    switch (cmd.toLowerCase()) {
      case "ajuda":
      case "help":
        return toast(HELP.join("\n"), { duration: 12000 });
      case "cargos":
        return toast("ADMIN — controle total\nMODERADOR — cargo visual (moderação continua protegida)\nVIP — destaque de membro\nMEMBRO — cargo padrão", { duration: 10000 });
      case "cargo": {
        const u = findUser(args[0]);
        const requested = (args[1] ?? "").toLowerCase();
        const roleMap: Record<string, "admin" | "moderator" | "vip" | "user" | "none"> = {
          admin: "admin", administrador: "admin", adm: "admin",
          moderador: "moderator", mod: "moderator",
          vip: "vip", membro: "user", user: "user", remover: "none", nenhum: "none",
        };
        const role = roleMap[requested];
        if (!u) return err("Usuário não encontrado. Use o nick exato.");
        if (!role) return err("Use: /cargo nick admin, moderador, vip, membro ou remover");
        try {
          await setRoleFn({ data: { userId: u.id, role } });
          await loadProfiles();
          toast.success(`Cargo de ${u.username} atualizado`);
        } catch (e) { return err((e as Error).message); }
        return;
      }
      case "limpar": {
        if (!active) return;
        if (!window.confirm(`Apagar TODAS as mensagens de #${activeCh?.name}?`)) return;
        const { error } = await supabase.from("messages").delete().eq("channel_id", active);
        if (error) return err(error.message);
        setMessages([]);
        return toast.success("Chat limpo");
      }
      case "timeout": {
        const u = findUser(args[0]);
        const min = Number(args[1] ?? 10);
        if (!u) return err("Usuário não encontrado");
        if (!(min > 0)) return err("Use: /timeout nick minutos");
        const until = new Date(Date.now() + min * 60000).toISOString();
        const { error } = await supabase.from("timeouts").upsert({ user_id: u.id, until, created_by: userId });
        if (error) return err(error.message);
        return toast.success(`${u.username} em timeout por ${min} min`);
      }
      case "untimeout": {
        const u = findUser(args[0]);
        if (!u) return err("Usuário não encontrado");
        await supabase.from("timeouts").delete().eq("user_id", u.id);
        return toast.success(`Timeout de ${u.username} removido`);
      }
      case "ban":
      case "unban": {
        const u = findUser(args[0]);
        if (!u) return err("Usuário não encontrado");
        try {
          if (cmd === "ban") {
            await banFn({ data: { userId: u.id, reason: args.slice(1).join(" ") } });
            setBannedIds((b) => [...b, u.id]);
          } else {
            await unbanFn({ data: { userId: u.id } });
            setBannedIds((b) => b.filter((x) => x !== u.id));
          }
          return toast.success(`${u.username} ${cmd === "ban" ? "banido" : "desbanido"}`);
        } catch (e) {
          return err((e as Error).message);
        }
      }
      case "canal":
      case "call":
        return createChannel(cmd === "canal" ? "text" : "voice", args.join("-"));
      case "apagarsala":
        return activeCh && deleteChannel(activeCh);
      case "apagarcall": {
        const c = channels.find((x) => x.kind === "voice" && x.name.toLowerCase() === args.join("-").toLowerCase());
        return c ? deleteChannel(c) : err("Call não encontrada");
      }
      default:
        return err("Comando desconhecido. Use /ajuda");
    }
  }

  async function createChannel(kind: "text" | "voice", rawName?: string) {
    const name = (rawName || (window.prompt(kind === "text" ? "Nome do novo canal" : "Nome da nova call") ?? ""))
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .slice(0, 30);
    if (!name) return;
    const position = Math.max(0, ...channels.map((c) => c.position)) + 1;
    const { error } = await supabase.from("channels").insert({ name, kind, position });
    if (error) {
      toast.error(error.message);
      return;
    }
    await loadChannels();
    toast.success(`${kind === "text" ? "Canal" : "Call"} ${name} criado`);
  }

  async function deleteChannel(c: Channel) {
    if (!window.confirm(`Apagar ${c.kind === "text" ? "#" : ""}${c.name}? Tudo nele será perdido.`)) return;
    if (voice.channelId === c.id) voice.leave();
    const { error } = await supabase.from("channels").delete().eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await loadChannels();
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if ((!content && !pendingFile) || !active || sending) return;
    if (content.startsWith("/") && !pendingFile) {
      setText("");
      await runCommand(content);
      return;
    }
    setSending(true);
    try {
      let att: { url: string; type: string; name: string } | null = null;
      if (pendingFile) att = await uploadAttachment(userId, pendingFile);
      const { data, error } = await supabase
        .from("messages")
        .insert({
          channel_id: active,
          user_id: userId,
          content: content.slice(0, 2000),
          attachment_url: att?.url ?? null,
          attachment_type: att?.type ?? null,
          attachment_name: att?.name ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      setText("");
      setPendingFile(null);
      setMessages((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data]));
    } catch (err) {
      toast.error(mutedUntil ? "Você está em timeout" : (err as Error).message);
    } finally {
      setSending(false);
    }
  }

  const me = profiles[userId];
  const activeCh = channels.find((c) => c.id === active);
  const voiceCh = channels.find((c) => c.id === voice.channelId);
  const sortedMembers = useMemo(
    () =>
      Object.values(profiles).sort(
        (a, b) => Number(online.includes(b.id)) - Number(online.includes(a.id)) || a.username.localeCompare(b.username),
      ),
    [profiles, online],
  );

  if (status?.banned) {
    return (
      <div className="flex h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl">Você foi banido</h1>
          <p className="mt-2 text-sm text-muted-foreground">{status.reason || "O admin removeu seu acesso à Calvosfera."}</p>
          <button onClick={() => supabase.auth.signOut()} className="mt-6 text-sm text-primary hover:underline">Sair</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background selection:bg-primary/30">
      {/* Channels */}
      {navOpen && <div className="fixed inset-0 z-30 bg-background/70 md:hidden" onClick={() => setNavOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col bg-panel transition-transform md:static md:w-64 md:translate-x-0 ${navOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-start justify-between border-b border-white/[0.06] bg-panel px-4 py-4">
          <div>
          <h1 className="bg-gradient-to-r from-primary via-pink-300 to-sky-300 bg-clip-text text-lg font-bold tracking-tight text-transparent">Calvosfera</h1>
          <p className="text-xs text-muted-foreground">カルボスフェラ · servidor</p>
          </div>
          <button className="rounded p-1 hover:bg-accent md:hidden" onClick={() => setNavOpen(false)} aria-label="Fechar menu"><X className="h-4 w-4" /></button>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          <ChannelGroup title="Texto" onAdd={status?.isAdmin ? () => createChannel("text") : undefined}>
            {channels
              .filter((c) => c.kind === "text")
              .map((c) => (
                <ChannelBtn key={c.id} active={c.id === active} onClick={() => { setActive(c.id); setNavOpen(false); }} onDelete={status?.isAdmin ? () => deleteChannel(c) : undefined}>
                  <Hash className="h-4 w-4" /> {c.name}
                </ChannelBtn>
              ))}
          </ChannelGroup>
          <ChannelGroup title="Voz" onAdd={status?.isAdmin ? () => createChannel("voice") : undefined}>
            {channels
              .filter((c) => c.kind === "voice")
              .map((c) => (
                <div key={c.id}>
                  <ChannelBtn active={c.id === voice.channelId} onClick={() => voice.join(c.id)} onDelete={status?.isAdmin ? () => deleteChannel(c) : undefined}>
                    <Volume2 className="h-4 w-4" /> {c.name}
                  </ChannelBtn>
                  {c.id === voice.channelId && (
                    <div className="ml-6 mt-1 space-y-1">
                      {[userId, ...voice.peers].map((id) => (
                        <div key={id} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Avatar p={profiles[id]} size={20} />
                          {profiles[id]?.username ?? "..."}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </ChannelGroup>
        </nav>
        {voiceCh && (
          <div className="border-t bg-rail px-3 py-2">
            <p className="text-xs font-bold text-online">Conectado à voz</p>
            <div className="flex items-center justify-between">
              <span className="truncate text-sm">{voiceCh.name}</span>
              <div className="flex gap-1">
                <IconBtn onClick={voice.toggleMute} label={voice.muted ? "Desmutar" : "Mutar"}>
                  {voice.muted ? <MicOff className="h-4 w-4 text-destructive" /> : <Mic className="h-4 w-4" />}
                </IconBtn>
                <IconBtn onClick={voice.leave} label="Sair da call">
                  <PhoneOff className="h-4 w-4 text-destructive" />
                </IconBtn>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 bg-rail px-3 py-2">
          <button onClick={() => me && setViewing(me)}>
            <Avatar p={me} size={34} status={me?.status ?? "online"} />
          </button>
          <span className="flex-1 truncate text-sm font-bold">{me?.username}</span>
          <IconBtn onClick={() => setEditing(true)} label="Editar perfil">
            <Pencil className="h-4 w-4" />
          </IconBtn>
          <IconBtn onClick={() => supabase.auth.signOut()} label="Sair">
            <LogOut className="h-4 w-4" />
          </IconBtn>
        </div>
      </aside>

      {/* Chat */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/[0.06] bg-background/90 px-4 backdrop-blur-xl">
          <button className="-ml-1 rounded p-1.5 hover:bg-accent md:hidden" onClick={() => setNavOpen(true)} aria-label="Abrir menu"><Menu className="h-5 w-5" /></button>
          <Hash className="h-5 w-5 text-muted-foreground" />
          <span className="font-bold">{activeCh?.name}</span>
          <span className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex lg:hidden"><Users className="h-3.5 w-3.5" />{online.length} online</span>
        </header>
        <div className="flex-1 overflow-y-auto py-4">
          {loadingMsgs && <p className="px-4 text-sm text-muted-foreground">Carregando mensagens…</p>}
          {!loadingMsgs && messages.length === 0 && (
            <div className="px-4 pt-10">
              <p className="font-display text-2xl">#{activeCh?.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">Ninguém falou nada aqui ainda. Começa você.</p>
            </div>
          )}
          {messages.map((m, i) => {
            const p = profiles[m.user_id];
            const grouped = i > 0 && messages[i - 1]?.user_id === m.user_id;
            return (
              <div key={m.id} className={`group flex gap-3 px-4 py-0.5 hover:bg-card/50 ${grouped ? "" : "mt-3"}`}>
                <div className="w-10 shrink-0">
                  {!grouped && (
                    <button onClick={() => p && setViewing(p)}>
                      <Avatar p={p} />
                    </button>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {!grouped && (
                    <div className="flex items-baseline gap-2">
                      <button onClick={() => p && setViewing(p)} className="font-bold text-primary hover:underline">
                        {p?.username ?? "..."}
                      </button>
                      {p?.roles?.filter((r) => r !== "user").map((role) => {
                        const roleInfo: Record<string, { label: string; style: string }> = {
                          admin: { label: "ADMIN", style: "border-rose-400/30 bg-rose-500/15 text-rose-200" },
                          moderator: { label: "MOD", style: "border-sky-400/30 bg-sky-500/15 text-sky-200" },
                          vip: { label: "VIP", style: "border-amber-400/30 bg-amber-500/15 text-amber-200" },
                        };
                        const info = roleInfo[role];
                        return info ? <span key={role} className={`rounded-full border px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider ${info.style}`}>{info.label}</span> : null;
                      })}
                      <span className="text-xs text-muted-foreground">
                        {new Date(m.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                  )}
                  {IMG_RE.test(m.content) ? (
                    <img src={m.content} alt="" className="mt-1 max-h-72 rounded-lg" loading="lazy" />
                  ) : (
                    m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  )}
                  {m.attachment_url && <Attachment m={m} />}
                </div>
                {(m.user_id === userId || status?.isAdmin) && (
                  <button
                    onClick={() => supabase.from("messages").delete().eq("id", m.id)}
                    className="text-xs text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                  >
                    apagar
                  </button>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={send} className="shrink-0 px-4 pb-4">
          {pendingFile && (
            <div className="mb-2 flex items-center gap-2 rounded-md bg-card px-3 py-2 text-sm">
              <FileText className="h-4 w-4 text-primary" />
              <span className="truncate">{pendingFile.name}</span>
              <span className="text-xs text-muted-foreground">{(pendingFile.size / 1024 / 1024).toFixed(1)} MB</span>
              <button type="button" onClick={() => setPendingFile(null)} className="ml-auto rounded p-1 hover:bg-accent" aria-label="Remover arquivo">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {mutedUntil ? (
            <div className="rounded-lg bg-card px-4 py-3 text-sm text-muted-foreground">
              Você está em timeout até {mutedUntil.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-transparent bg-card px-3 py-2 focus-within:border-primary/50">
              <button type="button" onClick={() => fileRef.current?.click()} className="rounded p-1 text-muted-foreground transition hover:text-foreground" aria-label="Anexar arquivo">
                <Paperclip className="h-5 w-5" />
              </button>
              <input
                ref={fileRef}
                type="file"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && f.size > 50 * 1024 * 1024) toast.error("Máximo 50MB");
                  else if (f) setPendingFile(f);
                  e.target.value = "";
                }}
              />
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onPaste={(e) => {
                  const f = e.clipboardData.files?.[0];
                  if (f) setPendingFile(f);
                }}
                placeholder={status?.isAdmin ? `Conversar em #${activeCh?.name ?? ""} — /ajuda para comandos` : `Conversar em #${activeCh?.name ?? ""}`}
                className="flex-1 bg-transparent py-1 outline-none placeholder:text-muted-foreground"
                maxLength={2000}
              />
              <button type="submit" disabled={sending || (!text.trim() && !pendingFile)} className="rounded p-1 text-primary transition disabled:text-muted-foreground" aria-label="Enviar">
                {sending ? <span className="text-xs">Enviando…</span> : <Send className="h-5 w-5" />}
              </button>
            </div>
          )}
        </form>
      </main>

      {/* Members */}
      <aside className="hidden w-60 shrink-0 overflow-y-auto bg-panel p-3 lg:block">
        <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">
          Membros — {online.length} online
        </p>
        {sortedMembers.map((p) => (
          <button
            key={p.id}
            onClick={() => setViewing(p)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent ${online.includes(p.id) ? "" : "opacity-50"}`}
          >
            <Avatar p={p} size={32} status={online.includes(p.id) ? (p.status ?? "online") : "invisible"} />
            <span className="truncate text-sm">{p.username}</span>
            {p.roles?.some((r) => r === "admin" || r === "moderator" || r === "vip") && (
              <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider ${p.roles.includes("admin") ? "bg-rose-500/15 text-rose-200" : p.roles.includes("moderator") ? "bg-sky-500/15 text-sky-200" : "bg-amber-500/15 text-amber-200"}`}>
                {p.roles.includes("admin") ? "ADM" : p.roles.includes("moderator") ? "MOD" : "VIP"}
              </span>
            )}
            {bannedIds.includes(p.id) && <span className="ml-auto text-[10px] uppercase text-destructive">banido</span>}
          </button>
        ))}
      </aside>

      <ViewProfile
        p={viewing}
        onClose={() => setViewing(null)}
        actions={
          status?.isAdmin && viewing && viewing.id !== userId ? (
            <button
              onClick={() => toggleBan(viewing)}
              className="rounded-md border border-destructive/50 px-3 py-1.5 text-sm text-destructive transition hover:bg-destructive hover:text-destructive-foreground"
            >
              {bannedIds.includes(viewing.id) ? "Desbanir" : "Banir"}
            </button>
          ) : undefined
        }
      />
      {me && (
        <EditProfile
          open={editing}
          onOpenChange={setEditing}
          me={me}
          onSaved={(p) => setProfiles((all) => ({ ...all, [p.id]: p }))}
          onLogout={() => supabase.auth.signOut()}
        />
      )}
    </div>
  );
}

function Attachment({ m }: { m: Message }) {
  const url = m.attachment_url!;
  const type = m.attachment_type ?? "";
  if (type.startsWith("image/")) return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={m.attachment_name ?? ""} loading="lazy" className="mt-1 max-h-80 max-w-full rounded-lg" /></a>;
  if (type.startsWith("video/")) return <video src={url} controls preload="metadata" className="mt-1 max-h-80 max-w-full rounded-lg" />;
  if (type.startsWith("audio/")) return <audio src={url} controls className="mt-1 w-full max-w-sm" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" download={m.attachment_name ?? undefined} className="mt-1 flex max-w-sm items-center gap-3 rounded-lg border bg-card px-3 py-2 transition hover:border-primary/50">
      <FileText className="h-6 w-6 shrink-0 text-primary" />
      <span className="truncate text-sm">{m.attachment_name ?? "arquivo"}</span>
    </a>
  );
}

function ChannelGroup({ title, children, onAdd }: { title: string; children: React.ReactNode; onAdd?: (() => void) | undefined }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between px-2">
        <p className="text-xs font-bold uppercase text-muted-foreground">{title}</p>
        {onAdd && (
          <button onClick={onAdd} className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`Criar ${title}`} title="Criar">
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ChannelBtn({ active, onClick, onDelete, children }: { active: boolean; onClick: () => void; onDelete?: (() => void) | undefined; children: React.ReactNode }) {
  return (
    <div className={`group/ch flex items-center rounded-md transition ${active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"}`}>
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm">
        {children}
      </button>
      {onDelete && (
        <button onClick={onDelete} className="mr-1 rounded p-1 opacity-0 hover:text-destructive group-hover/ch:opacity-100 focus:opacity-100" aria-label="Apagar canal">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function IconBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className="rounded-md p-1.5 hover:bg-accent">
      {children}
    </button>
  );
}
