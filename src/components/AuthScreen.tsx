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
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.2fr_1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <img src={bg} alt="Cidade à noite com lua e cerejeiras" width={1600} height={912} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#120d1b]/65 via-[#120d1b]/25 to-[#120d1b]/80" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#120d1b]/95 to-transparent p-10 pt-32">
          <div className="mb-5 inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-primary backdrop-blur-sm">
            カルボスフェラ
          </div>
          <h2 className="max-w-md font-display text-4xl leading-none tracking-tight text-white">A sua casa no universo da Calvosfera.</h2>
          <p className="mt-4 max-w-md text-lg text-white/75">
            Canais de texto, calls de voz e perfis com GIF. O ponto de encontro da comunidade mais anime do momento.
          </p>
          <div className="mt-8 grid max-w-md gap-3 sm:grid-cols-3">
            {[
              ["Texto", "chat ao vivo"],
              ["Voz", "salas de call"],
              ["Perfis", "estilo & vibe"],
            ].map(([label, value]) => (
              <div key={label} className="soft-card rounded-2xl px-3 py-2 text-left">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">{label}</p>
                <p className="mt-2 text-sm font-medium text-white/90">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="glass-panel w-full max-w-md rounded-[30px] border border-white/10 p-6 shadow-glow sm:p-8">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary/90">Calvosfera</p>
            <h1 className="mt-3 text-3xl tracking-tight">{mode === "in" ? "Entrar" : "Criar conta"}</h1>
          </div>

          <p className="text-sm text-muted-foreground">
            {mode === "in" ? "Entre com sua conta para continuar." : "Crie sua conta. Leva menos de um minuto."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="Nick">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                maxLength={64}
                autoComplete="username"
                placeholder="ex: careca_supremo"
                className="h-11 rounded-xl border-white/10 bg-white/3 px-3 text-base text-foreground shadow-none placeholder:text-muted-foreground/80 focus-visible:ring-primary/60"
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
                className="h-11 rounded-xl border-white/10 bg-white/3 px-3 text-base text-foreground shadow-none placeholder:text-muted-foreground/80 focus-visible:ring-primary/60"
              />
            </Field>
            <Button type="submit" disabled={busy} className="mt-2 h-11 w-full rounded-xl bg-gradient-to-r from-primary to-secondary font-bold text-primary-foreground shadow-glow transition hover:brightness-110">
              {busy ? "Aguarde…" : mode === "in" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <p className="mt-8 text-sm text-muted-foreground">
            {mode === "in" ? "Ainda não tem conta? " : "Já tem conta? "}
            <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="font-semibold text-primary transition hover:underline">
              {mode === "in" ? "Criar conta" : "Entrar"}
            </button>
          </p>
        </div>
      </div>
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
