import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  Activity,
  CalendarDays,
  Camera,
  ChevronDown,
  Copy,
  ExternalLink,
  Heart,
  ImagePlus,
  LayoutGrid,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Palette,
  Plus,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadMedia } from "@/lib/media";
import cityBanner from "@/assets/bg.jpg";
import type { Json } from "@/integrations/supabase/types";
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
  profile_extras?: Json;
};

export const PROFILE_COLS =
  "id,username,display_name,avatar_url,banner_url,banner_color,bio,pronouns,theme_primary,theme_accent,status,custom_status,created_at,profile_extras";
export const LEGACY_PROFILE_COLS =
  "id,username,display_name,avatar_url,banner_url,banner_color,bio,pronouns,theme_primary,theme_accent,status,custom_status,created_at";

const profileExtrasCacheKey = (userId: string) => `calvosfera:profile-extras:${userId}`;

export function readProfileExtrasCache(userId: string): Json | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const value = window.localStorage.getItem(profileExtrasCacheKey(userId));
    return value ? (JSON.parse(value) as Json) : undefined;
  } catch (error) {
    toast.error(
      `Não foi possível ler as opções salvas neste dispositivo: ${error instanceof Error ? error.message : "erro inesperado"}`,
    );
    return undefined;
  }
}

export function writeProfileExtrasCache(userId: string, value: Json) {
  window.localStorage.setItem(profileExtrasCacheKey(userId), JSON.stringify(value));
}

type ProfileConnection = { id: string; label: string; url: string };
type ProfileWidget = { id: string; title: string; description: string; url: string };
type AvatarFrame = "none" | "sakura" | "gold";
type ProfileEffect = "none" | "aurora" | "sakura" | "holographic" | "ember";
type ProfileExtras = {
  badge: string;
  avatar_frame: AvatarFrame;
  profile_effect: ProfileEffect;
  connections: ProfileConnection[];
  widgets: ProfileWidget[];
  wishlist: string[];
};

function profileExtras(value: Json | undefined): ProfileExtras {
  const data =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as { [key: string]: Json | undefined })
      : {};
  const connections = Array.isArray(data["connections"])
    ? data["connections"].flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const connection = item as { [key: string]: Json | undefined };
        return typeof connection["id"] === "string" &&
          typeof connection["label"] === "string" &&
          typeof connection["url"] === "string"
          ? [
              {
                id: connection["id"],
                label: connection["label"],
                url: connection["url"],
              },
            ]
          : [];
      })
    : [];
  const widgets = Array.isArray(data["widgets"])
    ? data["widgets"].flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const widget = item as { [key: string]: Json | undefined };
        return typeof widget["id"] === "string" &&
          typeof widget["title"] === "string" &&
          typeof widget["description"] === "string" &&
          typeof widget["url"] === "string"
          ? [
              {
                id: widget["id"],
                title: widget["title"],
                description: widget["description"],
                url: widget["url"],
              },
            ]
          : [];
      })
    : [];
  const wishlist = Array.isArray(data["wishlist"])
    ? data["wishlist"].filter((item): item is string => typeof item === "string")
    : [];

  return {
    badge: typeof data["badge"] === "string" ? data["badge"] : "",
    avatar_frame:
      data["avatar_frame"] === "sakura" || data["avatar_frame"] === "gold"
        ? data["avatar_frame"]
        : "none",
    profile_effect:
      data["profile_effect"] === "aurora" ||
      data["profile_effect"] === "sakura" ||
      data["profile_effect"] === "holographic" ||
      data["profile_effect"] === "ember"
        ? data["profile_effect"]
        : "none",
    connections,
    widgets,
    wishlist,
  };
}

function avatarFrameClass(frame: AvatarFrame) {
  if (frame === "sakura")
    return "bg-gradient-to-br from-pink-200 via-fuchsia-500 to-pink-300 p-1.5 shadow-[0_0_18px_#ec489966]";
  if (frame === "gold")
    return "bg-gradient-to-br from-yellow-100 via-amber-500 to-yellow-200 p-1.5 shadow-[0_0_18px_#f59e0b66]";
  return "bg-popover p-1.5 shadow-lg shadow-glow";
}

function safeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

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
  if (p.theme_primary) {
    return {
      background: `linear-gradient(125deg, color-mix(in srgb, ${p.banner_color || p.theme_primary} 64%, ${p.theme_primary}), color-mix(in srgb, ${p.theme_accent || p.theme_primary} 44%, var(--rail)) 58%, color-mix(in srgb, ${p.theme_primary} 18%, var(--panel)))`,
    };
  }
  if (p.banner_color) return { background: `linear-gradient(135deg, ${p.banner_color}, var(--rail))` };
  return { background: "var(--gradient-sakura)" };
}

function profileEffectClass(effect: ProfileEffect) {
  return effect === "none" ? "" : `profile-effect profile-effect-${effect}`;
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
  const extras = profileExtras(p.profile_extras);
  const presence = (status ?? p.status ?? "invisible") as Status;
  async function copyHandle() {
    try {
      await navigator.clipboard.writeText(`@${p.username}`);
      toast.success("Nome de usuário copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o nome de usuário manualmente.");
    }
  }

  return (
    <div
      className="profile-card w-full overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl shadow-glow"
      style={{ "--profile-accent": p.theme_primary || "var(--primary)" } as CSSProperties}
    >
      <div className="profile-card-banner relative overflow-hidden">
        <div className={`h-36 w-full ${profileEffectClass(extras.profile_effect)}`} style={bannerStyle(p)}>
          {p.banner_url && <img src={p.banner_url} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/70" />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1 opacity-90"
          style={{ background: "linear-gradient(90deg, var(--profile-accent), transparent 78%)" }}
        />
        <div className="absolute bottom-3 left-4 flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white/90 backdrop-blur-sm">
          <Sparkles className="h-3 w-3" /> PERFIL DA CALVOSFERA
        </div>
      </div>
      <div className="px-4 pb-4">
        <div className="relative -mt-11 mb-3 flex items-end justify-between">
          <div className={`rounded-full ring-4 ring-popover ${avatarFrameClass(extras.avatar_frame)}`}>
            <Avatar p={p} size={84} status={presence} ring="border-popover" />
          </div>
          <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] font-medium text-foreground/85">
            <span className={`h-2 w-2 rounded-full ${dotClass(presence)}`} />
            {STATUS_LABEL[presence] ?? STATUS_LABEL.invisible}
          </div>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="break-words font-display text-2xl font-bold leading-tight tracking-tight text-foreground">
              {nameOf(p)}
            </h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
              <span className="break-all">@{p.username}</span>
              {p.pronouns && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{p.pronouns}</span>
                </>
              )}
            </p>
          </div>
          {p.theme_primary && (
            <span
              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-border"
              style={{ background: p.theme_primary }}
              aria-label="Tema personalizado"
              title="Tema personalizado"
            />
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void copyHandle()}
          className="mt-3 h-8 gap-1.5 rounded-lg border-border bg-background/50 px-2.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Copy className="h-3.5 w-3.5" /> Copiar usuário
        </Button>
        {extras.badge && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-primary/10 px-2.5 py-1 text-xs font-semibold text-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            {extras.badge}
          </p>
        )}
        {p.custom_status && (
          <div className="mt-4 rounded-xl border border-border bg-background/50 px-3.5 py-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Status
            </p>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
              {p.custom_status}
            </p>
          </div>
        )}
        {(p.bio || p.created_at || extras.connections.length > 0 || extras.widgets.length > 0 || extras.wishlist.length > 0) && <div className="my-4 h-px bg-border" />}
        {p.bio && (
          <section className="mb-4 rounded-xl border border-border/80 bg-background/35 p-3.5">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Sobre mim
            </p>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
              {p.bio}
            </p>
          </section>
        )}
        {p.created_at && (
          <section className="flex items-center gap-2.5 rounded-lg px-1 py-1.5">
            <CalendarDays className="h-4 w-4 shrink-0" style={{ color: "var(--profile-accent)" }} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Na Calvosfera desde
              </p>
              <p className="mt-0.5 text-xs font-medium text-foreground/90">
                {new Date(p.created_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </section>
        )}
        {extras.connections.length > 0 && (
          <section className="mt-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Conexões
            </p>
            <div className="flex flex-wrap gap-2">
              {extras.connections.map((connection) => {
                const url = safeExternalUrl(connection.url);
                return url ? (
                  <a
                    key={connection.id}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground/80 hover:bg-accent"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {connection.label}
                  </a>
                ) : null;
              })}
            </div>
          </section>
        )}
        {extras.widgets.length > 0 && (
          <section className="mt-4 space-y-2">
            {extras.widgets.map((widget) => {
              const url = safeExternalUrl(widget.url);
              return (
                <div key={widget.id} className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-sm font-semibold">{widget.title}</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                    {widget.description}
                  </p>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Abrir link
                    </a>
                  )}
                </div>
              );
            })}
          </section>
        )}
        {extras.wishlist.length > 0 && (
          <section className="mt-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Lista de desejos
            </p>
            <ul className="list-inside list-disc space-y-1 text-sm text-foreground/80">
              {extras.wishlist.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
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
      <DialogContent className="max-h-[90dvh] max-w-[380px] gap-0 overflow-y-auto border-0 bg-transparent p-0 shadow-glow [&>button]:right-3 [&>button]:top-3 [&>button]:z-20 [&>button]:rounded-full [&>button]:bg-black/45 [&>button]:p-2 [&>button]:text-white [&>button]:backdrop-blur-sm">
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

const PROFILE_PALETTES = [
  { name: "Sakura", primary: "#f47fb0", accent: "#9b59b6", banner: "#39202f" },
  { name: "Aurora", primary: "#54d6b4", accent: "#5865f2", banner: "#152d35" },
  { name: "Pôr do sol", primary: "#ffad73", accent: "#ed5b86", banner: "#382323" },
  { name: "Noite", primary: "#a991ff", accent: "#55c9d8", banner: "#211d3d" },
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
        <Button
          variant="ghost"
          type="button"
          onClick={() => onChange(null)}
          className={`h-9 w-9 rounded-md border bg-panel text-xs text-muted-foreground ${!value ? "ring-2 ring-ring" : ""}`}
          title="Padrão"
        >
          —
        </Button>
        {SWATCHES.map((c) => (
          <Button
            variant="ghost"
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
  const [activeEditorSection, setActiveEditorSection] = useState("profile-identity");
  const [draft, setDraft] = useState<Profile>(me);
  const [savedDraft, setSavedDraft] = useState<Profile>(me);
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedDraft);
  const closeEditor = useCallback(() => {
    if (dirty && !window.confirm("Você tem alterações não salvas. Deseja sair mesmo assim?"))
      return;
    onOpenChange(false);
  }, [dirty, onOpenChange]);
  const [busy, setBusy] = useState<string | null>(null);
  const [editorKind, setEditorKind] = useState<
    "badge" | "connection" | "widget" | "wishlist" | null
  >(null);
  const [entryTitle, setEntryTitle] = useState("");
  const [entryDescription, setEntryDescription] = useState("");
  const [entryUrl, setEntryUrl] = useState("");
  const [recentActivity, setRecentActivity] = useState<{ content: string; created_at: string }[]>(
    [],
  );
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    if (open) {
      const cachedExtras = readProfileExtrasCache(me.id);
      const extrasValue = me.profile_extras ?? cachedExtras;
      const initialDraft = {
        ...me,
        ...(extrasValue === undefined ? {} : { profile_extras: extrasValue }),
      };
      setDraft(initialDraft);
      setSavedDraft(initialDraft);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeEditor();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeEditor]);

  useEffect(() => {
    if (!open || profileTab !== "activity") return;
    let cancelled = false;
    setActivityLoading(true);
    setRecentActivity([]);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("content,created_at")
          .eq("user_id", me.id)
          .order("created_at", { ascending: false })
          .limit(8);
        if (cancelled) return;
        if (error) {
          setActivityLoading(false);
          toast.error(`Não foi possível carregar a atividade: ${error.message}`);
          return;
        }
        setRecentActivity(data ?? []);
        setActivityLoading(false);
      } catch (error) {
        if (cancelled) return;
        setActivityLoading(false);
        toast.error(
          `Não foi possível carregar a atividade: ${error instanceof Error ? error.message : "erro inesperado"}`,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, profileTab, me.id]);

  const set = (patch: Partial<Profile>) => setDraft((d) => ({ ...d, ...patch }));
  const extras = profileExtras(draft.profile_extras);
  const setExtras = (patch: Partial<ProfileExtras>) =>
    set({ profile_extras: { ...profileExtras(draft.profile_extras), ...patch } });

  function jumpToSection(sectionId: string) {
    setActiveEditorSection(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openEditor(kind: NonNullable<typeof editorKind>) {
    setEntryTitle("");
    setEntryDescription("");
    setEntryUrl("");
    setEditorKind(kind);
  }

  function submitEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editorKind === "badge") {
      setExtras({ badge: entryTitle.trim().slice(0, 32) });
    } else if (editorKind === "connection") {
      const url = safeExternalUrl(entryUrl.trim());
      if (!url) {
        toast.error("Informe um link válido iniciado por https:// ou http://.");
        return;
      }
      if (extras.connections.length >= 10) {
        toast.error("Você pode adicionar até 10 conexões.");
        return;
      }
      setExtras({
        connections: [
          ...extras.connections,
          { id: crypto.randomUUID(), label: entryTitle.trim().slice(0, 32), url },
        ],
      });
    } else if (editorKind === "widget") {
      const validatedUrl = entryUrl.trim() ? safeExternalUrl(entryUrl.trim()) : "";
      if (validatedUrl === null) {
        toast.error("Informe um link válido iniciado por https:// ou http://.");
        return;
      }
      if (extras.widgets.length >= 8) {
        toast.error("Você pode adicionar até 8 widgets.");
        return;
      }
      setExtras({
        widgets: [
          ...extras.widgets,
          {
            id: crypto.randomUUID(),
            title: entryTitle.trim().slice(0, 48),
            description: entryDescription.trim().slice(0, 240),
            url: validatedUrl,
          },
        ],
      });
    } else if (editorKind === "wishlist") {
      if (extras.wishlist.length >= 20) {
        toast.error("Você pode adicionar até 20 itens à lista.");
        return;
      }
      setExtras({ wishlist: [...extras.wishlist, entryTitle.trim().slice(0, 64)] });
    }
    setEditorKind(null);
    toast.success("Adicionado à prévia. Salve as alterações para publicar.");
  }

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
      const extrasToSave = profileExtras(draft.profile_extras);
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: draft.display_name?.trim().slice(0, 32) || null,
          pronouns: draft.pronouns?.trim().slice(0, 40) || null,
          bio: draft.bio?.slice(0, 190) || null,
          status: draft.status ?? "online",
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
      try {
        writeProfileExtrasCache(me.id, extrasToSave);
      } catch (error) {
        toast.error(
          `Perfil salvo, mas não foi possível guardar widgets e conexões neste dispositivo: ${error instanceof Error ? error.message : "erro inesperado"}`,
        );
      }

      const { error: extrasError } = await supabase
        .from("profiles")
        .update({ profile_extras: extrasToSave })
        .eq("id", me.id);
      const savedProfile = { ...draft, profile_extras: extrasToSave };
      setSavedDraft(savedProfile);
      onSaved(savedProfile);

      if (
        extrasError?.code === "42703" ||
        extrasError?.code === "PGRST204" ||
        extrasError?.message.includes("profile_extras")
      ) {
        toast.warning(
          "Perfil salvo. Widgets, conexões e moldura ficam neste dispositivo até a migração do banco ser aplicada.",
        );
      } else if (extrasError) {
        toast.error(
          `Perfil salvo, mas não foi possível sincronizar widgets e conexões: ${extrasError.message}`,
        );
      } else {
        toast.success("Alterações salvas");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background text-foreground animate-in fade-in duration-150">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[minmax(250px,290px)_minmax(0,1fr)] xl:min-h-dvh xl:grid-cols-[minmax(270px,300px)_minmax(330px,0.9fr)_minmax(320px,1fr)]">
        <aside className="border-b border-border bg-rail md:row-span-2 md:border-r md:border-b-0 xl:row-span-1">
          <div className="flex h-14 items-center justify-between border-b border-border px-4">
            <button
              onClick={() => setTab(tab === "profile" ? "account" : "profile")}
              className="flex min-w-0 items-center gap-2 text-sm font-semibold transition hover:text-primary"
            >
              <Avatar p={draft} size={28} />
              <span className="truncate">
                {tab === "profile" ? "Perfil principal" : "Minha conta"}
              </span>
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

          <div className="max-h-[calc(100vh-56px)] space-y-5 overflow-y-auto p-4">
            <div className="space-y-1 border-b border-border pb-4">
              <p className="px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Configurações
              </p>
              {[
                ["profile-identity", "Meu perfil"],
                ["profile-appearance", "Aparência"],
                ["profile-about", "Sobre mim"],
                ["profile-content", "Conteúdo do perfil"],
              ].map(([sectionId, label]) => (
                <button
                  key={sectionId}
                  type="button"
                  onClick={() => jumpToSection(sectionId)}
                  aria-current={activeEditorSection === sectionId ? "location" : undefined}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${activeEditorSection === sectionId ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div id="profile-identity" className="scroll-mt-4 space-y-4">
              <div className="border-b border-border pb-3">
                <p className="text-sm font-semibold text-foreground">Identidade</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Escolha como as pessoas vão reconhecer você na comunidade.
                </p>
              </div>
              <div className="space-y-2">
                <SideLabel>Placa de identificação</SideLabel>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-panel p-2">
                  <Avatar p={draft} size={28} />
                  <span className="min-w-0 flex-1 truncate rounded-full bg-white/[0.13] px-2 py-1 text-xs text-white/65">
                    {extras.badge || `@${draft.username}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => openEditor("badge")}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#161619] transition hover:scale-110"
                    aria-label="Editar placa de identificação"
                    title="Editar placa de identificação"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <SideLabel>Avatar e decorações</SideLabel>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex h-[94px] items-center justify-center rounded-xl border border-border bg-panel">
                    <Avatar p={draft} size={66} />
                  </div>
                  <label className="flex h-[94px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-border bg-panel text-xs text-muted-foreground transition hover:bg-accent">
                    <Camera className="h-5 w-5" />
                    {busy === "avatar" ? "Enviando…" : "Alterar avatar"}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.currentTarget.files?.[0];
                        e.currentTarget.value = "";
                        void pick("avatar", file);
                      }}
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
                    className="h-10 border-border bg-panel pr-10 font-semibold"
                  />
                  <Sparkles className="absolute right-3 top-3 h-4 w-4 text-white/60" />
                </div>
              </div>
            </div>

            <div
              id="profile-appearance"
              className="scroll-mt-4 space-y-4 border-t border-border pt-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Aparência</p>
                    <p className="mt-1 text-xs text-muted-foreground">Gradientes, faixa e detalhes visuais.</p>
                  </div>
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
                      onChange={(e) => {
                        const file = e.currentTarget.files?.[0];
                        e.currentTarget.value = "";
                        void pick("banner", file);
                      }}
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
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
                    Paletas rápidas
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {PROFILE_PALETTES.map((palette) => (
                      <button
                        key={palette.name}
                        type="button"
                        aria-pressed={
                          draft.theme_primary === palette.primary &&
                          draft.theme_accent === palette.accent
                        }
                        onClick={() =>
                          set({
                            theme_primary: palette.primary,
                            theme_accent: palette.accent,
                            banner_color: palette.banner,
                          })
                        }
                        className={`group flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition hover:bg-accent ${draft.theme_primary === palette.primary && draft.theme_accent === palette.accent ? "border-primary/60 bg-primary/10 text-foreground" : "border-border bg-panel text-muted-foreground"}`}
                      >
                        <span className="flex -space-x-1.5">
                          <span
                            className="h-4 w-4 rounded-full border border-black/30"
                            style={{ background: palette.primary }}
                          />
                          <span
                            className="h-4 w-4 rounded-full border border-black/30"
                            style={{ background: palette.accent }}
                          />
                        </span>
                        <span className="truncate group-hover:text-white">{palette.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <SideLabel>Efeitos de perfil e molduras</SideLabel>
                <div className="flex items-center gap-2">
                  <div className="relative h-[82px] flex-1 overflow-hidden rounded-xl border border-border bg-panel">
                    <img
                      src={draft.banner_url || cityBanner}
                      alt=""
                      className="h-full w-full object-cover opacity-60"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className={`rounded-full ${avatarFrameClass(extras.avatar_frame)}`}>
                        <Avatar p={draft} size={38} />
                      </div>
                    </div>
                  </div>
                  <div className="flex h-[82px] flex-1 flex-col justify-center gap-1 rounded-xl border border-border bg-card p-2">
                    {(
                      [
                        ["none", "Padrão"],
                        ["sakura", "Sakura"],
                        ["gold", "Dourada"],
                      ] as const
                    ).map(([frame, label]) => (
                      <button
                        key={frame}
                        type="button"
                        onClick={() => setExtras({ avatar_frame: frame })}
                        className={`rounded px-2 py-1 text-left text-xs transition ${
                          extras.avatar_frame === frame
                            ? "bg-primary/25 text-white"
                            : "text-white/55 hover:bg-white/[0.08] hover:text-white"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <SideLabel>Efeito da faixa</SideLabel>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Escolha uma camada visual sutil. Ela aparece na prévia e no perfil público.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["none", "Sem efeito", "Visual limpo"],
                    ["aurora", "Aurora", "Luzes fluidas"],
                    ["sakura", "Pétalas", "Brilho rosado"],
                    ["holographic", "Irisado", "Reflexos de cor"],
                    ["ember", "Brasa", "Luz quente"],
                  ] as const).map(([effect, label, description]) => (
                    <button
                      key={effect}
                      type="button"
                      aria-pressed={extras.profile_effect === effect}
                      onClick={() => setExtras({ profile_effect: effect })}
                      className={`rounded-lg border p-2 text-left transition ${extras.profile_effect === effect ? "border-primary/60 bg-primary/10" : "border-border bg-panel hover:bg-accent"}`}
                    >
                      <span className={`mb-2 block h-5 rounded ${profileEffectClass(effect)}`} style={bannerStyle(draft)} />
                      <span className="block text-xs font-semibold">{label}</span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">{description}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div id="profile-about" className="scroll-mt-4 space-y-3 border-t border-border pt-4">
              <div className="pb-1">
                <p className="text-sm font-semibold text-foreground">Sobre você</p>
                <p className="mt-1 text-xs text-muted-foreground">Defina o que aparece junto ao seu nome.</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Adicione detalhes para as pessoas conhecerem você melhor.
              </p>
              <SideLabel>Sobre o perfil</SideLabel>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-panel px-3 py-2 text-sm">
                <span>Presença</span>
                <select
                  aria-label="Estado de presença"
                  value={draft.status ?? "online"}
                  onChange={(event) => set({ status: event.target.value })}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="online">Online</option>
                  <option value="idle">Ausente</option>
                  <option value="dnd">Não perturbe</option>
                  <option value="invisible">Invisível</option>
                </select>
              </label>
              <Input
                value={draft.pronouns ?? ""}
                onChange={(e) => set({ pronouns: e.target.value })}
                placeholder="Pronomes (ex.: ela/dela)"
                maxLength={40}
                className="border-border bg-panel"
              />
              <Input
                id="profile-status-input"
                value={draft.custom_status ?? ""}
                onChange={(e) => set({ custom_status: e.target.value })}
                placeholder="Status personalizado"
                maxLength={80}
                className="border-border bg-panel"
              />
              <Textarea
                value={draft.bio ?? ""}
                onChange={(e) => set({ bio: e.target.value })}
                maxLength={190}
                rows={3}
                placeholder="Conte um pouco sobre você..."
                className="border-border bg-panel"
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

            <div className="space-y-1 border-t border-border pt-4">
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

        <main className="relative flex min-h-[620px] flex-col items-center justify-start gap-5 overflow-hidden border-b border-border bg-rail px-5 py-8 md:border-r xl:min-h-screen xl:px-7 xl:py-10">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage: `var(--gradient-aurora), linear-gradient(180deg, transparent 30%, var(--background) 100%), url(${cityBanner})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          />
          <div className="relative z-10 flex w-full max-w-[390px] items-center justify-between px-1">
            <div>
              <p className="text-sm font-semibold">Prévia do perfil</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                As alterações aparecem em tempo real
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-online/20 bg-online/10 px-2.5 py-1 text-[10px] font-semibold text-online">
              <span className="h-1.5 w-1.5 rounded-full bg-online" /> AO VIVO
            </span>
          </div>
          <div className="relative z-10 w-full max-w-[390px] overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl shadow-black/50">
            <div className={`relative h-44 overflow-hidden ${profileEffectClass(extras.profile_effect)}`} style={bannerStyle(draft)}>
              {draft.banner_url ? (
                <img src={draft.banner_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <img
                  src={cityBanner}
                  alt=""
                  className="h-full w-full object-cover opacity-35 mix-blend-screen"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/70" />
              <div
                className="absolute inset-x-0 bottom-0 h-1"
                style={{
                  background: draft.theme_accent || draft.theme_primary || "var(--primary)",
                }}
              />
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
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  e.currentTarget.value = "";
                  void pick("banner", file);
                }}
              />
            </div>
            <div className="relative px-6 pb-8">
              <div className="-mt-12 mb-3 flex items-end justify-between">
                <div className="rounded-full bg-popover p-1.5">
                  <div className={`rounded-full ${avatarFrameClass(extras.avatar_frame)}`}>
                    <Avatar
                      p={draft}
                      size={88}
                      status={draft.status ?? "online"}
                      ring="border-popover"
                    />
                  </div>
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
                  {extras.badge && (
                    <span className="mt-2 inline-flex rounded-full bg-white/[0.1] px-2.5 py-1 text-xs font-semibold text-white/80">
                      {extras.badge}
                    </span>
                  )}
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
                    {extras.connections.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {extras.connections.map((connection) => {
                          const url = safeExternalUrl(connection.url);
                          return url ? (
                            <span
                              key={connection.id}
                              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.12] bg-white/[0.05] px-2.5 py-1.5 text-xs text-white/75"
                            >
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 hover:text-white"
                              >
                                <ExternalLink className="h-3 w-3" />
                                {connection.label}
                              </a>
                              <button
                                onClick={() =>
                                  setExtras({
                                    connections: extras.connections.filter(
                                      (item) => item.id !== connection.id,
                                    ),
                                  })
                                }
                                className="rounded text-white/45 hover:text-white"
                                aria-label={`Remover conexão ${connection.label}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                    <button
                      onClick={() => openEditor("connection")}
                      className="text-sm text-white/70 transition hover:text-white"
                    >
                      <Plus className="mr-1 inline h-4 w-4" /> Adicionar conexão
                    </button>
                  </section>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setTab("profile");
                        document.getElementById("profile-status-input")?.focus();
                      }}
                      className="flex items-center gap-2 rounded-lg bg-white/[0.13] px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/[0.2]"
                    >
                      <MessageCircle className="h-4 w-4" /> Editar status
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(`@${draft.username}`);
                          toast.success("Nome de usuário copiado.");
                        } catch {
                          toast.error("Não foi possível copiar o nome de usuário.");
                        }
                      }}
                      className="rounded-lg bg-white/[0.1] p-2 text-white/80 transition hover:bg-white/[0.18]"
                      aria-label="Copiar nome de usuário"
                      title="Copiar nome de usuário"
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
            onClick={closeEditor}
            className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.16] bg-white/[0.06] text-white/70 transition hover:bg-white/[0.12] hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </main>

        <section
          id="profile-content"
          className="min-w-0 scroll-mt-5 bg-panel px-5 py-8 md:col-span-2 md:px-8 xl:col-span-1 xl:px-7 xl:py-10"
        >
          <div className="mb-6">
            <p className="text-sm font-semibold">Seu espaço</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Personalize o conteúdo que aparece no seu perfil.
            </p>
          </div>
          <div
            role="tablist"
            aria-label="Conteúdo do perfil"
            className="flex items-center gap-6 border-b border-border"
          >
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
            {profileTab !== "activity" && (
              <button
                onClick={() => openEditor(profileTab === "wall" ? "widget" : "wishlist")}
                className="flex items-center gap-2 rounded-lg border border-white/[0.1] bg-[#242123] px-3 py-2 text-xs font-medium text-white/75 transition hover:bg-white/[0.1]"
              >
                <Plus className="h-4 w-4" />
                {profileTab === "wall" ? "Adicionar widget" : "Adicionar item"}
              </button>
            )}
          </div>

          {editorKind && (
            <form
              onSubmit={submitEditor}
              className="mt-4 space-y-3 rounded-xl border border-border bg-card p-4"
            >
              <p className="text-sm font-semibold">
                {editorKind === "badge" ? (
                  "Placa de identificação"
                ) : editorKind === "connection" ? (
                  <>
                    <Link2 className="mr-2 inline h-4 w-4" />
                    Adicionar conexão
                  </>
                ) : editorKind === "widget" ? (
                  "Criar widget"
                ) : (
                  "Adicionar à lista de desejos"
                )}
              </p>
              <Input
                autoFocus
                value={entryTitle}
                onChange={(event) => setEntryTitle(event.target.value)}
                maxLength={editorKind === "wishlist" ? 64 : editorKind === "widget" ? 48 : 32}
                required={editorKind !== "badge"}
                placeholder={
                  editorKind === "connection"
                    ? "Nome (ex.: Instagram)"
                    : editorKind === "widget"
                      ? "Título do widget"
                      : editorKind === "wishlist"
                        ? "Jogo, anime ou interesse"
                        : "Texto da placa"
                }
                className="border-border bg-background"
              />
              {(editorKind === "connection" || editorKind === "widget") && (
                <Input
                  value={entryUrl}
                  onChange={(event) => setEntryUrl(event.target.value)}
                  type="url"
                  required={editorKind === "connection"}
                  placeholder={
                    editorKind === "connection" ? "https://..." : "Link opcional (https://...)"
                  }
                  className="border-border bg-background"
                />
              )}
              {editorKind === "widget" && (
                <Textarea
                  value={entryDescription}
                  onChange={(event) => setEntryDescription(event.target.value)}
                  maxLength={240}
                  rows={3}
                  required
                  placeholder="Descrição ou conteúdo do widget"
                  className="border-border bg-background"
                />
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditorKind(null)}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm">
                  Adicionar
                </Button>
              </div>
            </form>
          )}

          {profileTab === "wall" ? (
            extras.widgets.length ? (
              <div className="mt-4 space-y-3">
                {extras.widgets.map((widget) => {
                  const url = safeExternalUrl(widget.url);
                  return (
                    <article
                      key={widget.id}
                      className="overflow-hidden rounded-2xl border border-border bg-card"
                    >
                      <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-primary/10 via-card to-secondary/10 p-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white/90">{widget.title}</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-white/65">
                            {widget.description}
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            setExtras({
                              widgets: extras.widgets.filter((item) => item.id !== widget.id),
                            })
                          }
                          className="shrink-0 rounded p-1 text-white/45 hover:bg-white/[0.1] hover:text-white"
                          aria-label={`Remover widget ${widget.title}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {url && (
                        <div className="p-3">
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-md bg-white/[0.14] px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/[0.2]"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Abrir conexão
                          </a>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 text-center">
                <LayoutGrid className="mb-3 h-8 w-8 text-white/35" />
                <p className="text-sm font-semibold text-white/75">Seu mural está vazio</p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-white/45">
                  Crie widgets com texto, links e informações que queira compartilhar.
                </p>
              </div>
            )
          ) : profileTab === "activity" ? (
            <div className="mt-4 space-y-2">
              {activityLoading ? (
                <div className="flex min-h-56 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#171416] text-sm text-white/50">
                  Carregando atividade…
                </div>
              ) : recentActivity.length ? (
                recentActivity.map((item, index) => (
                  <article
                    key={`${item.created_at}-${index}`}
                    className="rounded-xl border border-white/[0.08] bg-[#171416] p-4"
                  >
                    <p className="whitespace-pre-wrap break-words text-sm text-white/80">
                      {item.content}
                    </p>
                    <time className="mt-2 block text-xs text-white/40">
                      {new Date(item.created_at).toLocaleString("pt-BR")}
                    </time>
                  </article>
                ))
              ) : (
                <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#171416] px-6 text-center">
                  <Activity className="mb-3 h-8 w-8 text-white/35" />
                  <p className="text-sm font-semibold text-white/75">Sem atividade recente</p>
                  <p className="mt-1 max-w-xs text-xs leading-relaxed text-white/45">
                    Suas mensagens recentes nos canais aparecerão aqui.
                  </p>
                </div>
              )}
            </div>
          ) : extras.wishlist.length ? (
            <ul className="mt-4 space-y-2">
              {extras.wishlist.map((item, index) => (
                <li
                  key={`${item}-${index}`}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#171416] p-3"
                >
                  <Heart className="h-4 w-4 shrink-0 text-pink-300" />
                  <span className="min-w-0 flex-1 break-words text-sm text-white/80">{item}</span>
                  <button
                    onClick={() =>
                      setExtras({
                        wishlist: extras.wishlist.filter((_, itemIndex) => itemIndex !== index),
                      })
                    }
                    className="rounded p-1 text-white/40 hover:bg-white/[0.08] hover:text-white"
                    aria-label={`Remover ${item} da lista de desejos`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.12] bg-[#171416] px-6 text-center">
              <Heart className="mb-3 h-8 w-8 text-white/35" />
              <p className="text-sm font-semibold text-white/75">Sua lista está vazia</p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-white/45">
                Adicione jogos, animes ou interesses para compartilhar no seu perfil.
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
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-[60] flex w-[min(700px,calc(100%-2rem))] -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-popover/95 px-4 py-3 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-4"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-idle" />
          <p className="flex-1 text-sm">Você tem alterações que ainda não foram salvas.</p>
          <Button variant="ghost" size="sm" onClick={() => setDraft(savedDraft)}>
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
      role="tab"
      aria-selected={active}
      className={`relative shrink-0 pb-3 text-sm font-semibold transition ${
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
      {active && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />}
    </button>
  );
}
