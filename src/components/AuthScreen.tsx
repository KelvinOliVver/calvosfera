import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { registerAccount } from "@/lib/accounts.functions";
import { getIdentity, usernameToEmail } from "@/lib/device";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import bg from "@/assets/bg.jpg";

export function AuthScreen() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const r = await registerAccount({ data: { username, password, ...(await getIdentity()) } });
        if ("error" in r && r.error) throw new Error(r.error);
      }
      const login = username.includes("@") ? username.trim() : usernameToEmail(username);
      const { error } = await supabase.auth.signInWithPassword({ email: login, password });
      if (error) throw new Error(mode === "in" ? "Nick ou senha incorretos" : error.message);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative isolate min-h-dvh overflow-hidden bg-rail">
      <img
        src={bg}
        alt="Cidade anime sob a lua e cerejeiras"
        className="absolute inset-0 -z-20 h-full w-full object-cover"
      />
      <div className="auth-overlay absolute inset-0 -z-10" />
      <div className="pointer-events-none absolute -left-28 top-1/3 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-secondary/15 blur-3xl" />
      <header className="relative flex items-center gap-3 px-6 py-7 sm:px-12">
        <span className="auth-brand-mark flex h-10 w-10 items-center justify-center rounded-xl text-xl font-extrabold text-primary-foreground">
          C
        </span>
        <span className="text-lg font-extrabold tracking-tight">
          Calvosfera<span className="text-secondary">.</span>
        </span>
      </header>
      <main className="mx-auto grid min-h-[calc(100dvh-100px)] max-w-7xl items-center gap-16 px-6 pb-14 md:grid-cols-2 sm:px-12">
        <div className="hidden self-end pb-20 md:block">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-primary">
            カルボスフェラ
          </p>
          <h1 className="font-sans text-5xl font-extrabold leading-tight">
            Calvosfera<span className="text-secondary">.</span>
          </h1>
          <p className="mt-5 max-w-sm text-lg leading-relaxed text-foreground/85">
            A sua casa no universo da Calvosfera. Canais de texto, calls de voz e perfis com GIF.
          </p>
          <div className="mt-8 grid max-w-md grid-cols-3 gap-3">
            {[
              ["Texto", "chat ao vivo"],
              ["Voz", "salas de call"],
              ["Perfis", "estilo & vibe"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 backdrop-blur-sm"
              >
                <p className="text-[10px] uppercase tracking-wider text-white/50">{label}</p>
                <p className="mt-1 text-xs font-medium text-white/90">{value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="auth-card mx-auto w-full max-w-[420px] rounded-3xl border border-white/10 bg-rail/85 p-7 backdrop-blur-2xl sm:p-9 md:ml-auto md:mr-0">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Sua comunidade anime
          </span>
          <h2 className="font-sans text-3xl font-extrabold tracking-tight">
            {mode === "in" ? "Bom te ver de novo." : "Seu lugar é aqui."}
          </h2>
          <p className="mb-8 mt-3 text-sm leading-relaxed text-muted-foreground">
            {mode === "in"
              ? "Entre para continuar de onde a conversa parou."
              : "Escolha seu nick e venha fazer parte."}
          </p>
          <form onSubmit={submit} className="space-y-5">
            <Field label="Nick">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                maxLength={64}
                autoComplete="username"
                placeholder="Seu nick"
                className="h-12 border-white/10 bg-background/70 transition-colors focus-visible:border-primary/60"
              />
            </Field>
            <Field label="Senha">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                placeholder="Sua senha"
                className="h-12 border-white/10 bg-background/70 transition-colors focus-visible:border-primary/60"
              />
            </Field>
            <Button
              type="submit"
              disabled={busy}
              className="mt-2 h-12 w-full rounded-xl font-bold shadow-lg shadow-primary/10 transition-transform hover:-translate-y-0.5"
            >
              {busy ? "Aguarde…" : mode === "in" ? "Entrar na Calvosfera" : "Criar conta"}
            </Button>
          </form>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-1 text-sm text-muted-foreground">
            <span>{mode === "in" ? "Ainda não tem conta?" : "Já faz parte?"}</span>
            <Button
              variant="link"
              className="h-auto px-1 py-1 font-semibold"
              onClick={() => setMode(mode === "in" ? "up" : "in")}
            >
              {mode === "in" ? "Criar conta" : "Entrar"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
