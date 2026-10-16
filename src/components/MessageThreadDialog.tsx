import { useEffect, useState, type FormEvent } from "react";
import { CornerUpLeft, LoaderCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, nameOf, type Profile } from "./ProfileDialogs";
import { MessageText } from "./MessageText";

export type ThreadMessage = {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  reply_to?: string | null;
  edited_at?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
};

export function MessageThreadDialog({
  root,
  userId,
  profiles,
  onClose,
}: {
  root: ThreadMessage | null;
  userId: string;
  profiles: Record<string, Profile>;
  onClose: () => void;
}) {
  const [replies, setReplies] = useState<ThreadMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!root) return;
    let cancelled = false;
    setLoading(true);
    setReplies([]);
    async function loadReplies() {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("reply_to", root!.id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (cancelled) return;
      if (error) toast.error(`Não foi possível carregar a thread: ${error.message}`);
      else setReplies((data ?? []) as ThreadMessage[]);
      setLoading(false);
    }
    void loadReplies();
    const channel = supabase
      .channel(`thread-${root.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${root.channel_id}` }, (payload) => {
        const message = payload.new as ThreadMessage;
        if (message.reply_to === root.id) setReplies((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `channel_id=eq.${root.channel_id}` }, (payload) => {
        const message = payload.new as ThreadMessage;
        setReplies((current) => current.map((item) => item.id === message.id ? message : item));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
        const id = (payload.old as { id?: string }).id;
        if (id) setReplies((current) => current.filter((item) => item.id !== id));
      })
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [root]);

  async function sendReply(event: FormEvent) {
    event.preventDefault();
    const content = text.trim();
    if (!root || !content || sending) return;
    setSending(true);
    const { data, error } = await supabase
      .from("messages")
      .insert({ channel_id: root.channel_id, user_id: userId, content: content.slice(0, 2000), reply_to: root.id })
      .select("*")
      .single();
    if (error) toast.error(`Não foi possível responder: ${error.message}`);
    else {
      setText("");
      setReplies((current) => current.some((item) => item.id === data.id) ? current : [...current, data as ThreadMessage]);
    }
    setSending(false);
  }

  return (
    <Dialog open={!!root} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[85dvh] flex-col p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2"><CornerUpLeft className="h-4 w-4 text-primary" /> Thread</DialogTitle>
        </DialogHeader>
        {root && <>
          <div className="border-b border-border bg-muted/25 px-5 py-4">
            <div className="flex items-center gap-2"><Avatar p={profiles[root.user_id]} size={30} /><strong className="text-sm">{nameOf(profiles[root.user_id])}</strong><time className="text-xs text-muted-foreground">{new Date(root.created_at).toLocaleString("pt-BR")}</time></div>
            <div className="mt-3 whitespace-pre-wrap break-words text-sm">{root.content || root.attachment_name || "Anexo"}</div>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <p className="text-xs font-medium text-muted-foreground">{replies.length} {replies.length === 1 ? "resposta" : "respostas"}</p>
            {loading && <div className="flex justify-center py-4"><LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
            {!loading && replies.length === 0 && <p className="py-5 text-center text-sm text-muted-foreground">Seja a primeira pessoa a responder nesta thread.</p>}
            {replies.map((reply) => <article key={reply.id} className="flex gap-3"><Avatar p={profiles[reply.user_id]} size={30} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-2"><strong className="text-sm">{nameOf(profiles[reply.user_id])}</strong><time className="text-[11px] text-muted-foreground">{new Date(reply.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>{reply.edited_at && <span className="text-[10px] text-muted-foreground">(editada)</span>}</div><p className="mt-1 whitespace-pre-wrap break-words text-sm">{reply.content && <MessageText text={reply.content} byName={Object.fromEntries(Object.values(profiles).map((profile) => [profile.username.toLowerCase(), profile]))} />}{reply.attachment_url && <a className="mt-1 block text-primary underline" href={reply.attachment_url} target="_blank" rel="noreferrer">{reply.attachment_name ?? "Abrir anexo"}</a>}</p></div></article>)}
          </div>
          <form onSubmit={sendReply} className="flex items-end gap-2 border-t border-border p-4"><textarea aria-label="Responder na thread" maxLength={2000} rows={2} value={text} onChange={(event) => setText(event.target.value)} placeholder="Responder nesta thread…" className="min-h-10 flex-1 resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm" /><Button type="submit" disabled={sending || !text.trim()} aria-label="Enviar resposta"><Send className="h-4 w-4" /></Button></form>
        </>}
      </DialogContent>
    </Dialog>
  );
}
