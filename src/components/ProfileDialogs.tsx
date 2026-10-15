import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { toast } from "sonner";
import { X, Camera, ImagePlus, Trash2, UserRound, Palette } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadMedia } from "@/lib/media";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type Status = "online" | "idle" | "dnd" | "invisible";

export type Profile = {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  banner_color?: string | null;
  bio: string | null;
  pronouns?: string | null;
  theme_primary?: string | null;
  theme_accent?: string | null;
  status?: string | null;
  custom_status?: string | null;
  created_at?: string;
};

export const PROFILE_COLS =
  "id,username,display_name,avatar_url,banner_url,banner_color,bio,pronouns,theme_primary,theme_accent,status,custom_status,created_at";

export const STATUS_LABEL: Record<Status, string> = {
  online: "Disponível",
  idle: "Ausente",
  dnd: "Não perturbar",
  invisible: "Invisível",
};

export const nameOf = (p?: Profile) => p?.display_name?.trim() || p?.username || "...";

const dotClass = (s?: string | null) =>
  s === "idle"
    ? "bg-idle"
    : s === "dnd"
      ? "bg-dnd"
      : s === "online"
        ? "bg-online"
        : "bg-muted-foreground";

export function Avatar({
  p,
  size = 40,
  status,
  ring = "border-panel",
}: {
  p?: Profile | undefined;
  size?: number;
  status?: string | null | undefined;
  ring?: string;
}) {
  const dot = Math.max(10, Math.round(size * 0.32));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {p?.avatar_url ? (
        <img
          src={p.avatar_url}
          alt={p.username}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full bg-primary font-bold text-primary-foreground"
          style={{ fontSize: size * 0.42 }}
        >
          {nameOf(p).slice(0, 1).toUpperCase()}
        </div>
      )}
      {status !== undefined && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 rounded-full border-[3px] ${ring} ${dotClass(status)}`}
          style={{ width: dot + 4, height: dot + 4 }}
        />
      )}
    </div>
  );
}

function themeStyle(p: Profile): CSSProperties | undefined {
  if (!p.theme_primary) return undefined;
  return {
    background: `linear-gradient(180deg, ${p.theme_primary} 0%, ${p.theme_accent || p.theme_primary} 100%)`,
  };
}

/** Card de perfil estilo Discord (popout). */
export function ProfileCard({
  p,
  status,
  actions,
}: {
  p: Profile;
  status?: string | null | undefined;
  actions?: ReactNode;
}) {
  const themed = !!p.theme_primary;
  return (
    <div className="w-full overflow-hidden rounded-lg bg-rail p-1" style={themeStyle(p)}>
      <div className="overflow-hidden rounded-md">
        <div
          className="h-[120px] w-full"
          style={{ background: p.banner_color || "var(--color-accent)" }}
        >
          {p.banner_url && <img src={p.banner_url} alt="" className="h-full w-full object-cover" />}
        </div>
      </div>
      <div className="relative px-3 pb-3">
        <div
          className="-mt-12 inline-block rounded-full p-1.5"
          style={{ background: themed ? "transparent" : "var(--color-rail)" }}
        >
          <Avatar
            p={p}
            size={84}
            status={status}
            ring={themed ? "border-transparent" : "border-rail"}
          />
        </div>
        <div
          className={`mt-2 rounded-lg p-3 ${themed ? "bg-background/70 backdrop-blur" : "bg-panel"}`}
        >
          <h3 className="font-sans text-xl font-bold leading-tight">{nameOf(p)}</h3>
          <p className="text-sm text-muted-foreground">
            {p.username}
            {p.pronouns && <span> · {p.pronouns}</span>}
          </p>
          {p.custom_status && <p className="mt-2 text-sm">{p.custom_status}</p>}
          <div className="my-3 h-px bg-border" />
          {p.bio && (
            <>
              <p className="text-xs font-bold uppercase text-muted-foreground">Sobre mim</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">{p.bio}</p>
            </>
          )}
          {p.created_at && (
            <>
              <p className="mt-3 text-xs font-bold uppercase text-muted-foreground">Membro desde</p>
              <p className="mt-1 text-sm">
                {new Date(p.created_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </>
          )}
          {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
}

export function ViewProfile({
  p,
  onClose,
  actions,
  status,
}: {
  p: Profile | null;
  onClose: () => void;
  actions?: ReactNode;
  status?: string | null | undefined;
}) {
  return (
    <Dialog open={!!p} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[340px] gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-glow [&>button]:hidden">
        <DialogTitle className="sr-only">Perfil de {p ? nameOf(p) : ""}</DialogTitle>
        {p && <ProfileCard p={p} status={status} actions={actions} />}
      </DialogContent>
    </Dialog>
  );
}

const SWATCHES = [
  "#f47fb0",
  "#5865f2",
  "#3ba55d",
  "#faa61a",
  "#ed4245",
  "#9b59b6",
  "#1abc9c",
  "#2c2f33",
];

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (v: string | null) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`h-9 w-9 rounded-md border bg-panel text-xs text-muted-foreground ${!value ? "ring-2 ring-ring" : ""}`}
          title="Padrão"
        >
          —
        </button>
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`h-9 w-9 rounded-md transition hover:scale-105 ${value === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""}`}
            style={{ background: c }}
            aria-label={c}
          />
        ))}
        <label
          className="relative h-9 w-9 cursor-pointer overflow-hidden rounded-md border"
          title="Cor personalizada"
        >
          <input
            type="color"
            value={value || "#f47fb0"}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <span className="flex h-full w-full items-center justify-center text-xs">+</span>
        </label>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 border-b border-border/70 pb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

/** Configurações de usuário em tela cheia, estilo Discord. */
export function EditProfile({
  open,
  onOpenChange,
  me,
  onSaved,
  onLogout,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  me: Profile;
  onSaved: (p: Profile) => void;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<"account" | "profile">("profile");
  const [draft, setDraft] = useState<Profile>(me);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (open) setDraft(me);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(me);
  const set = (patch: Partial<Profile>) => setDraft((d) => ({ ...d, ...patch }));

  async function pick(kind: "avatar" | "banner", file?: File) {
    if (!file) return;
    setBusy(kind);
    try {
      const url = await uploadMedia(me.id, file, kind);
      set(kind === "avatar" ? { avatar_url: url } : { banner_url: url });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy("save");
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: draft.display_name?.trim().slice(0, 32) || null,
        pronouns: draft.pronouns?.trim().slice(0, 40) || null,
        bio: draft.bio?.slice(0, 190) || null,
        custom_status: draft.custom_status?.trim().slice(0, 80) || null,
        avatar_url: draft.avatar_url,
        banner_url: draft.banner_url,
        banner_color: draft.banner_color ?? null,
        theme_primary: draft.theme_primary ?? null,
        theme_accent: draft.theme_accent ?? null,
      })
      .eq("id", me.id);
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    onSaved(draft);
    toast.success("Alterações salvas");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex animate-in fade-in zoom-in-95 duration-150">
      <nav className="hidden w-[260px] shrink-0 justify-end border-r border-border/60 bg-panel py-14 pr-3 sm:flex">
        <div className="w-52 space-y-0.5">
          <p className="px-2.5 pb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Configurações de usuário
          </p>
          <NavItem active={tab === "account"} onClick={() => setTab("account")}>
            <UserRound className="mr-2 inline h-4 w-4" /> Minha conta
          </NavItem>
          <NavItem active={tab === "profile"} onClick={() => setTab("profile")}>
            <Palette className="mr-2 inline h-4 w-4" /> Perfil
          </NavItem>
          <div className="mx-2.5 my-3 h-px bg-border" />
          <NavItem active={false} onClick={onLogout} danger>
            Sair
          </NavItem>
        </div>
      </nav>

      <div className="relative min-w-0 flex-1 overflow-y-auto bg-background">
        <div className="mx-auto max-w-[980px] px-5 py-10 pb-32 sm:px-10 sm:py-14">
          <div className="mb-8 grid gap-1 sm:hidden">
            <NavItem active={tab === "account"} onClick={() => setTab("account")}>
              Minha conta
            </NavItem>
            <NavItem active={tab === "profile"} onClick={() => setTab("profile")}>
              Perfil
            </NavItem>
          </div>

          {tab === "account" ? (
            <>
              <div className="mb-6">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Configurações de usuário
                </p>
                <h2 className="font-sans text-2xl font-bold">Minha conta</h2>
              </div>
              <div className="overflow-hidden rounded-lg bg-rail">
                <div
                  className="h-24"
                  style={{ background: draft.banner_color || "var(--color-accent)" }}
                >
                  {draft.banner_url && (
                    <img src={draft.banner_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex items-end gap-4 px-4 pb-4">
                  <div className="-mt-10 rounded-full bg-rail p-1.5">
                    <Avatar p={draft} size={80} />
                  </div>
                  <p className="pb-2 text-xl font-bold">{nameOf(draft)}</p>
                  <Button size="sm" className="mb-2 ml-auto" onClick={() => setTab("profile")}>
                    Editar perfil
                  </Button>
                </div>
                <div className="m-4 mt-0 space-y-4 rounded-lg bg-panel p-4">
                  <Row label="Nome exibido" value={draft.display_name || "Não definido"} />
                  <Row label="Nome de usuário" value={draft.username} />
                  <p className="text-xs text-muted-foreground">
                    O nome de usuário é usado para entrar e não pode ser alterado.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mb-8">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Configurações de usuário
                </p>
                <h2 className="font-sans text-2xl font-bold">Personalização do perfil</h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Personalize como você aparece para outras pessoas em Calvosfera.
                </p>
              </div>
              <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="space-y-6">
                  <Section title="Nome de exibição">
                    <Input
                      value={draft.display_name ?? ""}
                      onChange={(e) => set({ display_name: e.target.value })}
                      placeholder={draft.username}
                      maxLength={32}
                    />
                    <p className="text-xs text-muted-foreground">
                      Este é o nome que as pessoas verão no seu perfil.
                    </p>
                  </Section>
                  <Section title="Avatar">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="rounded-full bg-rail p-1.5">
                        <Avatar p={draft} size={76} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <UploadBtn
                          busy={busy === "avatar"}
                          onFile={(f) => pick("avatar", f)}
                          icon={<Camera className="h-4 w-4" />}
                        >
                          Alterar avatar
                        </UploadBtn>
                        {draft.avatar_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => set({ avatar_url: null })}
                          >
                            Remover
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG ou GIF animado, até 10 MB.
                    </p>
                  </Section>
                  <Section title="Banner do perfil">
                    <div className="relative h-28 overflow-hidden rounded-lg border border-border bg-accent">
                      {draft.banner_url ? (
                        <img
                          src={draft.banner_url}
                          alt="Prévia do banner"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="h-full w-full"
                          style={{ background: draft.banner_color || "var(--color-accent)" }}
                        />
                      )}
                      <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                        <UploadBtn
                          busy={busy === "banner"}
                          onFile={(f) => pick("banner", f)}
                          icon={<ImagePlus className="h-4 w-4" />}
                        >
                          Alterar banner
                        </UploadBtn>
                        {draft.banner_url && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => set({ banner_url: null })}
                          >
                            <Trash2 className="h-4 w-4" /> Remover
                          </Button>
                        )}
                      </div>
                    </div>
                    <ColorField
                      label="Cor de fundo"
                      value={draft.banner_color}
                      onChange={(v) => set({ banner_color: v })}
                    />
                  </Section>
                  <Section title="Pronomes">
                    <Input
                      value={draft.pronouns ?? ""}
                      onChange={(e) => set({ pronouns: e.target.value })}
                      placeholder="Ex.: ela/dela"
                      maxLength={40}
                    />
                  </Section>
                  <Section title="Tema do perfil">
                    <p className="text-sm text-muted-foreground">
                      Escolha as cores que aparecem no cartão do seu perfil.
                    </p>
                    <div className="space-y-4">
                      <ColorField
                        label="Cor principal"
                        value={draft.theme_primary}
                        onChange={(v) => set({ theme_primary: v })}
                      />
                      <ColorField
                        label="Cor de destaque"
                        value={draft.theme_accent}
                        onChange={(v) => set({ theme_accent: v })}
                      />
                    </div>
                  </Section>
                  <Section title="Status personalizado">
                    <Input
                      value={draft.custom_status ?? ""}
                      onChange={(e) => set({ custom_status: e.target.value })}
                      placeholder="O que está acontecendo?"
                      maxLength={80}
                    />
                    <p className="text-right text-xs text-muted-foreground">
                      {80 - (draft.custom_status?.length ?? 0)} caracteres restantes
                    </p>
                  </Section>
                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Sobre mim
                    </p>
                    <Textarea
                      value={draft.bio ?? ""}
                      onChange={(e) => set({ bio: e.target.value })}
                      maxLength={190}
                      rows={4}
                      placeholder="Conte um pouco sobre você..."
                    />
                    <p className="text-right text-xs text-muted-foreground">
                      {190 - (draft.bio?.length ?? 0)} caracteres restantes
                    </p>
                  </div>
                </div>
                <aside>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Prévia do perfil
                  </p>
                  <div className="lg:sticky lg:top-6">
                    <ProfileCard p={draft} status={draft.status} />
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    Assim seu perfil aparecerá para outras pessoas.
                  </p>
                </aside>
              </div>
            </>
          )}
        </div>

        <div className="fixed right-6 top-14 hidden flex-col items-center gap-1 text-muted-foreground sm:flex">
          <button
            onClick={() => onOpenChange(false)}
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-muted-foreground transition hover:border-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
          <span className="text-xs font-bold">ESC</span>
        </div>
        <button
          onClick={() => onOpenChange(false)}
          className="fixed right-4 top-4 rounded p-2 hover:bg-accent sm:hidden"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        {dirty && (
          <div className="fixed bottom-5 left-1/2 z-10 flex w-[min(700px,calc(100%-2rem))] -translate-x-1/2 items-center gap-3 rounded-lg bg-rail px-4 py-2.5 shadow-glow animate-in slide-in-from-bottom-4">
            <p className="flex-1 text-sm">Cuidado — você tem alterações que não foram salvas!</p>
            <Button variant="ghost" size="sm" onClick={() => setDraft(me)}>
              Redefinir
            </Button>
            <Button
              size="sm"
              disabled={!!busy}
              onClick={save}
              className="bg-online text-background hover:bg-online/90"
            >
              {busy === "save" ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function NavItem({
  active,
  onClick,
  children,
  danger,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded px-2.5 py-2 text-left text-sm transition ${active ? "bg-accent font-medium text-foreground" : danger ? "text-dnd hover:bg-accent/60" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase text-muted-foreground">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}

function UploadBtn({
  busy,
  onFile,
  icon,
  children,
}: {
  busy: boolean;
  onFile: (f?: File) => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-within:ring-2 focus-within:ring-ring">
      {icon}
      {busy ? "Enviando…" : children}
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </label>
  );
}
