import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Activity,
  Camera,
  ChevronDown,
  Gamepad2,
  Heart,
  ImagePlus,
  LayoutGrid,
  MessageCircle,
  MoreHorizontal,
  Palette,
  Plus,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadMedia } from "@/lib/media";
import cityBanner from "@/assets/bg.jpg";
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

function bannerStyle(p: Profile): CSSProperties {
  if (p.banner_color) return { background: p.banner_color };
  if (p.theme_primary) {
    return {
      background: `linear-gradient(120deg, color-mix(in srgb, ${p.theme_primary} 42%, #292632), color-mix(in srgb, ${p.theme_accent || p.theme_primary} 24%, #18171d))`,
    };
  }
  return { background: "linear-gradient(120deg, #302a3c, #1e1c26)" };
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
  const hasDisplayName = !!p.display_name?.trim();
  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#191324] shadow-2xl shadow-black/40">
      <div className="relative overflow-hidden">
        <div className="h-[118px] w-full" style={bannerStyle(p)}>
          {p.banner_url && <img src={p.banner_url} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/25" />
      </div>
      <div className="px-4 pb-4">
        <div className="-mt-10 mb-3 flex items-end justify-between">
          <div className="rounded-full bg-[#191324] p-1.5 shadow-lg shadow-black/30">
            <Avatar p={p} size={76} status={status} ring="border-[#191324]" />
          </div>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-sans text-xl font-bold leading-tight tracking-tight text-white">
              {nameOf(p)}
            </h3>
            <p className="mt-0.5 truncate text-sm text-white/55">
              @{p.username}
              {p.pronouns && <span className="text-white/40"> · {p.pronouns}</span>}
            </p>
          </div>
          {p.theme_primary && (
            <span
              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white/[0.06]"
              style={{ background: p.theme_primary }}
              aria-label="Tema personalizado"
              title="Tema personalizado"
            />
          )}
        </div>
        {p.custom_status && (
          <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.035] px-3 py-2.5">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white/85">
              {p.custom_status}
            </p>
          </div>
        )}
        {(p.bio || p.created_at) && <div className="my-4 h-px bg-white/[0.08]" />}
        {p.bio && (
          <section className="mb-4">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-white/45">
              Sobre mim
            </p>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white/85">
              {p.bio}
            </p>
          </section>
        )}
        {p.created_at && (
          <section>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-white/45">
              Membro desde
            </p>
            <p className="text-sm text-white/80">
              {new Date(p.created_at).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          </section>
        )}
        {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
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

/** Personalização do perfil em uma tela ampla com prévia ao vivo. */
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
  const [profileTab, setProfileTab] = useState<"wall" | "activity" | "wishlist">("wall");
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
    try {
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
      if (error) {
        toast.error(error.message);
        return;
      }
      onSaved(draft);
      toast.success("Alterações salvas");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#080607] text-[#f3eff2] animate-in fade-in duration-150">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[226px_minmax(360px,0.9fr)_minmax(360px,1fr)]">
        <aside className="border-b border-white/[0.08] bg-[#0c0c0e] md:row-span-2 md:border-r md:border-b-0 xl:row-span-1">
          <div className="flex h-14 items-center justify-between border-b border-white/[0.07] px-4">
            <button
              onClick={() => setTab(tab === "profile" ? "account" : "profile")}
              className="flex items-center gap-2 text-sm font-semibold"
            >
              {tab === "profile" ? "Perfil principal" : "Minha conta"}
              <ChevronDown className="h-4 w-4 text-white/50" />
            </button>
            <button
              onClick={() => setTab(tab === "profile" ? "account" : "profile")}
              className="rounded p-1 text-white/50 hover:bg-white/[0.08] hover:text-white"
              aria-label="Alternar seção"
            >
              <UserRound className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[calc(100vh-56px)] space-y-6 overflow-y-auto p-4">
            <div className="space-y-2">
              <SideLabel>Placa de identificação</SideLabel>
              <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#1b1b1e] p-2">
                <Avatar p={draft} size={28} />
                <span className="min-w-0 flex-1 truncate rounded-full bg-white/[0.13] px-2 py-1 text-xs text-white/65">
                  @{draft.username}
                </span>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#161619]">
                  <Plus className="h-4 w-4" />
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <SideLabel>Avatar e decorações</SideLabel>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex h-[94px] items-center justify-center rounded-lg border border-white/[0.08] bg-[#1b1b1e]">
                  <Avatar p={draft} size={66} />
                </div>
                <label className="flex h-[94px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-[#1b1b1e] text-xs text-white/65 transition hover:bg-white/[0.08]">
                  <Camera className="h-5 w-5" />
                  {busy === "avatar" ? "Enviando…" : "Alterar avatar"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => pick("avatar", e.target.files?.[0])}
                  />
                </label>
              </div>
              {draft.avatar_url && (
                <button
                  onClick={() => set({ avatar_url: null })}
                  className="text-xs text-white/50 hover:text-white"
                >
                  Remover avatar
                </button>
              )}
            </div>

            <div className="space-y-2">
              <SideLabel>Estilo do nome exibido</SideLabel>
              <div className="relative">
                <Input
                  value={draft.display_name ?? ""}
                  onChange={(e) => set({ display_name: e.target.value })}
                  placeholder={draft.username}
                  maxLength={32}
                  className="h-10 border-white/[0.08] bg-[#1b1b1e] pr-10 font-semibold"
                />
                <Sparkles className="absolute right-3 top-3 h-4 w-4 text-white/60" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <SideLabel>Tema e faixa</SideLabel>
                <Palette className="h-4 w-4 text-white/45" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ColorField
                  label="Cor do perfil"
                  value={draft.banner_color}
                  onChange={(v) => set({ banner_color: v })}
                />
                <label className="relative flex h-[94px] cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-white/[0.08] bg-[#1b1b1e] text-xs">
                  {draft.banner_url ? (
                    <img
                      src={draft.banner_url}
                      alt="Faixa do perfil"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <img
                      src={cityBanner}
                      alt=""
                      className="h-full w-full object-cover opacity-70"
                    />
                  )}
                  <span className="absolute inset-x-0 bottom-0 bg-black/65 px-1 py-1.5 text-center">
                    {busy === "banner" ? "Enviando…" : "Alterar faixa"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => pick("banner", e.target.files?.[0])}
                  />
                </label>
              </div>
              {draft.banner_url && (
                <button
                  onClick={() => set({ banner_url: null })}
                  className="text-xs text-white/50 hover:text-white"
                >
                  Remover faixa
                </button>
              )}
            </div>

            <div className="space-y-2">
              <SideLabel>Efeitos de perfil e molduras</SideLabel>
              <div className="flex items-center gap-2">
                <div className="relative h-[82px] flex-1 overflow-hidden rounded-lg border border-white/[0.08] bg-[#1b1b1e]">
                  <img
                    src={draft.banner_url || cityBanner}
                    alt=""
                    className="h-full w-full object-cover opacity-60"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Avatar p={draft} size={38} />
                  </div>
                </div>
                <button
                  onClick={() => toast("Molduras de perfil estarão disponíveis em breve.")}
                  className="flex h-[82px] flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/[0.15] bg-[#171719] text-xs text-white/55 hover:bg-white/[0.05]"
                >
                  <Plus className="h-5 w-5" />
                  Ver molduras
                </button>
              </div>
            </div>

            <div className="space-y-3 border-t border-white/[0.08] pt-4">
              <SideLabel>Sobre o perfil</SideLabel>
              <Input
                value={draft.pronouns ?? ""}
                onChange={(e) => set({ pronouns: e.target.value })}
                placeholder="Pronomes (ex.: ela/dela)"
                maxLength={40}
                className="border-white/[0.08] bg-[#1b1b1e]"
              />
              <Input
                value={draft.custom_status ?? ""}
                onChange={(e) => set({ custom_status: e.target.value })}
                placeholder="Status personalizado"
                maxLength={80}
                className="border-white/[0.08] bg-[#1b1b1e]"
              />
              <Textarea
                value={draft.bio ?? ""}
                onChange={(e) => set({ bio: e.target.value })}
                maxLength={190}
                rows={3}
                placeholder="Conte um pouco sobre você..."
                className="border-white/[0.08] bg-[#1b1b1e]"
              />
              <p className="text-right text-[11px] text-white/40">
                {190 - (draft.bio?.length ?? 0)} caracteres restantes
              </p>
              <ColorField
                label="Cor principal do tema"
                value={draft.theme_primary}
                onChange={(v) => set({ theme_primary: v })}
              />
              <ColorField
                label="Cor de destaque do tema"
                value={draft.theme_accent}
                onChange={(v) => set({ theme_accent: v })}
              />
            </div>

            <div className="space-y-1 border-t border-white/[0.08] pt-4">
              <button
                onClick={() => setTab("account")}
                className="w-full rounded-md px-2 py-2 text-left text-sm text-white/65 hover:bg-white/[0.06] hover:text-white"
              >
                Minha conta
              </button>
              <button
                onClick={onLogout}
                className="w-full rounded-md px-2 py-2 text-left text-sm text-red-300 hover:bg-red-400/10"
              >
                Sair
              </button>
            </div>
          </div>
        </aside>

        <main className="relative flex min-h-[620px] items-start justify-center overflow-hidden border-b border-white/[0.08] bg-[#120807] px-5 py-12 md:border-r xl:min-h-screen">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage: `linear-gradient(180deg, transparent 30%, #080506 100%), url(${cityBanner})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          />
          <div className="relative z-10 w-full max-w-[390px] overflow-hidden rounded-t-[18px] border border-white/[0.1] bg-[#0c0909]/95 shadow-2xl shadow-black/50">
            <div className="relative h-44 overflow-hidden bg-[#21161a]">
              <img
                src={draft.banner_url || cityBanner}
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/70" />
              <button
                onClick={() => document.getElementById("profile-banner-upload")?.click()}
                className="absolute right-3 top-3 rounded-md bg-black/45 p-2 text-white/80 hover:bg-black/70"
                aria-label="Alterar faixa do perfil"
              >
                <ImagePlus className="h-4 w-4" />
              </button>
              <input
                id="profile-banner-upload"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => pick("banner", e.target.files?.[0])}
              />
            </div>
            <div className="relative px-6 pb-8">
              <div className="-mt-12 mb-3 flex items-end justify-between">
                <div className="rounded-full bg-[#0c0909] p-1.5">
                  <Avatar
                    p={draft}
                    size={88}
                    status={draft.status ?? "online"}
                    ring="border-[#0c0909]"
                  />
                </div>
                <span className="mb-2 rounded-full border border-white/[0.12] bg-white/[0.08] px-2.5 py-1 text-[11px] text-white/75">
                  Calvosfera
                </span>
              </div>
              {tab === "profile" ? (
                <>
                  <h1 className="font-sans text-2xl font-bold tracking-tight">{nameOf(draft)}</h1>
                  <p className="mt-1 text-sm text-white/55">
                    @{draft.username}
                    {draft.pronouns && ` · ${draft.pronouns}`}
                  </p>
                  {draft.custom_status && (
                    <div className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-sm text-white/80">
                      {draft.custom_status}
                    </div>
                  )}
                  <div className="my-5 h-px bg-white/[0.1]" />
                  {draft.bio ? (
                    <section className="mb-6">
                      <p className="mb-2 text-xs font-bold text-white/60">Sobre mim</p>
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white/85">
                        {draft.bio}
                      </p>
                    </section>
                  ) : (
                    <p className="mb-6 text-sm italic text-white/45">
                      Adicione uma bio para se apresentar.
                    </p>
                  )}
                  <section className="mb-6">
                    <p className="mb-2 text-xs font-bold text-white/60">Membro desde</p>
                    <p className="text-sm text-white/85">
                      {draft.created_at
                        ? new Date(draft.created_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "Agora"}
                    </p>
                  </section>
                  <section className="mb-6">
                    <p className="mb-2 text-xs font-bold text-white/60">Conexões</p>
                    <button
                      onClick={() => toast("Conexões estarão disponíveis em breve.")}
                      className="text-sm text-white/70 transition hover:text-white"
                    >
                      <Plus className="mr-1 inline h-4 w-4" /> Adicionar conexão
                    </button>
                  </section>
                  <div className="flex gap-2">
                    <button className="flex items-center gap-2 rounded-lg bg-white/[0.13] px-4 py-2 text-sm font-semibold text-white/70">
                      <MessageCircle className="h-4 w-4" /> Mensagem
                    </button>
                    <button
                      className="rounded-lg bg-white/[0.1] p-2 text-white/80"
                      aria-label="Mais opções"
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-white/[0.08] bg-[#191416] p-5">
                  <p className="font-semibold">{draft.display_name || draft.username}</p>
                  <p className="mt-2 text-sm text-white/55">Nome de usuário: @{draft.username}</p>
                  <p className="mt-4 text-xs text-white/40">
                    Seu nome de usuário é usado para entrar e não pode ser alterado.
                  </p>
                  <Button size="sm" className="mt-4" onClick={() => setTab("profile")}>
                    Voltar ao perfil
                  </Button>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.16] bg-white/[0.06] text-white/70 transition hover:bg-white/[0.12] hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </main>

        <section className="min-w-0 bg-[#0e0b0c] px-6 py-14 md:col-span-2 md:px-8 xl:col-span-1 xl:px-7">
          <div className="flex items-center gap-6 border-b border-white/[0.09]">
            <ProfileNavItem active={profileTab === "wall"} onClick={() => setProfileTab("wall")}>
              Mural
            </ProfileNavItem>
            <ProfileNavItem
              active={profileTab === "activity"}
              onClick={() => setProfileTab("activity")}
            >
              Atividade
            </ProfileNavItem>
            <ProfileNavItem
              active={profileTab === "wishlist"}
              onClick={() => setProfileTab("wishlist")}
            >
              Lista de desejos
            </ProfileNavItem>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-white/70">
              {profileTab === "wall"
                ? "Seus Widgets"
                : profileTab === "activity"
                  ? "Atividade recente"
                  : "Lista de desejos"}
            </p>
            <button
              onClick={() => toast("Widgets e integrações estarão disponíveis em breve.")}
              className="flex items-center gap-2 rounded-lg border border-white/[0.1] bg-[#242123] px-3 py-2 text-xs font-medium text-white/75 transition hover:bg-white/[0.1]"
            >
              <Plus className="h-4 w-4" /> Adicionar widget
            </button>
          </div>

          {profileTab === "wall" ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#21191b]">
              <div className="relative min-h-[152px] overflow-hidden border-b border-white/[0.07] p-4">
                <div className="absolute inset-0 bg-gradient-to-r from-[#39272b] via-[#261d20] to-[#1c1719]" />
                <div className="absolute -right-4 -top-10 h-48 w-48 rounded-full bg-fuchsia-300/[0.08] blur-3xl" />
                <div className="relative">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white/85">
                    <Gamepad2 className="h-4 w-4 text-pink-200" /> Widget de jogos
                  </div>
                  <div className="mt-8 grid max-w-[78%] grid-cols-2 gap-x-5 gap-y-4">
                    {["Nível", "Jogos", "Conquistas", "Atividade"].map((label) => (
                      <div key={label} className="space-y-1.5">
                        <div className="h-3 w-20 rounded-full bg-white/[0.12]" />
                        <p className="text-[10px] text-white/50">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div className="rounded-xl border border-white/[0.07] bg-[#30282a] p-4">
                  <p className="text-sm font-semibold">
                    Conecte sua conta para ver suas estatísticas
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-white/55">
                    Este widget não aparecerá no seu perfil até que você conecte uma conta.
                  </p>
                  <button
                    onClick={() => toast("Integração de jogos estará disponível em breve.")}
                    className="mt-3 rounded-md bg-white/[0.18] px-4 py-2 text-sm font-semibold transition hover:bg-white/[0.25]"
                  >
                    Conectar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex min-h-56 flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#171416] px-6 text-center">
              {profileTab === "activity" ? (
                <Activity className="mb-3 h-8 w-8 text-white/35" />
              ) : (
                <Heart className="mb-3 h-8 w-8 text-white/35" />
              )}
              <p className="text-sm font-semibold text-white/75">
                {profileTab === "activity" ? "Sem atividade para mostrar" : "Sua lista está vazia"}
              </p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-white/45">
                {profileTab === "activity"
                  ? "Quando você participar das conversas, suas atividades aparecerão aqui."
                  : "Adicione seus jogos, animes e interesses favoritos ao seu perfil."}
              </p>
            </div>
          )}
          <p className="mt-5 flex items-center gap-2 text-xs text-white/35">
            <LayoutGrid className="h-3.5 w-3.5" />
            Prévia do seu perfil público
          </p>
        </section>
      </div>

      {dirty && (
        <div className="fixed bottom-4 left-1/2 z-[60] flex w-[min(700px,calc(100%-2rem))] -translate-x-1/2 items-center gap-3 rounded-lg border border-white/[0.1] bg-[#242123] px-4 py-2.5 shadow-2xl animate-in slide-in-from-bottom-4">
          <p className="flex-1 text-sm">Você tem alterações que ainda não foram salvas.</p>
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
  );
}

function SideLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold text-white/80">{children}</p>;
}

function ProfileNavItem({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative shrink-0 pb-3 text-sm font-semibold transition ${
        active ? "text-white" : "text-white/50 hover:text-white/80"
      }`}
    >
      {children}
      {active && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-white" />}
    </button>
  );
}
