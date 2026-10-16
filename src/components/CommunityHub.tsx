import { useEffect, useState } from "react";
import { CalendarDays, Lightbulb, LoaderCircle, Plus, ShieldAlert, ShieldCheck, Vote, X } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { resolveCommunityReport, setAdminRole } from "@/lib/accounts.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Profile } from "./ProfileDialogs";

type Poll = { id: string; author_id: string; question: string; options: string[]; ends_at: string | null; created_at: string };
type PollVote = { poll_id: string; user_id: string; option_index: number };
type Suggestion = { id: string; author_id: string; title: string; description: string; status: string; response: string | null; created_at: string };
type SuggestionVote = { suggestion_id: string; user_id: string };
type Report = { id: string; reporter_id: string; target_user_id: string | null; target_message_id: string | null; reason: string; status: string; created_at: string };
type ReportableMessage = { id: string; user_id: string; content: string; created_at: string };
type CommunityEvent = { id: string; author_id: string; title: string; description: string; starts_at: string; location: string | null; status: string; created_at: string };
type EventRsvp = { event_id: string; user_id: string };
type AdminAudit = { id: string; actor_id: string; action: string; target_user_id: string | null; created_at: string };

export function CommunityHub({
  open,
  onOpenChange,
  userId,
  profiles,
  messages,
  isAdmin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  profiles: Record<string, Profile>;
  messages: ReportableMessage[];
  isAdmin: boolean;
}) {
  const setAdminRoleFn = useServerFn(setAdminRole);
  const resolveCommunityReportFn = useServerFn(resolveCommunityReport);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollVotes, setPollVotes] = useState<PollVote[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionVotes, setSuggestionVotes] = useState<SuggestionVote[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [eventRsvps, setEventRsvps] = useState<EventRsvp[]>([]);
  const [adminIds, setAdminIds] = useState<string[]>([]);
  const [auditRows, setAuditRows] = useState<AdminAudit[]>([]);
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [ideaTitle, setIdeaTitle] = useState("");
  const [ideaBody, setIdeaBody] = useState("");
  const [reportTarget, setReportTarget] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventStartsAt, setEventStartsAt] = useState("");
  const [eventLocation, setEventLocation] = useState("");

  async function refresh() {
    setLoading(true);
    const [pollResult, voteResult, ideasResult, ideaVotesResult, eventsResult, eventRsvpsResult, reportsResult, adminsResult, auditResult] = await Promise.all([
      supabase.from("community_polls").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("community_poll_votes").select("poll_id,user_id,option_index"),
      supabase.from("community_suggestions").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("community_suggestion_votes").select("suggestion_id,user_id"),
      supabase.from("community_events").select("*").order("starts_at", { ascending: true }).limit(50),
      supabase.from("community_event_rsvps").select("event_id,user_id"),
      isAdmin ? supabase.from("community_reports").select("*").order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [], error: null }),
      isAdmin ? supabase.from("user_roles").select("user_id").eq("role", "admin") : Promise.resolve({ data: [], error: null }),
      isAdmin ? supabase.from("admin_audit_log").select("id,actor_id,action,target_user_id,created_at").order("created_at", { ascending: false }).limit(30) : Promise.resolve({ data: [], error: null }),
    ]);
    const failed = [pollResult.error, voteResult.error, ideasResult.error, ideaVotesResult.error, eventsResult.error, eventRsvpsResult.error, reportsResult.error, adminsResult.error, auditResult.error].find(Boolean);
    if (failed) {
      const missing = failed.code === "42P01" || failed.code === "PGRST205";
      toast.error(missing ? "As migrações 0007–0009 ainda precisam ser aplicadas no Supabase." : `Não foi possível carregar a central: ${failed.message}`);
    } else {
      setPolls(pollResult.data ?? []);
      setPollVotes(voteResult.data ?? []);
      setSuggestions(ideasResult.data ?? []);
      setSuggestionVotes(ideaVotesResult.data ?? []);
      setReports(reportsResult.data ?? []);
      setEvents(eventsResult.data ?? []);
      setEventRsvps(eventRsvpsResult.data ?? []);
      setAdminIds(adminsResult.data?.map((row) => row.user_id) ?? []);
      setAuditRows(auditResult.data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!open) return;
    void refresh();
    const channel = supabase
      .channel(`community-hub-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_polls" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "community_poll_votes" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "community_suggestions" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "community_suggestion_votes" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "community_events" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "community_event_rsvps" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "community_reports" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_audit_log" }, () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [open, isAdmin, userId]);

  async function createPoll() {
    const cleanOptions = options.map((value) => value.trim()).filter(Boolean);
    if (question.trim().length < 5 || cleanOptions.length < 2 || cleanOptions.length > 8) {
      toast.error("Informe uma pergunta e de 2 a 8 opções.");
      return;
    }
    const { error } = await supabase.from("community_polls").insert({ author_id: userId, question: question.trim(), options: cleanOptions });
    if (error) return toast.error(`Não foi possível criar a enquete: ${error.message}`);
    setQuestion(""); setOptions(["", ""]); toast.success("Enquete publicada."); await refresh();
  }

  async function vote(poll: Poll, optionIndex: number) {
    const existing = pollVotes.find((item) => item.poll_id === poll.id && item.user_id === userId);
    const result = existing
      ? await supabase.from("community_poll_votes").update({ option_index: optionIndex }).eq("poll_id", poll.id).eq("user_id", userId)
      : await supabase.from("community_poll_votes").insert({ poll_id: poll.id, user_id: userId, option_index: optionIndex });
    if (result.error) return toast.error(`Não foi possível registrar o voto: ${result.error.message}`);
    await refresh();
  }

  async function createSuggestion() {
    if (ideaTitle.trim().length < 5 || ideaBody.trim().length < 1) return toast.error("Escreva um título e explique a sugestão.");
    const { error } = await supabase.from("community_suggestions").insert({ author_id: userId, title: ideaTitle.trim(), description: ideaBody.trim() });
    if (error) return toast.error(`Não foi possível enviar: ${error.message}`);
    setIdeaTitle(""); setIdeaBody(""); toast.success("Sugestão enviada à comunidade."); await refresh();
  }

  async function toggleIdeaVote(idea: Suggestion) {
    const existing = suggestionVotes.some((item) => item.suggestion_id === idea.id && item.user_id === userId);
    const result = existing
      ? await supabase.from("community_suggestion_votes").delete().eq("suggestion_id", idea.id).eq("user_id", userId)
      : await supabase.from("community_suggestion_votes").insert({ suggestion_id: idea.id, user_id: userId });
    if (result.error) return toast.error(`Não foi possível votar: ${result.error.message}`);
    await refresh();
  }

  async function changeIdeaStatus(idea: Suggestion, status: string) {
    const { error } = await supabase.from("community_suggestions").update({ status, updated_at: new Date().toISOString() }).eq("id", idea.id);
    if (error) return toast.error(`Não foi possível atualizar: ${error.message}`);
    await refresh();
  }

  async function submitReport() {
    if ((!reportTarget && !reportMessage) || (reportTarget && reportMessage) || reportReason.trim().length < 5) return toast.error("Escolha uma pessoa ou mensagem e descreva o motivo (mínimo de 5 caracteres).");
    const { error } = await supabase.from("community_reports").insert({ reporter_id: userId, target_user_id: reportTarget || null, target_message_id: reportMessage || null, reason: reportReason.trim() });
    if (error) return toast.error(`Não foi possível enviar a denúncia: ${error.message}`);
    setReportTarget(""); setReportReason(""); toast.success("Denúncia enviada para análise da moderação."); await refresh();
  }

  async function createEvent() {
    if (eventTitle.trim().length < 5 || !eventDescription.trim() || !eventStartsAt) return toast.error("Preencha título, descrição e data do evento.");
    const startsAt = new Date(eventStartsAt);
    if (Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) return toast.error("Escolha uma data futura.");
    const { error } = await supabase.from("community_events").insert({ author_id: userId, title: eventTitle.trim(), description: eventDescription.trim(), starts_at: startsAt.toISOString(), location: eventLocation.trim() || null });
    if (error) return toast.error(`Não foi possível criar o evento: ${error.message}`);
    setEventTitle(""); setEventDescription(""); setEventStartsAt(""); setEventLocation(""); toast.success("Evento publicado."); await refresh();
  }

  async function toggleRsvp(event: CommunityEvent) {
    const attending = eventRsvps.some((item) => item.event_id === event.id && item.user_id === userId);
    const result = attending
      ? await supabase.from("community_event_rsvps").delete().eq("event_id", event.id).eq("user_id", userId)
      : await supabase.from("community_event_rsvps").insert({ event_id: event.id, user_id: userId });
    if (result.error) return toast.error(`Não foi possível atualizar presença: ${result.error.message}`);
    await refresh();
  }

  async function cancelEvent(event: CommunityEvent) {
    if (!window.confirm(`Cancelar o evento “${event.title}”?`)) return;
    const { error } = await supabase.from("community_events").update({ status: "cancelled" }).eq("id", event.id);
    if (error) return toast.error(`Não foi possível cancelar: ${error.message}`);
    await refresh();
  }

  async function resolveReport(report: Report, status: "resolved" | "dismissed") {
    try {
      await resolveCommunityReportFn({ data: { reportId: report.id, status } });
      toast.success(status === "resolved" ? "Denúncia resolvida." : "Denúncia arquivada.");
      await refresh();
    } catch (error) {
      toast.error(`Não foi possível resolver: ${(error as Error).message}`);
    }
  }

  async function toggleAdmin(profile: Profile) {
    const enabled = !adminIds.includes(profile.id);
    try {
      await setAdminRoleFn({ data: { userId: profile.id, enabled } });
      toast.success(enabled ? `${profile.username} agora é admin.` : `Permissão de admin removida de ${profile.username}.`);
      await refresh();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2"><Vote className="h-4 w-4 text-primary" /> Central da comunidade</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="polls" className="flex min-h-0 flex-col">
          <TabsList className={`mx-5 mt-4 grid w-auto ${isAdmin ? "grid-cols-6" : "grid-cols-4"}`}>
            <TabsTrigger value="polls">Enquetes</TabsTrigger><TabsTrigger value="ideas">Sugestões</TabsTrigger><TabsTrigger value="events">Eventos</TabsTrigger><TabsTrigger value="report">Denunciar</TabsTrigger>{isAdmin && <><TabsTrigger value="reports">Denúncias</TabsTrigger><TabsTrigger value="admins">Admin</TabsTrigger></>}
          </TabsList>
          <div className="max-h-[68dvh] overflow-y-auto px-5 py-4">
            {loading && <div className="flex justify-center py-5"><LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
            <TabsContent value="polls" className="mt-0 space-y-4">
              <section className="rounded-xl border border-border bg-card p-4">
                <h3 className="mb-3 text-sm font-semibold">Criar enquete</h3>
                <Input maxLength={240} placeholder="Qual é a sua pergunta?" value={question} onChange={(e) => setQuestion(e.target.value)} />
                <div className="mt-2 space-y-2">{options.map((option, index) => <div key={index} className="flex gap-2"><Input maxLength={120} placeholder={`Opção ${index + 1}`} value={option} onChange={(e) => setOptions((current) => current.map((value, i) => i === index ? e.target.value : value))} />{options.length > 2 && <Button variant="ghost" size="icon" aria-label="Remover opção" onClick={() => setOptions((current) => current.filter((_, i) => i !== index))}><X className="h-4 w-4" /></Button>}</div>)}</div>
                <div className="mt-3 flex justify-between"><Button variant="ghost" size="sm" disabled={options.length >= 8} onClick={() => setOptions((current) => [...current, ""])}><Plus className="mr-1 h-4 w-4" /> Opção</Button><Button size="sm" onClick={() => void createPoll()}>Publicar</Button></div>
              </section>
              {polls.length === 0 && !loading && <Empty message="Nenhuma enquete ainda. Crie a primeira." />}
              {polls.map((poll) => {
                const votes = pollVotes.filter((item) => item.poll_id === poll.id);
                const myVote = votes.find((item) => item.user_id === userId)?.option_index;
                const closed = poll.ends_at ? new Date(poll.ends_at) <= new Date() : false;
                return <article key={poll.id} className="rounded-xl border border-border bg-card p-4"><div className="flex justify-between gap-3"><h3 className="font-semibold">{poll.question}</h3>{isAdmin && <Button variant="ghost" size="sm" onClick={async () => { const { error } = await supabase.from("community_polls").delete().eq("id", poll.id); if (error) toast.error(error.message); else await refresh(); }}>Excluir</Button>}</div><div className="mt-3 space-y-2">{poll.options.map((option, index) => { const count = votes.filter((v) => v.option_index === index).length; const percent = votes.length ? Math.round(count * 100 / votes.length) : 0; return <button key={`${index}-${option}`} disabled={closed} onClick={() => void vote(poll, index)} className={`relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition ${myVote === index ? "border-primary" : "border-border hover:border-primary/50"}`}><span className="absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${percent}%` }} /><span className="relative flex justify-between gap-2"><span>{option}</span><span className="text-muted-foreground">{percent}% · {count}</span></span></button>; })}</div><p className="mt-2 text-xs text-muted-foreground">{votes.length} {votes.length === 1 ? "voto" : "votos"}{myVote !== undefined ? " · seu voto pode ser alterado" : " · selecione uma opção para votar"}{closed ? " · encerrada" : ""}</p></article>;
              })}
            </TabsContent>
            <TabsContent value="ideas" className="mt-0 space-y-4">
              <section className="rounded-xl border border-border bg-card p-4"><h3 className="mb-3 text-sm font-semibold">Compartilhar uma ideia</h3><Input maxLength={120} placeholder="Título" value={ideaTitle} onChange={(e) => setIdeaTitle(e.target.value)} /><Textarea className="mt-2 min-h-20" maxLength={1200} placeholder="Descreva a sugestão" value={ideaBody} onChange={(e) => setIdeaBody(e.target.value)} /><div className="mt-3 flex justify-end"><Button size="sm" onClick={() => void createSuggestion()}>Enviar sugestão</Button></div></section>
              {suggestions.length === 0 && !loading && <Empty message="Ainda não há sugestões da comunidade." />}
              {suggestions.map((idea) => { const votes = suggestionVotes.filter((item) => item.suggestion_id === idea.id); const mine = votes.some((item) => item.user_id === userId); return <article key={idea.id} className="flex gap-3 rounded-xl border border-border bg-card p-4"><Button variant={mine ? "default" : "outline"} className="h-fit min-w-14 flex-col gap-0 px-2 py-2" onClick={() => void toggleIdeaVote(idea)} aria-label={mine ? "Remover voto" : "Votar na sugestão"}><span>▲</span><span>{votes.length}</span></Button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{idea.title}</h3><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize text-muted-foreground">{idea.status}</span></div><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{idea.description}</p>{idea.response && <p className="mt-2 border-l-2 border-primary pl-2 text-sm">{idea.response}</p>}{isAdmin && <select aria-label="Estado da sugestão" className="mt-3 rounded-md border border-border bg-background px-2 py-1 text-xs" value={idea.status} onChange={(e) => void changeIdeaStatus(idea, e.target.value)}>{["open", "reviewing", "accepted", "declined", "implemented"].map((state) => <option key={state} value={state}>{state}</option>)}</select>}</div></article>; })}
            </TabsContent>
            <TabsContent value="events" className="mt-0 space-y-4">
              <section className="rounded-xl border border-border bg-card p-4"><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4 text-primary" /> Criar evento</h3><Input maxLength={120} placeholder="Nome do evento" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} /><Textarea className="mt-2 min-h-20" maxLength={1200} placeholder="Descrição e detalhes" value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} /><div className="mt-2 grid gap-2 sm:grid-cols-2"><Input type="datetime-local" aria-label="Data e hora do evento" value={eventStartsAt} onChange={(e) => setEventStartsAt(e.target.value)} /><Input maxLength={160} placeholder="Local ou link (opcional)" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} /></div><div className="mt-3 flex justify-end"><Button size="sm" onClick={() => void createEvent()}>Publicar evento</Button></div></section>
              {events.length === 0 && !loading && <Empty message="Nenhum evento agendado ainda." />}
              {events.map((event) => { const attendees = eventRsvps.filter((item) => item.event_id === event.id); const mine = attendees.some((item) => item.user_id === userId); const organizer = profiles[event.author_id]?.username ?? "Membro"; const ended = new Date(event.starts_at) <= new Date(); return <article key={event.id} className="rounded-xl border border-border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{event.title}</h3><p className="mt-1 text-xs text-muted-foreground">{new Date(event.starts_at).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" })} · criado por {organizer}</p></div>{event.status === "cancelled" && <span className="rounded-full bg-destructive/10 px-2 py-1 text-xs text-destructive">Cancelado</span>}</div><p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{event.description}</p>{event.location && <p className="mt-2 break-all text-sm text-primary">{event.location}</p>}<div className="mt-4 flex items-center justify-between"><span className="text-xs text-muted-foreground">{attendees.length} {attendees.length === 1 ? "confirmado" : "confirmados"}</span><div className="flex gap-2">{(isAdmin || event.author_id === userId) && event.status !== "cancelled" && <Button variant="ghost" size="sm" onClick={() => void cancelEvent(event)}>Cancelar</Button>}{event.status === "scheduled" && !ended && <Button size="sm" variant={mine ? "outline" : "default"} onClick={() => void toggleRsvp(event)}>{mine ? "Cancelar presença" : "Vou participar"}</Button>}</div></div></article>; })}
            </TabsContent>
            <TabsContent value="report" className="mt-0 space-y-3"><div className="rounded-xl border border-border bg-card p-4"><div className="mb-3 flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4 text-primary" /> Denunciar pessoa ou mensagem</div><select aria-label="Membro denunciado" value={reportTarget} onChange={(e) => { setReportTarget(e.target.value); if (e.target.value) setReportMessage(""); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecione um membro</option>{Object.values(profiles).filter((profile) => profile.id !== userId).map((profile) => <option key={profile.id} value={profile.id}>{profile.username}</option>)}</select><p className="my-2 text-center text-xs text-muted-foreground">ou denuncie uma mensagem recente deste canal</p><select aria-label="Mensagem denunciada" value={reportMessage} onChange={(e) => { setReportMessage(e.target.value); if (e.target.value) setReportTarget(""); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecione uma mensagem</option>{messages.filter((message) => message.user_id !== userId).map((message) => <option key={message.id} value={message.id}>{profiles[message.user_id]?.username ?? "Membro"}: {message.content.slice(0, 100) || "Anexo"}</option>)}</select><Textarea className="mt-3 min-h-24" maxLength={500} placeholder="Explique o motivo. A denúncia ficará visível apenas à moderação." value={reportReason} onChange={(e) => setReportReason(e.target.value)} /><Button className="mt-3 w-full" onClick={() => void submitReport()}>Enviar denúncia</Button></div></TabsContent>
            {isAdmin && <TabsContent value="reports" className="mt-0 space-y-3">{reports.length === 0 && !loading && <Empty message="A fila de denúncias está vazia." />}{reports.map((report) => { const reportedMessage = messages.find((message) => message.id === report.target_message_id); return <article key={report.id} className="rounded-xl border border-border bg-card p-4"><div className="flex justify-between gap-3"><div><p className="text-xs text-muted-foreground">Alvo: {report.target_user_id ? profiles[report.target_user_id]?.username ?? "perfil removido" : reportedMessage ? `${profiles[reportedMessage.user_id]?.username ?? "membro"}: ${reportedMessage.content.slice(0, 100) || "anexo"}` : `mensagem ${report.target_message_id?.slice(0, 8) ?? "indisponível"}`} · denúncia de {profiles[report.reporter_id]?.username ?? "membro"}</p><p className="mt-2 text-sm">{report.reason}</p><p className="mt-2 text-xs capitalize text-muted-foreground">Estado: {report.status}</p></div><span className="text-xs text-muted-foreground">{new Date(report.created_at).toLocaleDateString("pt-BR")}</span></div>{report.status === "open" || report.status === "reviewing" ? <div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => void resolveReport(report, "dismissed")}>Arquivar</Button><Button size="sm" onClick={() => void resolveReport(report, "resolved")}>Resolver</Button></div> : null}</article>; })}</TabsContent>}
            {isAdmin && <TabsContent value="admins" className="mt-0 space-y-4"><section className="rounded-xl border border-border bg-card p-4"><h3 className="mb-1 flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-primary" /> Administradores</h3><p className="mb-4 text-xs text-muted-foreground">Alterações verificadas no servidor; o último admin não pode remover a própria conta.</p><div className="space-y-2">{Object.values(profiles).filter((profile) => profile.id !== userId).map((profile) => { const admin = adminIds.includes(profile.id); return <div key={profile.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"><span className="truncate text-sm">{profile.username}</span><Button size="sm" variant={admin ? "outline" : "default"} onClick={() => void toggleAdmin(profile)}>{admin ? "Remover admin" : "Promover a admin"}</Button></div>; })}</div></section><section className="rounded-xl border border-border bg-card p-4"><h3 className="mb-3 font-semibold">Registro administrativo</h3>{auditRows.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma ação administrativa registrada ainda.</p>}<div className="space-y-2">{auditRows.map((row) => <div key={row.id} className="flex flex-wrap justify-between gap-2 border-b border-border pb-2 text-xs"><span>{profiles[row.actor_id]?.username ?? "Admin"} {auditAction(row.action)} {profiles[row.target_user_id ?? ""]?.username ?? "membro"}</span><time className="text-muted-foreground">{new Date(row.created_at).toLocaleString("pt-BR")}</time></div>)}</div></section></TabsContent>}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Empty({ message }: { message: string }) { return <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground"><Lightbulb className="mx-auto mb-2 h-5 w-5" />{message}</div>; }

function auditAction(action: string) {
  const labels: Record<string, string> = {
    admin_role_granted: "promoveu",
    admin_role_revoked: "removeu o cargo de admin de",
    member_banned: "baniu",
    member_unbanned: "removeu o ban de",
    report_resolved: "resolveu denúncia sobre",
    report_dismissed: "arquivou denúncia sobre",
  };
  return labels[action] ?? `registrou ${action} para`;
}
