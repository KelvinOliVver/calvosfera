import { useState } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Profile } from "./ProfileDialogs";
import type { ThreadMessage } from "./MessageThreadDialog";
import { nameOf } from "./ProfileDialogs";

export function MessageSearchDialog({
  open,
  onOpenChange,
  channels,
  profiles,
  onOpenMessage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channels: { id: string; name: string }[];
  profiles: Record<string, Profile>;
  onOpenMessage: (message: ThreadMessage) => void;
}) {
  const [query, setQuery] = useState("");
  const [channelId, setChannelId] = useState("");
  const [authorId, setAuthorId] = useState("");
  const [mentionedId, setMentionedId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [attachmentsOnly, setAttachmentsOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ThreadMessage[]>([]);
  const [searched, setSearched] = useState(false);

  async function searchMessages(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim() && !authorId && !mentionedId && !attachmentsOnly) {
      toast.error("Informe um termo ou use um dos filtros para buscar.");
      return;
    }
    setLoading(true);
    setSearched(true);
    let request = supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(50);
    if (query.trim()) request = request.ilike("content", `%${query.trim()}%`);
    if (channelId) request = request.eq("channel_id", channelId);
    if (authorId) request = request.eq("user_id", authorId);
    if (mentionedId) {
      const profile = profiles[mentionedId];
      if (profile) request = request.ilike("content", `%@${profile.username}%`);
    }
    if (from) request = request.gte("created_at", new Date(from).toISOString());
    if (to) request = request.lte("created_at", new Date(to).toISOString());
    if (attachmentsOnly) request = request.not("attachment_url", "is", null);
    const { data, error } = await request;
    if (error) toast.error(`A busca falhou: ${error.message}`);
    else setResults((data ?? []) as ThreadMessage[]);
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-5 py-4"><DialogTitle className="flex items-center gap-2"><Search className="h-4 w-4 text-primary" /> Buscar mensagens</DialogTitle></DialogHeader>
        <form onSubmit={(event) => void searchMessages(event)} className="space-y-3 overflow-y-auto px-5 py-4">
          <Input autoFocus maxLength={200} placeholder="Palavra ou frase" value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="grid gap-2 sm:grid-cols-2">
            <select aria-label="Filtrar por canal" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={channelId} onChange={(event) => setChannelId(event.target.value)}><option value="">Todos os canais</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select>
            <select aria-label="Filtrar por autor" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={authorId} onChange={(event) => setAuthorId(event.target.value)}><option value="">Qualquer autor</option>{Object.values(profiles).sort((a, b) => a.username.localeCompare(b.username)).map((profile) => <option key={profile.id} value={profile.id}>{nameOf(profile)}</option>)}</select>
            <select aria-label="Filtrar por usuário mencionado" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={mentionedId} onChange={(event) => setMentionedId(event.target.value)}><option value="">Qualquer menção</option>{Object.values(profiles).sort((a, b) => a.username.localeCompare(b.username)).map((profile) => <option key={profile.id} value={profile.id}>@{profile.username}</option>)}</select>
            <label className="flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm"><input type="checkbox" checked={attachmentsOnly} onChange={(event) => setAttachmentsOnly(event.target.checked)} /> Apenas com anexos</label>
            <label className="space-y-1 text-xs text-muted-foreground">De<input aria-label="Data inicial" type="datetime-local" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
            <label className="space-y-1 text-xs text-muted-foreground">Até<input aria-label="Data final" type="datetime-local" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          </div>
          <div className="flex justify-end"><Button type="submit" disabled={loading}>{loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Buscar</Button></div>
          <section aria-live="polite" className="space-y-2 border-t border-border pt-3">
            {searched && !loading && results.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma mensagem encontrada com esses filtros.</p>}
            {results.map((message) => <button key={message.id} type="button" onClick={() => { onOpenMessage(message); onOpenChange(false); }} className="w-full rounded-lg border border-border bg-card p-3 text-left transition hover:border-primary/50 hover:bg-accent/40"><span className="flex items-center justify-between gap-2 text-xs"><strong>{nameOf(profiles[message.user_id])}</strong><span className="text-muted-foreground">#{channels.find((channel) => channel.id === message.channel_id)?.name ?? "canal"} · {new Date(message.created_at).toLocaleString("pt-BR")}</span></span><span className="mt-1 block whitespace-pre-wrap break-words text-sm">{message.content || message.attachment_name || "Anexo"}</span></button>)}
            {results.length === 50 && <p className="text-center text-xs text-muted-foreground">Exibindo os 50 resultados mais recentes. Refine os filtros para encontrar outros.</p>}
          </section>
        </form>
      </DialogContent>
    </Dialog>
  );
}
