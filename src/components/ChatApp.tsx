import { useEffect, useMemo, useRef, useState } from "react";
import { Hash, Volume2, Mic, MicOff, PhoneOff, LogOut, Pencil, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useVoice } from "@/hooks/useVoice";
import { Avatar, EditProfile, ViewProfile, type Profile } from "./ProfileDialogs";

type Channel = { id: string; name: string; kind: string; position: number };
type Message = { id: string; channel_id: string; user_id: string; content: string; created_at: string };

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
  const bottomRef = useRef<HTMLDivElement>(null);
  const voice = useVoice(userId);

  const loadProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id,username,avatar_url,banner_url,bio");
    if (data) setProfiles(Object.fromEntries(data.map((p) => [p.id, p])));
  };

  useEffect(() => {
    supabase
      .from("channels")
      .select("*")
      .order("position")
      .then(({ data }) => {
        if (data) {
          setChannels(data);
          setActive((a) => a ?? data.find((c) => c.kind === "text")?.id ?? null);
        }
      });
    loadProfiles();
    const ch = supabase.channel("online", { config: { presence: { key: userId } } });
    ch.on("presence", { event: "sync" }, () => setOnline(Object.keys(ch.presenceState())))
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadProfiles())
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
    supabase
      .from("messages")
      .select("*")
      .eq("channel_id", active)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => data && setMessages(data.reverse()));
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

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || !active) return;
    setText("");
    const { data, error } = await supabase
      .from("messages")
      .insert({ channel_id: active, user_id: userId, content: content.slice(0, 2000) })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setMessages((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data]));
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

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Channels */}
      <aside className="flex w-64 shrink-0 flex-col bg-panel">
        <div className="border-b px-4 py-4">
          <h1 className="text-xl text-sakura">Calvosfera</h1>
          <p className="text-xs text-muted-foreground">servidor oficial ✦ ハゲ</p>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          <ChannelGroup title="Texto">
            {channels
              .filter((c) => c.kind === "text")
              .map((c) => (
                <ChannelBtn key={c.id} active={c.id === active} onClick={() => setActive(c.id)}>
                  <Hash className="h-4 w-4" /> {c.name}
                </ChannelBtn>
              ))}
          </ChannelGroup>
          <ChannelGroup title="Voz">
            {channels
              .filter((c) => c.kind === "voice")
              .map((c) => (
                <div key={c.id}>
                  <ChannelBtn active={c.id === voice.channelId} onClick={() => voice.join(c.id)}>
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
            <p className="text-xs font-bold text-online">Em call</p>
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
            <Avatar p={me} size={34} online />
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
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <Hash className="h-5 w-5 text-muted-foreground" />
          <span className="font-bold">{activeCh?.name}</span>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.map((m, i) => {
            const p = profiles[m.user_id];
            const grouped = i > 0 && messages[i - 1]?.user_id === m.user_id;
            return (
              <div key={m.id} className={`group flex gap-3 ${grouped ? "-mt-3" : ""}`}>
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
                      <span className="text-xs text-muted-foreground">
                        {new Date(m.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                  )}
                  {IMG_RE.test(m.content) ? (
                    <img src={m.content} alt="" className="mt-1 max-h-72 rounded-lg" loading="lazy" />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  )}
                </div>
                {m.user_id === userId && (
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
        <form onSubmit={send} className="p-4">
          <div className="flex items-center gap-2 rounded-xl bg-card px-4 py-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Conversar em #${activeCh?.name ?? ""} (cole link de GIF pra mandar)`}
              className="flex-1 bg-transparent py-1 outline-none placeholder:text-muted-foreground"
              maxLength={2000}
            />
            <button type="submit" className="text-primary" aria-label="Enviar">
              <Send className="h-5 w-5" />
            </button>
          </div>
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
            <Avatar p={p} size={32} online={online.includes(p.id)} />
            <span className="truncate text-sm">{p.username}</span>
          </button>
        ))}
      </aside>

      <ViewProfile p={viewing} onClose={() => setViewing(null)} />
      {me && (
        <EditProfile
          open={editing}
          onOpenChange={setEditing}
          me={me}
          onSaved={(p) => setProfiles((all) => ({ ...all, [p.id]: p }))}
        />
      )}
    </div>
  );
}

function ChannelGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 px-2 text-xs font-bold uppercase text-muted-foreground">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ChannelBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

function IconBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className="rounded-md p-1.5 hover:bg-accent">
      {children}
    </button>
  );
}
