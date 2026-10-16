import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, MonitorCog, Moon, Palette, RotateCcw, Sun, TextCursorInput } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export type AppTheme = "dark" | "deep" | "graphite" | "light" | "amoled";
export type AppDensity = "compact" | "standard" | "comfortable";
export type ChatTextSize = "small" | "standard" | "large";

export type AppPreferences = {
  theme: AppTheme;
  accent: string;
  density: AppDensity;
  textSize: ChatTextSize;
  showAvatars: boolean;
  showTimestamps: boolean;
  reduceMotion: boolean;
};

const DEFAULT_PREFERENCES: AppPreferences = {
  theme: "dark",
  accent: "#a78bfa",
  density: "standard",
  textSize: "standard",
  showAvatars: true,
  showTimestamps: true,
  reduceMotion: false,
};
const STORAGE_KEY = "calvosfera:app-preferences:v1";

type PreferencesContextValue = {
  preferences: AppPreferences;
  updatePreferences: (patch: Partial<AppPreferences>) => void;
  resetPreferences: () => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function isChoice<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return typeof value === "string" && choices.includes(value as T);
}

function readPreferences(): AppPreferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const value = JSON.parse(raw) as Partial<AppPreferences>;
    return {
      theme: isChoice(value.theme, ["dark", "deep", "graphite", "light", "amoled"])
        ? value.theme
        : DEFAULT_PREFERENCES.theme,
      accent:
        typeof value.accent === "string" && /^#[0-9a-f]{6}$/i.test(value.accent)
          ? value.accent
          : DEFAULT_PREFERENCES.accent,
      density: isChoice(value.density, ["compact", "standard", "comfortable"])
        ? value.density
        : DEFAULT_PREFERENCES.density,
      textSize: isChoice(value.textSize, ["small", "standard", "large"])
        ? value.textSize
        : DEFAULT_PREFERENCES.textSize,
      showAvatars: typeof value.showAvatars === "boolean" ? value.showAvatars : true,
      showTimestamps: typeof value.showTimestamps === "boolean" ? value.showTimestamps : true,
      reduceMotion: typeof value.reduceMotion === "boolean" ? value.reduceMotion : false,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function contrastingText(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((part) => parseInt(part, 16) / 255) ?? [0, 0, 0];
  const [r = 0, g = 0, b = 0] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42 ? "#17151d" : "#ffffff";
}

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPreferences(readPreferences());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    root.dataset.theme = preferences.theme;
    root.dataset.density = preferences.density;
    root.dataset.chatSize = preferences.textSize;
    root.dataset.showAvatars = String(preferences.showAvatars);
    root.dataset.showTimestamps = String(preferences.showTimestamps);
    root.dataset.reduceMotion = String(preferences.reduceMotion);
    root.style.setProperty("--primary", preferences.accent);
    root.style.setProperty("--ring", preferences.accent);
    root.style.setProperty("--primary-foreground", contrastingText(preferences.accent));
    root.style.colorScheme = preferences.theme === "light" ? "light" : "dark";
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Preferences still apply for this tab when browser storage is unavailable.
    }
  }, [preferences, ready]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      updatePreferences: (patch) => setPreferences((current) => ({ ...current, ...patch })),
      resetPreferences: () => setPreferences(DEFAULT_PREFERENCES),
    }),
    [preferences],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function useAppPreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("useAppPreferences precisa estar dentro de AppPreferencesProvider");
  return value;
}

const THEMES: { id: AppTheme; label: string; description: string; icon: typeof Moon }[] = [
  { id: "dark", label: "Escuro", description: "Equilibrado", icon: Moon },
  { id: "deep", label: "Noturno", description: "Superfícies mais profundas", icon: Moon },
  { id: "graphite", label: "Grafite", description: "Neutro e discreto", icon: MonitorCog },
  { id: "light", label: "Claro", description: "Interface luminosa", icon: Sun },
  { id: "amoled", label: "AMOLED", description: "Preto verdadeiro", icon: Moon },
];
const ACCENTS = ["#a78bfa", "#60a5fa", "#34d399", "#f472b6", "#fb923c", "#facc15"];

