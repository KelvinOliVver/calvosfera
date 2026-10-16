import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  MessageCircle,
  Search,
  ShieldBan,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, nameOf, type Profile } from "./ProfileDialogs";

type Friendship = {
  user_a: string;
  user_b: string;
  requested_by: string;
  status: "pending" | "accepted";
  created_at: string;
};
type Conversation = { id: string; user_a: string; user_b: string; created_at: string };
type DirectMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
};
type Block = { blocker_id: string; blocked_id: string; created_at: string };

function pairFor(first: string, second: string) {
  return first < second ? { user_a: first, user_b: second } : { user_a: second, user_b: first };
}

export function SocialCenter({
  open,
  onOpenChange,
  userId,
  profiles,
  onlineIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  profiles: Record<string, Profile>;
  onlineIds: string[];
}) {
  const [tab, setTab] = useState<"friends" | "messages" | "blocked">("friends");
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialUnavailable, setSocialUnavailable] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    setLoading(true);
    const [friendResult, blockResult, conversationResult] = await Promise.all([
      supabase
        .from("friendships")
        .select("*")
        .or(`user_a.eq.${userId},user_b.eq.${userId}`)
        .order("created_at", { ascending: false }),
      supabase
        .from("blocked_users")
        .select("*")
        .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)
        .order("created_at", { ascending: false }),
      supabase
        .from("dm_conversations")
        .select("*")
        .or(`user_a.eq.${userId},user_b.eq.${userId}`)
        .order("created_at", { ascending: false }),
    ]);
    const failed = [friendResult.error, blockResult.error, conversationResult.error].find(Boolean);
    if (failed) {
      const missingMigration = [
        friendResult.error,
        blockResult.error,
        conversationResult.error,
      ].some((error) => error?.code === "PGRST205" || error?.code === "42P01");
      setSocialUnavailable(missingMigration);
      toast.error(
        missingMigration
          ? "A área social precisa da migração 0006 aplicada no Supabase."
          : `Não foi possível carregar a área social: ${failed.message}`,
      );
    } else {
      setSocialUnavailable(false);
    }
    setFriendships((friendResult.data ?? []) as Friendship[]);
    setBlocks((blockResult.data ?? []) as Block[]);
    setConversations((conversationResult.data ?? []) as Conversation[]);
    setLoading(false);
  }

  useEffect(() => {
    if (!open) return;
    void refresh();
    const channel = supabase
      .channel(`social-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dm_conversations" },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [open, userId]);

  useEffect(() => {
    if (!open || !activeConversation) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    void supabase
      .from("dm_messages")
      .select("*")
      .eq("conversation_id", activeConversation.id)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) toast.error(`Não foi possível carregar a conversa: ${error.message}`);
        setMessages((data ?? []).reverse() as DirectMessage[]);
        setLoadingMessages(false);
      });
    const channel = supabase
      .channel(`dm-${activeConversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dm_messages",
          filter: `conversation_id=eq.${activeConversation.id}`,
        },
        (payload) => {
          const message = payload.new as DirectMessage;
          setMessages((current) =>
            current.some((item) => item.id === message.id) ? current : [...current, message],
          );
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [open, activeConversation?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const isBlockedBetween = (first: string, second: string) =>
    blocks.some(
      (block) =>
        (block.blocker_id === first && block.blocked_id === second) ||
        (block.blocker_id === second && block.blocked_id === first),
    );
  const incoming = friendships.filter(
    (friend) =>
      friend.status === "pending" &&
      friend.requested_by !== userId &&
      !isBlockedBetween(friend.user_a, friend.user_b),
  );
  const outgoing = friendships.filter(
    (friend) =>
      friend.status === "pending" &&
      friend.requested_by === userId &&
      !isBlockedBetween(friend.user_a, friend.user_b),
  );
  const friends = friendships.filter(
    (friend) => friend.status === "accepted" && !isBlockedBetween(friend.user_a, friend.user_b),
  );
  const myBlocks = blocks.filter((block) => block.blocker_id === userId);
  const visibleProfiles = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("pt-BR");
    return Object.values(profiles)
      .filter(
        (profile) =>
          profile.id !== userId &&
          (nameOf(profile).toLocaleLowerCase("pt-BR").includes(search) ||
            profile.username.toLocaleLowerCase("pt-BR").includes(search)),
      )
      .slice(0, 8);
  }, [profiles, query, userId]);

  async function requestFriend(targetId: string) {
    const pair = pairFor(userId, targetId);
    const { error } = await supabase.from("friendships").insert({ ...pair, requested_by: userId });
    if (error) {
      toast.error(
        error.code === "23505"
          ? "Já existe uma solicitação ou amizade com esta pessoa."
          : error.code === "P0001" && error.message.includes("Friendship request limit")
            ? "Você atingiu o limite de 10 solicitações por hora. Tente novamente mais tarde."
            : `Não foi possível enviar: ${error.message}`,
      );
      return;
    }
    toast.success("Solicitação de amizade enviada.");
    setQuery("");
    await refresh();
  }

  async function acceptRequest(friendship: Friendship) {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("user_a", friendship.user_a)
      .eq("user_b", friendship.user_b);
    if (error) toast.error(`Não foi possível aceitar: ${error.message}`);
    else {
      toast.success("Amizade aceita.");
      await refresh();
    }
  }

  async function removeFriendship(friendship: Friendship) {
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("user_a", friendship.user_a)
      .eq("user_b", friendship.user_b);
    if (error) toast.error(`Não foi possível remover: ${error.message}`);
    else {
      if (
        activeConversation &&
        activeConversation.user_a === friendship.user_a &&
        activeConversation.user_b === friendship.user_b
      )
        setActiveConversation(null);
      await refresh();
    }
  }

  async function toggleBlock(targetId: string, blocked: boolean) {
    const request = blocked
      ? supabase.from("blocked_users").delete().eq("blocker_id", userId).eq("blocked_id", targetId)
      : supabase.from("blocked_users").insert({ blocker_id: userId, blocked_id: targetId });
    const { error } = await request;
    if (error)
      toast.error(`Não foi possível ${blocked ? "desbloquear" : "bloquear"}: ${error.message}`);
    else {
      if (!blocked) {
        const pair = pairFor(userId, targetId);
        const { error: friendshipError } = await supabase
          .from("friendships")
          .delete()
          .eq("user_a", pair.user_a)
          .eq("user_b", pair.user_b);
        if (friendshipError)
          toast.error(
            `Bloqueio aplicado, mas não foi possível remover a amizade: ${friendshipError.message}`,
          );
      }
      toast.success(blocked ? "Usuário desbloqueado." : "Usuário bloqueado.");
      await refresh();
    }
  }

  async function openDirectMessage(friendship: Friendship) {
    const pair = pairFor(friendship.user_a, friendship.user_b);
    let { data, error } = await supabase
      .from("dm_conversations")
      .select("*")
      .eq("user_a", pair.user_a)
      .eq("user_b", pair.user_b)
      .maybeSingle();
    if (!data && !error) {
      const created = await supabase.from("dm_conversations").insert(pair).select("*").single();
      data = created.data;
      error = created.error;
      if (!data && error?.code === "23505") {
        const retry = await supabase
          .from("dm_conversations")
          .select("*")
          .eq("user_a", pair.user_a)
          .eq("user_b", pair.user_b)
          .maybeSingle();
        data = retry.data;
        error = retry.error;
      }
    }
    if (error || !data) {
      toast.error(
        `Não foi possível abrir a conversa: ${error?.message ?? "conversa indisponível"}`,
      );
      return;
    }
    setActiveConversation(data as Conversation);
    setTab("messages");
  }

  async function sendDirectMessage(event: React.FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !activeConversation || sending) return;
    setSending(true);
    const { data, error } = await supabase
      .from("dm_messages")
      .insert({
        conversation_id: activeConversation.id,
        sender_id: userId,
        content: content.slice(0, 2000),
      })
      .select("*")
      .single();
    if (error) toast.error(`Não foi possível enviar: ${error.message}`);
    else {
      setDraft("");
      setMessages((current) =>
        current.some((item) => item.id === data.id) ? current : [...current, data as DirectMessage],
      );
    }
    setSending(false);
  }

  const otherUser = (conversation: Conversation) =>
    conversation.user_a === userId ? conversation.user_b : conversation.user_a;
  const presenceFor = (profileId: string) =>
    onlineIds.includes(profileId) ? (profiles[profileId]?.status ?? "online") : "invisible";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88dvh] min-h-[min(640px,80dvh)] max-w-4xl flex-col overflow-hidden border-border bg-panel p-0 text-foreground sm:rounded-2xl">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-14 text-left">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Rede social
          </DialogTitle>
          <DialogDescription>Amizades, solicitações e conversas privadas.</DialogDescription>
        </DialogHeader>
        {!socialUnavailable ? (
          <div className="flex min-h-0 flex-1">
            <nav
              aria-label="Seções sociais"
              className={`${activeConversation ? "hidden md:flex" : "flex"} w-48 shrink-0 flex-col gap-1 border-r border-border p-3`}
            >
              <SocialTab
                active={tab === "friends"}
                onClick={() => {
                  setTab("friends");
                  setActiveConversation(null);
                }}
              >
                <Users className="h-4 w-4" /> Amigos{" "}
                <span className="ml-auto text-xs text-muted-foreground">{friends.length}</span>
              </SocialTab>
              <SocialTab active={tab === "messages"} onClick={() => setTab("messages")}>
                <MessageCircle className="h-4 w-4" /> Mensagens{" "}
                <span className="ml-auto text-xs text-muted-foreground">
                  {conversations.length}
                </span>
              </SocialTab>
              <SocialTab
                active={tab === "blocked"}
                onClick={() => {
                  setTab("blocked");
                  setActiveConversation(null);
                }}
              >
                <ShieldBan className="h-4 w-4" /> Bloqueados
              </SocialTab>
            </nav>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {tab === "friends" && (
                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                  <label className="relative block">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Encontrar membros por nome..."
                      className="h-10 border-border bg-background pl-9"
                    />
                  </label>
                  {query.trim() && (
                    <div className="mt-2 divide-y divide-border rounded-lg border border-border bg-background">
                      {visibleProfiles.map((profile) => {
                        const pair = pairFor(userId, profile.id);
                        const relation = friendships.find(
                          (friend) =>
                            friend.user_a === pair.user_a && friend.user_b === pair.user_b,
                        );
                        const isBlocked = isBlockedBetween(userId, profile.id);
                        return (
                          <div key={profile.id} className="flex items-center gap-3 p-3">
                            <Avatar p={profile} size={36} status={presenceFor(profile.id)} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{nameOf(profile)}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                @{profile.username}
                              </p>
                            </div>
                            {relation?.status === "accepted" && !isBlocked ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void openDirectMessage(relation)}
                              >
                                <MessageCircle className="mr-1.5 h-4 w-4" />
                                Mensagem
                              </Button>
                            ) : relation?.requested_by === userId && !isBlocked ? (
                              <span className="text-xs text-muted-foreground">Enviada</span>
                            ) : relation?.status === "pending" && !isBlocked ? (
                              <Button size="sm" onClick={() => void acceptRequest(relation)}>
                                <Check className="mr-1.5 h-4 w-4" />
                                Aceitar
                              </Button>
                            ) : !isBlocked ? (
                              <>
                                <Button size="sm" onClick={() => void requestFriend(profile.id)}>
                                  <UserPlus className="mr-1.5 h-4 w-4" />
                                  Adicionar
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => void toggleBlock(profile.id, false)}
                                  aria-label={`Bloquear ${nameOf(profile)}`}
                                >
                                  <ShieldBan className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">Bloqueado</span>
                            )}
                            {relation && !isBlocked && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => void toggleBlock(profile.id, false)}
                                aria-label={`Bloquear ${nameOf(profile)}`}
                              >
                                <ShieldBan className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                      {visibleProfiles.length === 0 && (
                        <p className="p-4 text-sm text-muted-foreground">
                          Nenhum membro encontrado.
                        </p>
                      )}
                    </div>
                  )}
                  {incoming.length > 0 && (
                    <section className="mt-6">
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Solicitações recebidas · {incoming.length}
                      </h3>
                      <div className="divide-y divide-border">
                        {incoming.map((friendship) => {
                          const id = friendship.requested_by;
                          const profile = profiles[id];
                          return (
                            <div
                              key={`${friendship.user_a}-${friendship.user_b}`}
                              className="flex items-center gap-3 py-3"
                            >
                              <Avatar p={profile} size={36} status={presenceFor(id)} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{nameOf(profile)}</p>
                                <p className="text-xs text-muted-foreground">
                                  Quer se conectar com você
                                </p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => void acceptRequest(friendship)}
                                aria-label="Aceitar solicitação"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => void removeFriendship(friendship)}
                                aria-label="Recusar solicitação"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
                  {outgoing.length > 0 && (
                    <section className="mt-4">
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Solicitações enviadas · {outgoing.length}
                      </h3>
                      {outgoing.map((friendship) => {
                        const id =
                          friendship.user_a === userId ? friendship.user_b : friendship.user_a;
                        return (
                          <div
                            key={`${friendship.user_a}-${friendship.user_b}`}
                            className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm"
                          >
                            <span className="truncate">{nameOf(profiles[id])}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void removeFriendship(friendship)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        );
                      })}
                    </section>
                  )}
                  <section className="mt-6">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Amigos · {friends.length}
                    </h3>
                    {friends.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                        Adicione membros para começar sua lista de amigos.
                      </p>
                    ) : (
                      <div className="divide-y divide-border">
                        {friends.map((friendship) => {
                          const id =
                            friendship.user_a === userId ? friendship.user_b : friendship.user_a;
                          const profile = profiles[id];
                          return (
                            <div
                              key={`${friendship.user_a}-${friendship.user_b}`}
                              className="flex items-center gap-3 py-3"
                            >
                              <Avatar p={profile} size={36} status={presenceFor(id)} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{nameOf(profile)}</p>
                                <p className="text-xs text-muted-foreground">
                                  @{profile?.username ?? "membro"}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void openDirectMessage(friendship)}
                              >
                                <MessageCircle className="mr-1.5 h-4 w-4" />
                                Mensagem
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => void removeFriendship(friendship)}
                                aria-label={`Remover ${nameOf(profile)} dos amigos`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>
              )}
              {tab === "messages" && (
                <div className="flex min-h-0 flex-1">
                  <div
                    className={`${activeConversation ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-border md:w-60`}
                  >
                    <div className="border-b border-border px-4 py-3">
                      <h3 className="text-sm font-semibold">Conversas privadas</h3>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-2">
                      {conversations.map((conversation) => {
                        const id = otherUser(conversation);
                        const profile = profiles[id];
                        return (
                          <button
                            key={conversation.id}
                            type="button"
                            onClick={() => setActiveConversation(conversation)}
                            className={`flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-accent ${activeConversation?.id === conversation.id ? "bg-accent" : ""}`}
                          >
                            <Avatar p={profile} size={32} status={presenceFor(id)} />
                            <span className="truncate text-sm font-medium">{nameOf(profile)}</span>
                          </button>
                        );
                      })}
                      {conversations.length === 0 && (
                        <p className="px-2 py-8 text-center text-xs text-muted-foreground">
                          Suas conversas com amigos aparecerão aqui.
                        </p>
                      )}
                    </div>
                  </div>
                  <div
                    className={`${activeConversation ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}
                  >
                    {activeConversation ? (
                      <>
                        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="md:hidden"
                            onClick={() => setActiveConversation(null)}
                            aria-label="Voltar às conversas"
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </Button>
                          <Avatar
                            p={profiles[otherUser(activeConversation)]}
                            size={32}
                            status={presenceFor(otherUser(activeConversation))}
                          />
                          <div>
                            <p className="text-sm font-semibold">
                              {nameOf(profiles[otherUser(activeConversation)])}
                            </p>
                            <p className="text-xs text-muted-foreground">Conversa privada</p>
                          </div>
                        </div>
                        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
                          {loadingMessages && (
                            <p className="text-center text-xs text-muted-foreground">
                              Carregando mensagens…
                            </p>
                          )}
                          {messages.map((message) => (
                            <div
                              key={message.id}
                              className={`max-w-[82%] rounded-xl px-3 py-2 text-sm ${message.sender_id === userId ? "self-end bg-primary text-primary-foreground" : "self-start bg-card"}`}
                            >
                              <p className="whitespace-pre-wrap break-words">{message.content}</p>
                              <p className="mt-1 text-right text-[10px] opacity-65">
                                {new Date(message.created_at).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                                {message.edited_at ? " · editada" : ""}
                              </p>
                            </div>
                          ))}
                          {!loadingMessages && messages.length === 0 && (
                            <p className="m-auto text-sm text-muted-foreground">
                              Diga oi para começar.
                            </p>
                          )}
                          <div ref={endRef} />
                        </div>
                        <form
                          onSubmit={(event) => void sendDirectMessage(event)}
                          className="flex gap-2 border-t border-border p-3"
                        >
                          <Input
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            maxLength={2000}
                            placeholder="Escreva uma mensagem privada…"
                            className="border-border bg-background"
                          />
                          <Button
                            type="submit"
                            disabled={sending || !draft.trim()}
                            aria-label="Enviar mensagem privada"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        </form>
                      </>
                    ) : (
                      <div className="m-auto max-w-xs p-6 text-center">
                        <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground/50" />
                        <p className="mt-3 text-sm font-semibold">Escolha uma conversa</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Abra uma conversa pela sua lista de amigos.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {tab === "blocked" && (
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Membros bloqueados
                  </h3>
                  {myBlocks.map((block) => {
                    const profile = profiles[block.blocked_id];
                    return (
                      <div
                        key={block.blocked_id}
                        className="flex items-center gap-3 border-b border-border py-3"
                      >
                        <Avatar p={profile} size={36} status="invisible" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{nameOf(profile)}</p>
                          <p className="text-xs text-muted-foreground">
                            Mensagens privadas bloqueadas
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void toggleBlock(block.blocked_id, true)}
                        >
                          Desbloquear
                        </Button>
                      </div>
                    );
                  })}
                  {myBlocks.length === 0 && (
                    <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                      Você não bloqueou ninguém.
                    </p>
                  )}
                </div>
              )}
              {loading && (
                <span className="sr-only" role="status">
                  Atualizando sua rede social
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="m-auto max-w-md p-8 text-center">
            <Users className="mx-auto h-9 w-9 text-muted-foreground/50" />
            <h3 className="mt-4 text-base font-semibold">Área social aguardando o banco</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Aplique <code>drizzle/migrations/0006_user_social.sql</code> no projeto Supabase para
              ativar amizades, bloqueios e DMs com RLS.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SocialTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={`justify-start gap-2 text-sm ${active ? "bg-accent text-foreground" : "text-muted-foreground"}`}
    >
      {children}
    </Button>
  );
}
