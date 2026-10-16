import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Paperclip,
  FileText,
  Menu,
  X,
  Users,
  Hash,
  Volume2,
  Mic,
  MicOff,
  PhoneOff,
  LogOut,
  Pencil,
  Send,
  ShieldCheck,
  Search,
  Smile,
  ChevronDown,
  ChevronRight,
  PanelRightClose,
  Settings2,
  LoaderCircle,
  Palette,
  CornerUpLeft,
  Bookmark,
  Star,
  Vote,
  MessageSquareText,
  SlidersHorizontal,
  Bell,
  CheckCheck,
  AtSign,
  MessageCircle,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useVoice } from "@/hooks/useVoice";
import { useServerFn } from "@tanstack/react-start";
import { checkIn, banUser, unbanUser } from "@/lib/accounts.functions";
import { getIdentity } from "@/lib/device";
import { uploadAttachment } from "@/lib/media";
import {
  Avatar,
  EditProfile,
  ViewProfile,
  LEGACY_PROFILE_COLS,
  PROFILE_COLS,
  nameOf,
  readProfileExtrasCache,
  type Profile,
} from "./ProfileDialogs";
import { MessageText } from "./MessageText";
import { AppPreferencesDialog } from "./AppPreferences";
import { SavedMessagesDialog, useCommunityTools } from "./CommunityTools";
import { SocialCenter } from "./SocialCenter";
import { CommunityHub } from "./CommunityHub";
import { MessageThreadDialog } from "./MessageThreadDialog";
import { MessageSearchDialog } from "./MessageSearchDialog";

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
  reply_to?: string | null;
  edited_at?: string | null;
};
type MessageReaction = { message_id: string; user_id: string; reaction: string; created_at?: string };
type ActivityNotification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  kind: "mention" | "reply" | "friend_request" | "direct_message";
  title: string;
  body: string;
  channel_id: string | null;
  message_id: string | null;
  conversation_id: string | null;
  created_at: string;
  read_at: string | null;
};