export function AppPreferencesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { preferences, updatePreferences, resetPreferences } = useAppPreferences();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] max-w-2xl overflow-y-auto border-border bg-panel p-0 text-foreground sm:rounded-2xl">
        <DialogHeader className="border-b border-border px-6 py-5 pr-14 text-left">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Palette className="h-5 w-5 text-primary" /> Aparência e preferências
          </DialogTitle>
          <DialogDescription>
            Ajustes aplicados imediatamente e salvos neste dispositivo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8 p-6">
          <section aria-labelledby="theme-title">
            <div className="mb-3">
              <h3 id="theme-title" className="text-sm font-semibold">
                Tema
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Escolha a superfície de toda a interface.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {THEMES.map(({ id, label, description, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={preferences.theme === id}
                  onClick={() => updatePreferences({ theme: id })}
                  className={`theme-choice relative flex min-h-24 flex-col items-start justify-between rounded-xl border p-3 text-left transition ${preferences.theme === id ? "border-primary ring-1 ring-primary/40" : "border-border hover:border-foreground/20"}`}
                  data-theme-preview={id}
                >
                  <Icon className="h-4 w-4 text-primary" />
                  <span>
                    <span className="block text-xs font-semibold">{label}</span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {description}
                    </span>
                  </span>
                  {preferences.theme === id && (
                    <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </section>

          <section aria-labelledby="accent-title">
            <div className="mb-3">
              <h3 id="accent-title" className="text-sm font-semibold">
                Cor de destaque
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Usada em ações, seleção e foco. O contraste do texto se ajusta automaticamente.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENTS.map((accent) => (
                <button
                  key={accent}
                  type="button"
                  aria-label={`Usar cor ${accent}`}
                  aria-pressed={preferences.accent.toLowerCase() === accent}
                  onClick={() => updatePreferences({ accent })}
                  className={`h-9 w-9 rounded-full border-2 transition hover:scale-105 ${preferences.accent.toLowerCase() === accent ? "border-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-panel" : "border-transparent"}`}
                  style={{ backgroundColor: accent }}
                />
              ))}
              <label className="flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium hover:bg-accent">
                <input
                  aria-label="Escolher cor personalizada"
                  type="color"
                  value={preferences.accent}
                  onChange={(event) => updatePreferences({ accent: event.target.value })}
                  className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                Personalizada
              </label>
            </div>
          </section>

          <section aria-labelledby="chat-title">
            <div className="mb-3 flex items-center gap-2">
              <TextCursorInput className="h-4 w-4 text-muted-foreground" />
              <div>
                <h3 id="chat-title" className="text-sm font-semibold">
                  Leitura do chat
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ajuste a densidade e as informações visíveis.
                </p>
              </div>
            </div>
            <PreferenceSelect
              label="Densidade"
              value={preferences.density}
              options={[
                ["compact", "Compacta"],
                ["standard", "Padrão"],
                ["comfortable", "Confortável"],
              ]}
              onChange={(density) => updatePreferences({ density: density as AppDensity })}
            />
            <PreferenceSelect
              label="Tamanho do texto"
              value={preferences.textSize}
              options={[
                ["small", "Pequeno"],
                ["standard", "Padrão"],
                ["large", "Grande"],
              ]}
              onChange={(textSize) => updatePreferences({ textSize: textSize as ChatTextSize })}
            />
            <PreferenceSwitch
              label="Avatares nas mensagens"
              checked={preferences.showAvatars}
              onCheckedChange={(showAvatars) => updatePreferences({ showAvatars })}
            />
            <PreferenceSwitch
              label="Horário das mensagens"
              checked={preferences.showTimestamps}
              onCheckedChange={(showTimestamps) => updatePreferences({ showTimestamps })}
            />
            <PreferenceSwitch
              label="Reduzir animações"
              checked={preferences.reduceMotion}
              onCheckedChange={(reduceMotion) => updatePreferences({ reduceMotion })}
            />
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              Estas preferências ficam salvas no navegador. Elas não são sincronizadas entre
              dispositivos.
            </p>
            <Button variant="outline" onClick={resetPreferences} className="gap-2">
              <RotateCcw className="h-4 w-4" /> Restaurar padrão
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreferenceSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-4 border-t border-border py-2.5">
      <span className="text-sm text-foreground/90">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 min-w-36 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map(([option, title]) => (
          <option key={option} value={option}>
            {title}
          </option>
        ))}
      </select>
    </label>
  );
}

function PreferenceSwitch({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = `pref-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 border-t border-border py-2.5">
      <Label htmlFor={id} className="cursor-pointer text-sm font-normal text-foreground/90">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