const HELP = [
  "/limpar — apaga todas as mensagens deste canal",
  "/timeout nick minutos — silencia alguém",
  "/untimeout nick — tira o silêncio",
  "/ban nick motivo — bane a pessoa",
  "/unban nick — desbane",
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
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [channelSearch, setChannelSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [online, setOnline] = useState<string[]>([]);
  const [viewing, setViewing] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [mobileMembersOpen, setMobileMembersOpen] = useState(false);
  const [membersCollapsed, setMembersCollapsed] = useState(false);
  const [membersPreferenceUser, setMembersPreferenceUser] = useState<string | null>(null);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [savedMessagesOpen, setSavedMessagesOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(false);
  const [threadRoot, setThreadRoot] = useState<Message | null>(null);
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState<Message | null>(null);
  const [searchJumpVersion, setSearchJumpVersion] = useState(0);
  const [searchReadyId, setSearchReadyId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [mutedUntil, setMutedUntil] = useState<Date | null>(null);
  const [, tick] = useState(0);
  const voice = useVoice(userId);
  const [status, setStatus] = useState<{
    isAdmin: boolean;
    banned: boolean;
    reason: string | null;
  } | null>(null);
  const [bannedIds, setBannedIds] = useState<string[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [activityNotifications, setActivityNotifications] = useState<ActivityNotification[]>([]);
  const [notificationsUnavailable, setNotificationsUnavailable] = useState(false);
  const channelSearchRef = useRef<HTMLInputElement>(null);
  const checkInFn = useServerFn(checkIn);
  const banFn = useServerFn(banUser);
  const unbanFn = useServerFn(unbanUser);
  const communityTools = useCommunityTools(userId);
  const unreadTotal = Object.values(unread).reduce((sum, count) => sum + count, 0);
  const pendingNotificationCount = activityNotifications.filter((item) => !item.read_at).length;
  const activityTotal = unreadTotal + pendingNotificationCount;

  const loadActivityNotifications = useCallback(async () => {
    const { data, error } = await supabase
      .from("user_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) {
      setNotificationsUnavailable(error.code === "42P01" || error.code === "PGRST205");
      return;
    }
    setNotificationsUnavailable(false);
    setActivityNotifications((data ?? []) as ActivityNotification[]);
  }, []);

  useEffect(() => {
    try {
      setMembersCollapsed(window.localStorage.getItem(`calvosfera:members-collapsed:${userId}`) === "true");
    } catch {
      // Keep the member panel available when browser storage is unavailable.
    }
    setMembersPreferenceUser(userId);
  }, [userId]);

  useEffect(() => {
    if (membersPreferenceUser !== userId) return;
    try {
      window.localStorage.setItem(`calvosfera:members-collapsed:${userId}`, String(membersCollapsed));
    } catch {
      // The preference still applies until this page is closed.
    }
  }, [membersCollapsed, membersPreferenceUser, userId]);

  messagesRef.current = messages;

  const navigateToChannel = (channelId: string) => {
    if (active) communityTools.saveDraft(active, text);
    setActive(channelId);
    setNavOpen(false);
  };

  useEffect(() => {
    if (active) setText(communityTools.readDraft(active));
  }, [active, communityTools.readDraft]);

  useEffect(() => {
    if (active) communityTools.saveDraft(active, text);
  }, [active, text, communityTools.saveDraft]);

  useEffect(() => {
    getIdentity()
      .then((ident) => checkInFn({ data: ident }))
      .then((r) => {
        setStatus(r);
        if (r.isAdmin)
          supabase
            .from("bans")
            .select("user_id")
            .then(({ data }) => setBannedIds((data ?? []).map((b) => b.user_id)));
      })
      .catch(() => setStatus({ isAdmin: false, banned: false, reason: null }));
  }, [userId, checkInFn]);

  useEffect(() => {
    const key = `calvosfera:unread:${userId}`;
    try {
      const stored = JSON.parse(window.localStorage.getItem(key) ?? "{}");
      if (stored && typeof stored === "object" && !Array.isArray(stored)) {
        const counts = Object.fromEntries(
          Object.entries(stored).filter(
            (entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] > 0,
          ),
        );
        setUnread(counts);
      }
    } catch {
      // Ignore corrupt or unavailable local storage.
    }
  }, [userId]);

  useEffect(() => {
    void loadActivityNotifications();
    const channel = supabase
      .channel(`user-notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_notifications", filter: `user_id=eq.${userId}` },
        () => void loadActivityNotifications(),
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadActivityNotifications, userId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!active) return;
    setUnread((current) => {
      if (!current[active]) return current;
      const next = { ...current };
      delete next[active];
      try {
        window.localStorage.setItem(`calvosfera:unread:${userId}`, JSON.stringify(next));
      } catch {
        // Unread counts still work for this session when storage is unavailable.
      }
      return next;
    });
  }, [active, userId]);

  useEffect(() => {
    const channel = supabase
      .channel(`unread-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const message = payload.new as Message;
          if (!message.channel_id || message.channel_id === active || message.user_id === userId)
            return;
          setUnread((current) => {
            const next = {
              ...current,
              [message.channel_id]: (current[message.channel_id] ?? 0) + 1,
            };
            try {
              window.localStorage.setItem(`calvosfera:unread:${userId}`, JSON.stringify(next));
            } catch {
              // Unread counts still work for this session when storage is unavailable.
            }
            return next;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [active, userId]);

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

  async function markAllActivityRead() {
    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from("user_notifications")
      .update({ read_at: readAt })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) toast.error(`Não foi possível marcar os avisos como lidos: ${error.message}`);
    else setActivityNotifications((items) => items.map((item) => ({ ...item, read_at: item.read_at ?? readAt })));
    setUnread({});
    try {
      window.localStorage.setItem(`calvosfera:unread:${userId}`, "{}");
    } catch {
      // The channel counts remain cleared for this session.
    }
  }

  async function openActivityNotification(notification: ActivityNotification) {
    if (!notification.read_at) {
      const readAt = new Date().toISOString();
      const { error } = await supabase
        .from("user_notifications")
        .update({ read_at: readAt })
        .eq("id", notification.id)
        .eq("user_id", userId);
      if (error) toast.error(`Não foi possível marcar o aviso como lido: ${error.message}`);
      else setActivityNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, read_at: readAt } : item));
    }

    if (notification.message_id) {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("id", notification.message_id)
        .maybeSingle();
      if (error) toast.error(`Não foi possível abrir a mensagem: ${error.message}`);
      if (data) {
        setSearchTarget(data as Message);
        setSearchReadyId(null);
        setSearchJumpVersion((version) => version + 1);
        navigateToChannel(data.channel_id);
        return;
      }
    }

    if (notification.channel_id) navigateToChannel(notification.channel_id);
    if (notification.kind === "friend_request" || notification.conversation_id) setSocialOpen(true);
  }

  const loadProfiles = async () => {
    const primary = await supabase.from("profiles").select(PROFILE_COLS);
    let data: Profile[] | null = primary.data;
    let error = primary.error;
    if (error) {
      const fallback = await supabase.from("profiles").select(LEGACY_PROFILE_COLS);
      data =
        fallback.data?.map((profile) => ({
          ...profile,
          profile_extras: readProfileExtrasCache(profile.id) ?? null,
        })) ?? null;
      error = fallback.error;
    }
    if (error) {
      toast.error(`Não foi possível carregar os perfis: ${error.message}`);
      return;
    }
    if (data) {
      setProfiles(Object.fromEntries(data.map((profile) => [profile.id, profile])));
    }
  };

  const loadChannels = async () => {
    const { data, error } = await supabase.from("channels").select("*").order("position");
    if (error) {
      toast.error(`Não foi possível carregar os canais: ${error.message}`);
      return;
    }
    if (!data) return;
    setChannels(data);
    setActive((a) =>
      a && data.some((c) => c.id === a) ? a : (data.find((c) => c.kind === "text")?.id ?? null),
    );
  };

  const loadTimeout = useCallback(async () => {
    const { data } = await supabase
      .from("timeouts")
      .select("until")
      .eq("user_id", userId)
      .maybeSingle();
    setMutedUntil(data && new Date(data.until) > new Date() ? new Date(data.until) : null);
  }, [userId]);

  useEffect(() => {
    loadChannels();
    loadTimeout();
    loadProfiles();
    const t = setInterval(() => tick((n) => n + 1), 15000);
    const rt = supabase
      .channel("server-state")
      .on("postgres_changes", { event: "*", schema: "public", table: "channels" }, () =>
        loadChannels(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "timeouts" }, () =>
        loadTimeout(),
      )
      .subscribe();
    return () => {
      clearInterval(t);
      supabase.removeChannel(rt);
    };
  }, [userId, loadTimeout]);

  useEffect(() => {
    const ch = supabase.channel("online", { config: { presence: { key: userId } } });
    ch.on("presence", { event: "sync" }, () => setOnline(Object.keys(ch.presenceState())))
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
        const row = payload.new as Profile;
        if (row?.id) setProfiles((all) => ({ ...all, [row.id]: row }));
      })
      .subscribe((s) => {
        if (s === "SUBSCRIBED" && profiles[userId] && profiles[userId]?.status !== "invisible") {
          ch.track({ at: Date.now() });
        }
      });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, profiles[userId]?.status]);

  useEffect(() => {
    if (!active) {
      setMessages([]);
      setReactions([]);
      setLoadingMsgs(false);
      return;
    }
    let cancelled = false;
    setMessages([]);
    setReactions([]);
    setLoadingMsgs(true);
    void (async () => {
      try {
        let data: Message[] | null;
        let error;
        if (searchTarget?.channel_id === active) {
          const [before, after] = await Promise.all([
            supabase.from("messages").select("*").eq("channel_id", active).lt("created_at", searchTarget.created_at).order("created_at", { ascending: false }).limit(40),
            supabase.from("messages").select("*").eq("channel_id", active).gte("created_at", searchTarget.created_at).order("created_at", { ascending: true }).limit(41),
          ]);
          error = before.error ?? after.error;
          data = error ? null : [...(before.data ?? []).reverse(), ...(after.data ?? [])] as Message[];
        } else {
          const result = await supabase
            .from("messages")
            .select("*")
            .eq("channel_id", active)
            .order("created_at", { ascending: false })
            .limit(100);
          data = result.data;
          error = result.error;
        }
        if (cancelled) return;
        if (error) {
          toast.error(`Não foi possível carregar as mensagens: ${error.message}`);
          setLoadingMsgs(false);
          return;
        }
        if (data) {
          setMessages(searchTarget?.channel_id === active ? data : data.reverse());
          const messageIds = data.map((message) => message.id);
          if (messageIds.length > 0) {
            const { data: reactionData } = await supabase
              .from("message_reactions")
              .select("message_id,user_id,reaction,created_at")
              .in("message_id", messageIds);
            if (!cancelled && reactionData) setReactions(reactionData);
          }
          if (searchTarget?.channel_id === active) {
            if (data.some((message) => message.id === searchTarget.id)) setSearchReadyId(searchTarget.id);
            else {
              toast.error("Essa mensagem não está mais disponível neste canal.");
              setSearchTarget(null);
            }
          }
        }
        setLoadingMsgs(false);
      } catch (error) {
        if (cancelled) return;
        toast.error(
          `Não foi possível carregar as mensagens: ${error instanceof Error ? error.message : "erro inesperado"}`,
        );
        setLoadingMsgs(false);
      }
    })();
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
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          const id = (payload.old as { id: string }).id;
          setMessages((prev) => prev.filter((x) => x.id !== id));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `channel_id=eq.${active}` },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) =>
            prev.map((message) => (message.id === updated.id ? updated : message)),
          );
        },
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_reactions" }, (payload) => {
        const reaction = payload.new as MessageReaction;
        if (messagesRef.current.some((message) => message.id === reaction.message_id)) {
          setReactions((current) => current.some((item) => item.message_id === reaction.message_id && item.user_id === reaction.user_id && item.reaction === reaction.reaction) ? current : [...current, reaction]);
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "message_reactions" }, (payload) => {
        const reaction = payload.old as MessageReaction;
        setReactions((current) => current.filter((item) => !(item.message_id === reaction.message_id && item.user_id === reaction.user_id && item.reaction === reaction.reaction)));
      })
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [active, searchJumpVersion]);

  useEffect(() => {
    if (searchTarget && searchReadyId === searchTarget.id && active === searchTarget.channel_id) {
      if (!messages.some((message) => message.id === searchTarget.id)) return;
      document.getElementById(`message-${searchTarget.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setSearchTarget(null);
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, searchTarget, searchReadyId, active]);

  useEffect(() => {
    if (voice.error) toast.error(voice.error);
  }, [voice.error]);

  const findUser = (nick?: string) =>
    Object.values(profiles).find(
      (p) => p.username.toLowerCase() === (nick ?? "").replace(/^@/, "").toLowerCase(),
    );

  async function runCommand(raw: string) {
    const [cmd = "", ...args] = raw.slice(1).split(/\s+/);
    if (!status?.isAdmin) return toast.error("Só o admin pode usar comandos");
    const err = (m: string) => toast.error(m);
    switch (cmd.toLowerCase()) {
      case "ajuda":
      case "help":
        return toast(HELP.join("\n"), { duration: 12000 });
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
        const { error } = await supabase
          .from("timeouts")
          .upsert({ user_id: u.id, until, created_by: userId });
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
        const c = channels.find(
          (x) => x.kind === "voice" && x.name.toLowerCase() === args.join("-").toLowerCase(),
        );
        return c ? deleteChannel(c) : err("Call não encontrada");
      }
      default:
        return err("Comando desconhecido. Use /ajuda");
    }
  }

  async function createChannel(kind: "text" | "voice", rawName?: string) {
    const name = (
      rawName ||
      (window.prompt(kind === "text" ? "Nome do novo canal" : "Nome da nova call") ?? "")
    )
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
    if (!window.confirm(`Apagar ${c.kind === "text" ? "#" : ""}${c.name}? Tudo nele será perdido.`))
      return;
    if (voice.channelId === c.id) voice.leave();
    const { error } = await supabase.from("channels").delete().eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await loadChannels();
  }

  async function deleteMessage(messageId: string) {
    const { error } = await supabase.from("messages").delete().eq("id", messageId);
    if (error) {
      toast.error(`Não foi possível apagar a mensagem: ${error.message}`);
      return;
    }
    setMessages((current) => current.filter((message) => message.id !== messageId));
  }

  async function toggleReaction(messageId: string, reaction: string) {
    const existing = reactions.find((item) => item.message_id === messageId && item.user_id === userId && item.reaction === reaction);
    const result = existing
      ? await supabase.from("message_reactions").delete().eq("message_id", messageId).eq("user_id", userId).eq("reaction", reaction)
      : await supabase.from("message_reactions").insert({ message_id: messageId, user_id: userId, reaction });
    if (result.error) {
      toast.error(result.error.code === "42P01" || result.error.code === "PGRST205" ? "Aplique a migração 0010_message_reactions.sql para ativar reações." : `Não foi possível reagir: ${result.error.message}`);
      return;
    }
    setReactions((current) => existing
      ? current.filter((item) => !(item.message_id === messageId && item.user_id === userId && item.reaction === reaction))
      : [...current, { message_id: messageId, user_id: userId, reaction }]);
  }

  async function saveMessageEdit(messageId: string) {
    const content = editingContent.trim();
    if (!content) return;
    const { data, error } = await supabase
      .from("messages")
      .update({ content: content.slice(0, 2000), edited_at: new Date().toISOString() })
      .eq("id", messageId)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) {
      toast.error(`Não foi possível editar: ${error.message}`);
      return;
    }
    setMessages((prev) =>
      prev.map((message) => (message.id === messageId ? (data as Message) : message)),
    );
    setEditingMessageId(null);
    setEditingContent("");
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
          reply_to: replyingTo?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      setText("");
      setPendingFile(null);
      setReplyingTo(null);
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
  const favoriteChannels = channels.filter((channel) =>
    communityTools.favoriteIds.includes(channel.id),
  );
  const sortedMembers = useMemo(
    () =>
      Object.values(profiles).sort(
        (a, b) =>
          Number(online.includes(b.id)) - Number(online.includes(a.id)) ||
          a.username.localeCompare(b.username),
      ),
    [profiles, online],
  );
  const onlineMembers = sortedMembers.filter((p) => online.includes(p.id));
  const offlineMembers = sortedMembers.filter((p) => !online.includes(p.id));
  const profilesByUsername = useMemo(
    () => Object.fromEntries(Object.values(profiles).map((p) => [p.username.toLowerCase(), p])),
    [profiles],
  );
  const visibleMessages = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return messages;
    return messages.filter((message) =>
      `${message.content} ${nameOf(profiles[message.user_id])} ${message.attachment_name ?? ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [messages, profiles, search]);
  const visibleChannels = useMemo(() => {
    const query = channelSearch.trim().toLocaleLowerCase("pt-BR");
    return query
      ? channels.filter((channel) => channel.name.toLocaleLowerCase("pt-BR").includes(query))
      : channels;
  }, [channels, channelSearch]);

  if (status?.banned) {
    return (
      <div className="flex h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl">Você foi banido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {status.reason || "O admin removeu seu acesso à Calvosfera."}
          </p>
          <Button
            variant="ghost"
            onClick={() => supabase.auth.signOut()}
            className="mt-6 text-sm text-primary hover:underline"
          >
            Sair
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-workspace flex h-dvh min-h-0 overflow-hidden text-foreground">
      {/* Channels */}
      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-scrim backdrop-blur-sm md:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}
      <aside className="server-rail hidden w-[64px] shrink-0 flex-col items-center gap-3 border-r border-border py-3 md:flex">
        <div
          title="Calvosfera"
          aria-current="page"
          className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-lg font-extrabold text-primary-foreground shadow-lg shadow-primary/20 transition hover:rounded-xl"
        >
          <span className="absolute -left-[13px] h-8 rounded-r-full bg-foreground" />C
        </div>
      </aside>
      <aside
        className={`chat-sidebar fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r border-border transition-transform duration-150 md:static md:w-[248px] md:translate-x-0 ${navOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-[68px] items-center gap-3 border-b border-border px-4">
          <span className="auth-brand-mark flex h-9 w-9 items-center justify-center rounded-xl text-lg font-extrabold text-primary-foreground">
            C
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-bold text-foreground">Calvosfera</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              Comunidade · {online.length} online
            </span>
          </span>
          <Button
            variant="ghost"
            className="rounded p-1 text-muted-foreground hover:bg-accent md:hidden"
            onClick={() => setNavOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="channel-search-wrap px-3 pb-3 pt-4">
          <label className="channel-search flex h-9 items-center gap-2 rounded-lg px-2.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              ref={channelSearchRef}
              aria-label="Buscar canais"
              value={channelSearch}
              onChange={(event) => setChannelSearch(event.target.value)}
              placeholder="Buscar canal"
              className="h-full border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
            />
          </label>
          <div className="mt-3 flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex h-2 w-2 rounded-full bg-online" />
            </span>
            <span>
              {online.length} {online.length === 1 ? "pessoa online" : "pessoas online"}
            </span>
            <Button
              variant="ghost"
              onClick={() => setCommandOpen(true)}
              className="ml-auto h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
              aria-label="Abrir navegação rápida"
            >
              Ctrl K
            </Button>
          </div>
        </div>
        <nav
          aria-label="Canais da Calvosfera"
          className="channel-navigation flex-1 space-y-5 overflow-y-auto px-2.5 py-2"
        >
          <ChannelGroup title="Favoritos">
            {favoriteChannels.map((channel) => (
              <ChannelBtn
                key={`favorite-${channel.id}`}
                active={
                  channel.kind === "voice" ? channel.id === voice.channelId : channel.id === active
                }
                onClick={() =>
                  channel.kind === "voice" ? voice.join(channel.id) : navigateToChannel(channel.id)
                }
                isFavorite
                onToggleFavorite={() => communityTools.toggleFavorite(channel.id)}
                onDelete={status?.isAdmin ? () => deleteChannel(channel) : undefined}
              >
                {channel.kind === "voice" ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <Hash className="h-[18px] w-[18px]" />
                )}
                <span className="min-w-0 flex-1 truncate">{channel.name}</span>
              </ChannelBtn>
            ))}
            {favoriteChannels.length === 0 && (
              <p className="px-2 py-1 text-xs text-muted-foreground">
                Marque uma estrela para fixar um canal aqui.
              </p>
            )}
          </ChannelGroup>
          <ChannelGroup
            title="Canais de texto"
            onAdd={status?.isAdmin ? () => createChannel("text") : undefined}
          >
            {visibleChannels.filter((c) => c.kind === "text").length === 0 && (
              <p className="px-2 py-1 text-xs text-muted-foreground">
                {channelSearch ? "Nenhum canal encontrado" : "Nenhum canal ainda"}
              </p>
            )}
            {channels
              .filter(
                (c) =>
                  c.kind === "text" &&
                  visibleChannels.includes(c) &&
                  !communityTools.favoriteIds.includes(c.id),
              )
              .map((c) => (
                <ChannelBtn
                  key={c.id}
                  active={c.id === active}
                  unread={unread[c.id] ?? 0}
                  onClick={() => {
                    navigateToChannel(c.id);
                  }}
                  onDelete={status?.isAdmin ? () => deleteChannel(c) : undefined}
                  onToggleFavorite={() => communityTools.toggleFavorite(c.id)}
                >
                  <Hash className="h-[18px] w-[18px]" />{" "}
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                </ChannelBtn>
              ))}
          </ChannelGroup>
          <ChannelGroup
            title="Canais de voz"
            onAdd={status?.isAdmin ? () => createChannel("voice") : undefined}
          >
            {visibleChannels.filter((c) => c.kind === "voice").length === 0 && (
              <p className="px-2 py-1 text-xs text-muted-foreground">
                {channelSearch ? "Nenhum canal encontrado" : "Nenhum canal ainda"}
              </p>
            )}
            {channels
              .filter(
                (c) =>
                  c.kind === "voice" &&
                  visibleChannels.includes(c) &&
                  !communityTools.favoriteIds.includes(c.id),
              )
              .map((c) => (
                <div key={c.id}>
                  <ChannelBtn
                    active={c.id === voice.channelId}
                    onClick={() => voice.join(c.id)}
                    onDelete={status?.isAdmin ? () => deleteChannel(c) : undefined}
                    onToggleFavorite={() => communityTools.toggleFavorite(c.id)}
                  >
                    <Volume2 className="h-4 w-4" />{" "}
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  </ChannelBtn>
                  {c.id === voice.channelId && (
                    <div className="ml-7 mt-1 space-y-1 border-l border-border pl-2">
                      {[userId, ...voice.peers].map((id) => (
                        <div
                          key={id}
                          className="flex items-center gap-2 rounded px-1 py-1 text-xs text-muted-foreground"
                        >
                          <Avatar p={profiles[id]} size={20} />
                          <span className="truncate">{nameOf(profiles[id])}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </ChannelGroup>
        </nav>
        {voiceCh && (
          <div className="mx-2 mb-2 rounded-xl border border-online/20 bg-online/[0.07] p-3 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-online" />
              <p className="text-xs font-bold text-online">Conectado à voz</p>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{voiceCh.name}</span>
              <div className="flex gap-1">
                <IconBtn onClick={voice.toggleMute} label={voice.muted ? "Desmutar" : "Mutar"}>
                  {voice.muted ? (
                    <MicOff className="h-4 w-4 text-destructive" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </IconBtn>
                <IconBtn onClick={voice.leave} label="Sair da call">
                  <PhoneOff className="h-4 w-4 text-destructive" />
                </IconBtn>
              </div>
            </div>
          </div>
        )}
        <div className="current-user flex items-center gap-2 border-t border-border px-2.5 py-3">
          <Button
            variant="ghost"
            onClick={() => me && setViewing(me)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left transition hover:bg-accent"
          >
            <Avatar p={me} size={32} status={me?.status ?? "online"} />
            <span className="min-w-0">
              <span className="block truncate text-xs font-bold">{nameOf(me)}</span>
              <span className="block truncate text-[10px] text-muted-foreground">
                {status?.isAdmin ? "Administrador" : "Online"}
              </span>
            </span>
          </Button>
          <IconBtn onClick={() => setEditing(true)} label="Editar perfil">
            <Settings2 className="h-4 w-4" />
          </IconBtn>
          <IconBtn onClick={() => supabase.auth.signOut()} label="Sair">
            <LogOut className="h-4 w-4" />
          </IconBtn>
        </div>
      </aside>

      {/* Chat */}
      <main className="conversation-panel flex min-w-0 flex-1 flex-col bg-transparent">
        <header className="chat-topbar z-10 flex h-[60px] shrink-0 items-center gap-3 border-b border-border px-3 sm:px-5">
          <Button
            variant="ghost"
            className="-ml-1 rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground md:hidden"
            onClick={() => setNavOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          {activeCh?.kind === "voice" ? (
            <Volume2 className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
          ) : (
            <Hash className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              {activeCh?.name ?? "Canais"}
            </span>
            <span className="hidden truncate text-[11px] text-muted-foreground sm:block">
              {activeCh?.kind === "voice"
                ? "Canal de voz da comunidade"
                : "Converse com a comunidade Calvosfera"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <IconBtn onClick={() => setSocialOpen(true)} label="Amigos e mensagens privadas">
              <Users className="h-4 w-4" />
            </IconBtn>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={activityTotal ? `Atividade, ${activityTotal} avisos pendentes` : "Atividade"}
                  title="Atividade"
                  className="relative h-8 w-8 shrink-0 text-muted-foreground hover:bg-accent"
                >
                  <Bell className="h-4 w-4" />
                  {activityTotal > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-primary px-1 text-[9px] font-bold leading-4 text-primary-foreground">{activityTotal > 99 ? "99+" : activityTotal}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1rem))] p-0">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">Atividade</p>
                    <p className="text-xs text-muted-foreground">Menções, respostas e mensagens novas</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={activityTotal === 0}
                    onClick={() => void markAllActivityRead()}
                    className="h-8 gap-1.5 px-2 text-xs"
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> Limpar
                  </Button>
                </div>
                <div className="max-h-[min(28rem,65dvh)] overflow-y-auto p-2">
                  {notificationsUnavailable && (
                    <p className="m-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                      Avisos de menções, respostas, amizades e mensagens privadas precisam da migração <strong>0011_user_notifications</strong> no Supabase.
                    </p>
                  )}
                  {activityNotifications.length > 0 && <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Avisos pessoais</p>}
                  {activityNotifications.map((notification) => {
                    const NotificationIcon = notification.kind === "mention" ? AtSign : notification.kind === "reply" ? CornerUpLeft : notification.kind === "friend_request" ? UserPlus : MessageCircle;
                    return (
                      <Button
                        key={notification.id}
                        variant="ghost"
                        onClick={() => void openActivityNotification(notification)}
                        className={`h-auto w-full items-start justify-start gap-3 whitespace-normal px-3 py-2.5 text-left ${notification.read_at ? "" : "bg-primary/[0.06]"}`}
                      >
                        <NotificationIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{notification.title}</span>
                          <span className="mt-0.5 block line-clamp-2 text-xs font-normal text-muted-foreground">{notification.body || (notification.actor_id ? profiles[notification.actor_id]?.username : "")}</span>
                          <time className="mt-1 block text-[10px] font-normal text-muted-foreground">{new Date(notification.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</time>
                        </span>
                        {!notification.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Não lido" />}
                      </Button>
                    );
                  })}
                  {channels.some((channel) => (unread[channel.id] ?? 0) > 0) && <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Canais com mensagens novas</p>}
                  {channels.filter((channel) => (unread[channel.id] ?? 0) > 0).map((channel) => (
                    <Button key={channel.id} variant="ghost" onClick={() => navigateToChannel(channel.id)} className="h-auto w-full justify-start gap-3 px-3 py-2 text-left">
                      <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm">{channel.name}</span>
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">{unread[channel.id]}</span>
                    </Button>
                  ))}
                  {activityTotal === 0 && !notificationsUnavailable && <p className="px-3 py-8 text-center text-sm text-muted-foreground">Tudo em dia. Nenhuma atividade nova.</p>}
                </div>
              </PopoverContent>
            </Popover>
            <span className="hidden sm:inline-flex"><IconBtn onClick={() => setCommunityOpen(true)} label="Central da comunidade"><Vote className="h-4 w-4" /></IconBtn></span>
            <span className="hidden sm:inline-flex"><IconBtn onClick={() => setSavedMessagesOpen(true)} label="Mensagens salvas"><Bookmark className="h-4 w-4" /></IconBtn></span>
            <span className="hidden sm:inline-flex"><IconBtn onClick={() => setPreferencesOpen(true)} label="Aparência e preferências"><Palette className="h-4 w-4" /></IconBtn></span>
            <span className="hidden sm:inline-flex"><IconBtn onClick={() => setMessageSearchOpen(true)} label="Busca avançada de mensagens"><SlidersHorizontal className="h-4 w-4" /></IconBtn></span>
          </div>
          <IconBtn onClick={() => setSearchOpen((value) => !value)} label="Buscar mensagens">
            <Search className="h-4 w-4" />
          </IconBtn>
          <div className="ml-auto hidden items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground lg:flex">
            <Users className="h-3.5 w-3.5 text-online" />
            <span>{online.length} online</span>
          </div>
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex lg:hidden">
            <Users className="h-3.5 w-3.5 text-online" />
            {online.length}
          </span>
          {status?.isAdmin && (
            <span className="hidden items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary sm:inline-flex">
              <ShieldCheck className="h-3 w-3" /> Admin
            </span>
          )}
          <Button
            variant="ghost"
            onClick={() => setMembersCollapsed((collapsed) => !collapsed)}
            aria-label={membersCollapsed ? "Mostrar lista de membros" : "Ocultar lista de membros"}
            aria-expanded={!membersCollapsed}
            className="hidden rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground lg:inline-flex"
          >
            <PanelRightClose
              className={`h-4 w-4 transition-transform ${membersCollapsed ? "rotate-180" : ""}`}
            />
          </Button>
          <Button
            variant="ghost"
            onClick={() => setMobileMembersOpen((open) => !open)}
            aria-label={mobileMembersOpen ? "Fechar lista de membros" : "Abrir lista de membros"}
            aria-expanded={mobileMembersOpen}
            className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground lg:hidden"
          >
            <Users className="h-4 w-4" />
          </Button>
        </header>
        {searchOpen && (
          <div className="flex items-center gap-3 border-b border-border bg-panel px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              aria-label="Buscar nas mensagens carregadas"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nas últimas 100 mensagens"
              className="h-9 bg-panel"
              autoFocus
            />
            <IconBtn
              onClick={() => {
                setSearch("");
                setSearchOpen(false);
              }}
              label="Fechar busca"
            >
              <X className="h-4 w-4" />
            </IconBtn>
          </div>
        )}
        <div className="message-stream min-h-0 flex-1 overflow-y-auto px-2 py-5 sm:px-5 xl:px-8">
          {loadingMsgs && (
            <div role="status" aria-label="Carregando mensagens" className="space-y-6 px-3 py-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-muted" />
                  <div className="flex-1 space-y-3">
                    <div className="h-3 w-28 rounded bg-muted" />
                    <div className="h-3 w-3/4 rounded bg-muted" />
                    <div className="h-3 w-1/2 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loadingMsgs && messages.length === 0 && !search.trim() && (
            <div className="mx-2 mt-8 max-w-xl pt-6 sm:mx-4">
              {active ? (
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-3xl text-primary ring-1 ring-primary/20">
                  <Hash className="h-7 w-7" />
                </div>
              ) : null}
              <p className="break-words font-sans text-2xl font-extrabold leading-tight sm:text-3xl">
                {activeCh ? `Boas-vindas a #${activeCh.name}` : "Nenhum canal disponível"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {activeCh
                  ? "Este é o começo do canal. Mande uma mensagem para iniciar a conversa."
                  : "Ainda não há canais para conversar. Tente novamente mais tarde."}
              </p>
              {activeCh && (
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    onClick={() => composerRef.current?.focus()}
                    className="rounded-xl font-semibold shadow-lg shadow-primary/15"
                  >
                    <Pencil className="mr-2 h-4 w-4" /> Começar uma conversa
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setMembersCollapsed(false);
                      setMobileMembersOpen(true);
                    }}
                    className="rounded-xl border-border bg-card/70"
                  >
                    <Users className="mr-2 h-4 w-4" /> Conhecer a comunidade
                  </Button>
                </div>
              )}
            </div>
          )}
          {!loadingMsgs && search.trim() && visibleMessages.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma mensagem encontrada.
            </p>
          )}
          {visibleMessages.map((m, i) => {
            const p = profiles[m.user_id];
            const isMine = m.user_id === userId;
            const messageReactions = reactions.filter((reaction) => reaction.message_id === m.id);
            const reactionCounts = Array.from(new Set(messageReactions.map((reaction) => reaction.reaction))).map((reaction) => ({
              reaction,
              count: messageReactions.filter((item) => item.reaction === reaction).length,
              mine: messageReactions.some((item) => item.user_id === userId && item.reaction === reaction),
            }));
            const previous = visibleMessages[i - 1];
            const messageDate = new Date(m.created_at);
            const previousDate = previous ? new Date(previous.created_at) : null;
            const showDate =
              !previous || messageDate.toDateString() !== previousDate?.toDateString();
            const grouped =
              !!previous &&
              previous.user_id === m.user_id &&
              messageDate.toDateString() === previousDate?.toDateString() &&
              messageDate.getTime() - previousDate.getTime() < 5 * 60 * 1000;
            return (
              <Fragment key={m.id}>
                {showDate && (
                  <div className="mx-auto my-5 flex w-full max-w-[1100px] items-center gap-3 px-2 text-[11px] font-semibold text-muted-foreground/80">
                    <span className="h-px flex-1 bg-border" />
                    <span>
                      {messageDate.toLocaleDateString("pt-BR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                )}
                <div
                  id={`message-${m.id}`}
                  className={`message-row group relative mx-auto flex w-full max-w-[920px] gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/45 sm:px-3 ${isMine ? "justify-end" : ""} ${grouped ? "" : "mt-3"}`}
                >
                  <div className={`w-9 shrink-0 ${isMine ? "order-2" : ""}`}>
                    {!grouped && (
                      <Button
                        variant="ghost"
                        onClick={() => p && setViewing(p)}
                        className="h-9 w-9 p-0"
                        aria-label={`Ver perfil de ${nameOf(p)}`}
                      >
                        <Avatar p={p} size={36} />
                      </Button>
                    )}
                  </div>
                  <div
                    className={`min-w-0 ${isMine ? "order-1 max-w-[82%] text-right" : "flex-1"}`}
                  >
                    {!grouped && (
                      <div
                        className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${isMine ? "justify-end" : ""}`}
                      >
                        <Button
                          variant="ghost"
                          onClick={() => p && setViewing(p)}
                          className="h-auto px-0 py-0 text-sm font-semibold text-foreground hover:bg-transparent hover:underline"
                        >
                          {nameOf(p)}
                        </Button>
                        {p?.display_name?.trim() && (
                          <span className="hidden text-xs text-muted-foreground sm:inline">
                            @{p.username}
                          </span>
                        )}
                        <span className="message-timestamp text-[11px] text-muted-foreground">
                          {messageDate.toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    )}
                    {m.reply_to && (
                      <div
                        className={`mb-1 max-w-full truncate border-l-2 border-primary/60 px-2 py-1 text-left text-xs text-muted-foreground ${isMine ? "ml-auto" : ""}`}
                      >
                        <CornerUpLeft className="mr-1 inline h-3 w-3" />
                        {(() => {
                          const source = messages.find((item) => item.id === m.reply_to);
                          return source
                            ? `Resposta a ${nameOf(profiles[source.user_id])}: ${source.content.slice(0, 120)}`
                            : "Resposta a uma mensagem anterior";
                        })()}
                      </div>
                    )}
                    {editingMessageId === m.id ? (
                      <div className="space-y-2">
                        <textarea
                          autoFocus
                          value={editingContent}
                          onChange={(event) => setEditingContent(event.target.value)}
                          maxLength={2000}
                          className="min-h-20 w-full resize-y rounded-lg border border-input bg-background p-2 text-sm"
                          aria-label="Editar mensagem"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingMessageId(null)}
                          >
                            Cancelar
                          </Button>
                          <Button size="sm" onClick={() => void saveMessageEdit(m.id)}>
                            Salvar
                          </Button>
                        </div>
                      </div>
                    ) : IMG_RE.test(m.content) ? (
                      <img
                        src={m.content}
                        alt=""
                        className="mt-1 max-h-72 max-w-full rounded-lg border border-border"
                        loading="lazy"
                      />
                    ) : (
                      m.content && (
                        <p
                          className={`message-content whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90 [&_a]:break-all ${isMine ? "message-own-bubble" : ""}`}
                        >
                          <MessageText
                            text={m.content}
                            byName={profilesByUsername}
                            onMention={setViewing}
                          />
                        </p>
                      )
                    )}
                    {m.edited_at && (
                      <span className="ml-1 text-[10px] text-muted-foreground">(editada)</span>
                    )}
                    {m.attachment_url && <Attachment m={m} />}
                    <div className={`mt-1 flex flex-wrap items-center gap-1 ${isMine ? "justify-end" : ""}`}>
                      {reactionCounts.map(({ reaction, count, mine }) => (
                        <Button key={reaction} variant="outline" size="sm" onClick={() => void toggleReaction(m.id, reaction)} aria-pressed={mine} aria-label={`${count} reação ${reaction}${mine ? ", sua reação" : ""}`} className={`h-7 gap-1 rounded-full px-2 text-xs ${mine ? "border-primary bg-primary/10 text-primary" : "border-border bg-card"}`}>
                          <span>{reaction}</span><span>{count}</span>
                        </Button>
                      ))}
                      <Popover>
                        <PopoverTrigger asChild><Button variant="ghost" size="icon" aria-label="Adicionar reação" className="h-7 w-7 text-muted-foreground"><Smile className="h-4 w-4" /></Button></PopoverTrigger>
                        <PopoverContent align={isMine ? "end" : "start"} className="w-52 p-2"><div className="grid grid-cols-5 gap-1">{["👍", "❤️", "😂", "😮", "🎉"].map((reaction) => <Button key={reaction} variant="ghost" size="icon" aria-label={`Reagir ${reaction}`} className="text-lg" onClick={() => void toggleReaction(m.id, reaction)}>{reaction}</Button>)}</div></PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div
                    className="message-actions absolute right-3 top-0 z-20 flex items-center gap-0.5 rounded-lg border border-border bg-popover p-0.5 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 focus-within:opacity-100"
                  >
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setReplyingTo(m);
                        composerRef.current?.focus();
                      }}
                      className="h-8 w-8 p-1 text-muted-foreground"
                      aria-label="Responder mensagem"
                    >
                      <CornerUpLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setThreadRoot(m.reply_to ? messages.find((item) => item.id === m.reply_to) ?? m : m)}
                      className="h-8 w-8 p-1 text-muted-foreground"
                      aria-label={`Abrir thread${messages.filter((item) => item.reply_to === m.id).length ? `, ${messages.filter((item) => item.reply_to === m.id).length} respostas` : ""}`}
                      title="Abrir thread"
                    >
                      <MessageSquareText className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => communityTools.toggleSavedMessage(m)}
                      className={`h-8 w-8 p-1 ${communityTools.savedMessages.some((saved) => saved.id === m.id) ? "text-primary" : "text-muted-foreground"}`}
                      aria-label={
                        communityTools.savedMessages.some((saved) => saved.id === m.id)
                          ? "Remover mensagem salva"
                          : "Salvar mensagem"
                      }
                    >
                      <Bookmark className="h-4 w-4" />
                    </Button>
                    {isMine && (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditingMessageId(m.id);
                          setEditingContent(m.content);
                        }}
                        className="h-8 w-8 p-1 text-muted-foreground"
                        aria-label="Editar mensagem"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {(m.user_id === userId || status?.isAdmin) && (
                      <Button
                        variant="ghost"
                        onClick={() => void deleteMessage(m.id)}
                        className="h-8 w-8 p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Apagar mensagem"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Fragment>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <form
          onSubmit={send}
          className="message-compose mx-auto w-full max-w-[920px] shrink-0 px-3 pb-5 pt-2 sm:px-5 xl:px-8"
        >
          {replyingTo && (
            <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-border bg-panel px-3 py-2 text-xs">
              <span className="truncate text-muted-foreground">
                Respondendo a{" "}
                <strong className="text-foreground">{nameOf(profiles[replyingTo.user_id])}</strong>:{" "}
                {replyingTo.content.slice(0, 100) || "anexo"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setReplyingTo(null)}
                aria-label="Cancelar resposta"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {pendingFile && (
            <div className="mb-2 flex items-center gap-2 rounded-md bg-card px-3 py-2 text-sm">
              <FileText className="h-4 w-4 text-primary" />
              <span className="truncate">{pendingFile.name}</span>
              <span className="text-xs text-muted-foreground">
                {(pendingFile.size / 1024 / 1024).toFixed(1)} MB
              </span>
              <Button
                variant="ghost"
                type="button"
                onClick={() => setPendingFile(null)}
                className="ml-auto rounded p-1 hover:bg-accent"
                aria-label="Remover arquivo"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {mutedUntil ? (
            <div className="rounded-lg bg-card px-4 py-3 text-sm text-muted-foreground">
              Você está em timeout até{" "}
              {mutedUntil.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-panel px-3 py-2.5 shadow-lg shadow-black/10 transition-colors focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20">
              <Button
                variant="ghost"
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded p-1 text-muted-foreground transition hover:text-foreground"
                aria-label="Anexar arquivo"
              >
                <Paperclip className="h-5 w-5" />
              </Button>
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
              <textarea
                ref={composerRef}
                rows={1}
                aria-label="Mensagem"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onPaste={(e) => {
                  const f = e.clipboardData.files?.[0];
                  if (f) setPendingFile(f);
                }}
                placeholder={
                  status?.isAdmin
                    ? `Conversar em #${activeCh?.name ?? ""} — /ajuda para comandos`
                    : `Conversar em #${activeCh?.name ?? ""}`
                }
                className="min-w-0 flex-1 resize-none bg-transparent py-1 text-sm leading-6 outline-none placeholder:text-muted-foreground"
                maxLength={2000}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Escolher emoji"
                    title="Escolher emoji"
                    className="shrink-0 text-muted-foreground"
                  >
                    <Smile className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-3">
                  <div className="grid grid-cols-6 gap-1">
                    {[
                      "😀",
                      "😂",
                      "🥹",
                      "😍",
                      "😎",
                      "😭",
                      "❤️",
                      "🔥",
                      "✨",
                      "🎉",
                      "👍",
                      "💀",
                      "🌸",
                      "🎮",
                      "🍜",
                      "👀",
                      "🤝",
                      "💚",
                    ].map((emoji) => (
                      <Button
                        key={emoji}
                        variant="ghost"
                        size="icon"
                        aria-label={`Inserir ${emoji}`}
                        className="text-xl"
                        onClick={() => {
                          setText((value) => (value + emoji).slice(0, 2000));
                          composerRef.current?.focus();
                        }}
                      >
                        {emoji}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                variant="ghost"
                type="submit"
                disabled={sending || !active || (!text.trim() && !pendingFile)}
                className="h-9 w-9 shrink-0 p-1 text-primary transition disabled:text-muted-foreground"
                aria-label="Enviar"
              >
                {sending ? (
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          )}
        </form>
      </main>

      {/* Members */}
      {mobileMembersOpen && (
        <div
          className="fixed inset-0 z-30 bg-scrim backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMembersOpen(false)}
        />
      )}
      <aside
        className={`members-sidebar ${mobileMembersOpen ? "fixed inset-y-0 right-0 z-40 shadow-xl" : "hidden"} ${membersCollapsed ? "lg:hidden" : "lg:static lg:block lg:shadow-none"} w-72 shrink-0 overflow-y-auto border-l border-border px-3 py-4 lg:w-[224px]`}
      >
        <div className="members-heading mb-4 flex h-9 items-center justify-between rounded-lg px-2">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Membros · {onlineMembers.length + offlineMembers.length}
          </span>
          <Button
            variant="ghost"
            onClick={() => setMobileMembersOpen(false)}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
            aria-label="Fechar lista de membros"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <MemberGroup
          title={`Online — ${onlineMembers.length}`}
          members={onlineMembers}
          online={online}
          bannedIds={bannedIds}
          onSelect={(p) => {
            setViewing(p);
            setMobileMembersOpen(false);
          }}
        />
        <MemberGroup
          title={`Offline — ${offlineMembers.length}`}
          members={offlineMembers}
          online={online}
          bannedIds={bannedIds}
          onSelect={(p) => {
            setViewing(p);
            setMobileMembersOpen(false);
          }}
        />
      </aside>

      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Buscar canal, pessoa ou ação..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          {channels.length > 0 && (
            <CommandGroup heading="Ir para canal">
              {channels.map((channel) => (
                <CommandItem
                  key={channel.id}
                  value={`${channel.name} ${channel.kind}`}
                  onSelect={() => {
                    if (channel.kind === "voice") voice.join(channel.id);
                    else navigateToChannel(channel.id);
                    setNavOpen(false);
                    setCommandOpen(false);
                  }}
                >
                  {channel.kind === "voice" ? <Volume2 /> : <Hash />}
                  <span>{channel.name}</span>
                  <CommandShortcut>{channel.kind === "voice" ? "Voz" : "Texto"}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading="Ações rápidas">
            <CommandItem
              onSelect={() => {
                setSocialOpen(true);
                setCommandOpen(false);
              }}
            >
              <Users /> Amigos e mensagens privadas
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setPreferencesOpen(true);
                setCommandOpen(false);
              }}
            >
              <Palette /> Aparência e preferências
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setSearchOpen(true);
                setCommandOpen(false);
              }}
            >
              <Search /> Buscar mensagens <CommandShortcut>Canal atual</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => { setCommunityOpen(true); setCommandOpen(false); }}>
              <Vote /> Central da comunidade
            </CommandItem>
            <CommandItem onSelect={() => { setSavedMessagesOpen(true); setCommandOpen(false); }}>
              <Bookmark /> Mensagens salvas
            </CommandItem>
            <CommandItem onSelect={() => { setMessageSearchOpen(true); setCommandOpen(false); }}>
              <SlidersHorizontal /> Busca avançada de mensagens
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                window.setTimeout(() => composerRef.current?.focus(), 0);
              }}
            >
              <Pencil /> Escrever mensagem
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setMembersCollapsed(false);
                setMobileMembersOpen(true);
                setCommandOpen(false);
              }}
            >
              <Users /> Ver membros
            </CommandItem>
            {me && (
              <CommandItem
                onSelect={() => {
                  setEditing(true);
                  setCommandOpen(false);
                }}
              >
                <Settings2 /> Editar meu perfil
              </CommandItem>
            )}
            {voice.channelId && (
              <CommandItem
                onSelect={() => {
                  voice.leave();
                  setCommandOpen(false);
                }}
              >
                <PhoneOff /> Sair da chamada
              </CommandItem>
            )}
          </CommandGroup>
          {sortedMembers.length > 0 && (
            <CommandGroup heading="Pessoas">
              {sortedMembers.map((profile) => (
                <CommandItem
                  key={profile.id}
                  value={`${nameOf(profile)} ${profile.username}`}
                  onSelect={() => {
                    setViewing(profile);
                    setCommandOpen(false);
                  }}
                >
                  <Users /> {nameOf(profile)}
                  <CommandShortcut>
                    {online.includes(profile.id) ? "Online" : "Offline"}
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>

      <ViewProfile
        status={viewing && online.includes(viewing.id) ? (viewing.status ?? "online") : "invisible"}
        p={viewing}
        onClose={() => setViewing(null)}
        actions={
          status?.isAdmin && viewing && viewing.id !== userId ? (
            <Button
              variant="ghost"
              onClick={() => toggleBan(viewing)}
              className="rounded-md border border-destructive/50 px-3 py-1.5 text-sm text-destructive transition hover:bg-destructive hover:text-destructive-foreground"
            >
              {bannedIds.includes(viewing.id) ? "Desbanir" : "Banir"}
            </Button>
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
      <AppPreferencesDialog open={preferencesOpen} onOpenChange={setPreferencesOpen} />
      <SavedMessagesDialog
        open={savedMessagesOpen}
        onOpenChange={setSavedMessagesOpen}
        messages={communityTools.savedMessages}
        channelNames={Object.fromEntries(channels.map((channel) => [channel.id, channel.name]))}
        onOpenChannel={navigateToChannel}
        onRemove={communityTools.toggleSavedMessage}
      />
      <SocialCenter
        open={socialOpen}
        onOpenChange={setSocialOpen}
        userId={userId}
        profiles={profiles}
        onlineIds={online}
      />
      <CommunityHub
        open={communityOpen}
        onOpenChange={setCommunityOpen}
        userId={userId}
        profiles={profiles}
        messages={messages}
        isAdmin={!!status?.isAdmin}
      />
      <MessageThreadDialog
        root={threadRoot}
        userId={userId}
        profiles={profiles}
        onClose={() => setThreadRoot(null)}
      />
      <MessageSearchDialog
        open={messageSearchOpen}
        onOpenChange={setMessageSearchOpen}
        channels={channels.filter((channel) => channel.kind === "text")}
        profiles={profiles}
        onOpenMessage={(message) => {
          setSearchTarget(message);
          setSearchReadyId(null);
          setSearchJumpVersion((version) => version + 1);
          navigateToChannel(message.channel_id);
        }}
      />
    </div>
  );
}

function Attachment({ m }: { m: Message }) {
  const url = m.attachment_url;
  if (!url) return null;
  const type = m.attachment_type ?? "";
  if (type.startsWith("image/"))
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img
          src={url}
          alt={m.attachment_name ?? ""}
          loading="lazy"
          className="mt-1 max-h-80 max-w-full rounded-lg"
        />
      </a>
    );
  if (type.startsWith("video/"))
    return (
      <video
        src={url}
        controls
        preload="metadata"
        className="mt-1 max-h-80 max-w-full rounded-lg"
      />
    );
  if (type.startsWith("audio/"))
    return <audio src={url} controls className="mt-1 w-full max-w-sm" />;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={m.attachment_name ?? undefined}
      className="mt-1 flex max-w-sm items-center gap-3 rounded-lg border bg-card px-3 py-2 transition hover:border-primary/50"
    >
      <FileText className="h-6 w-6 shrink-0 text-primary" />
      <span className="truncate text-sm">{m.attachment_name ?? "arquivo"}</span>
    </a>
  );
}

function ChannelGroup({
  title,
  children,
  onAdd,
}: {
  title: string;
  children: React.ReactNode;
  onAdd?: (() => void) | undefined;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between px-2">
        <Button
          variant="ghost"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          className="h-7 min-w-0 justify-start gap-1 px-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          {collapsed ? <ChevronRight /> : <ChevronDown />}
          {title}
        </Button>
        {onAdd && !collapsed && (
          <Button
            variant="ghost"
            onClick={onAdd}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            aria-label={`Criar ${title}`}
            title="Criar"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>
      {!collapsed && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}

function ChannelBtn({
  active,
  unread = 0,
  onClick,
  onDelete,
  isFavorite = false,
  onToggleFavorite,
  children,
}: {
  active: boolean;
  unread?: number;
  onClick: () => void;
  onDelete?: (() => void) | undefined;
  isFavorite?: boolean;
  onToggleFavorite?: (() => void) | undefined;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`group/ch flex min-h-9 items-center rounded-md border-l-2 transition-colors ${active ? "channel-active border-primary bg-primary/[0.1] text-foreground" : "border-transparent text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"}`}
    >
      <Button
        variant="ghost"
        onClick={onClick}
        className="h-auto min-h-9 min-w-0 flex-1 justify-start gap-2 overflow-hidden px-2 py-1.5 text-left text-sm font-medium"
      >
        {children}
        {unread > 0 && (
          <span className="ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold leading-none text-primary-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Button>
      {onToggleFavorite && (
        <Button
          variant="ghost"
          onClick={onToggleFavorite}
          className={`mr-0.5 h-7 w-7 shrink-0 p-1 transition hover:bg-accent ${isFavorite ? "text-primary" : "text-muted-foreground opacity-0 group-hover/ch:opacity-100 focus:opacity-100"}`}
          aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <Star className={`h-3.5 w-3.5 ${isFavorite ? "fill-current" : ""}`} />
        </Button>
      )}
      {onDelete && (
        <Button
          variant="ghost"
          onClick={onDelete}
          className="mr-1 rounded p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover/ch:opacity-100 focus:opacity-100"
          aria-label="Apagar canal"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function MemberGroup({
  title,
  members,
  online,
  bannedIds,
  onSelect,
}: {
  title: string;
  members: Profile[];
  online: string[];
  bannedIds: string[];
  onSelect: (p: Profile) => void;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="member-list space-y-0.5">
        {members.map((p) => {
          const isOnline = online.includes(p.id);
          return (
            <Button
              variant="ghost"
              key={p.id}
              onClick={() => onSelect(p)}
              className={`member-row flex h-auto min-h-11 w-full justify-start gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-accent ${isOnline ? "" : "opacity-55 hover:opacity-100"}`}
            >
              <Avatar
                p={p}
                size={32}
                status={isOnline ? (p.status ?? "online") : "invisible"}
                ring="border-panel"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{nameOf(p)}</span>
                {p.custom_status && (
                  <span className="block truncate text-[11px] font-normal text-muted-foreground">
                    {p.custom_status}
                  </span>
                )}
              </span>
              {bannedIds.includes(p.id) && (
                <span className="text-[9px] font-bold uppercase text-destructive">Banido</span>
              )}
            </Button>
          );
        })}
        {members.length === 0 && (
          <p className="px-2 text-xs text-muted-foreground">Ninguém por aqui</p>
        )}
      </div>
    </section>
  );
}

function IconBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      title={label}
      aria-label={label}
      size="icon"
      className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-accent"
    >
      {children}
    </Button>
  );
}
