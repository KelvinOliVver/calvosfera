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
    <div className="grid min-h-screen bg-background/40 lg:grid-cols-[1.2fr_1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <img
          src={bg}
          alt="Cidade à noite com lua e cerejeiras"
          width={1600}
          height={912}
          className="absolute inset-0 h-full w-full object-cover brightness-[0.72]"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#170d2d]/35 via-transparent to-[#120c24]/70" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/45 to-transparent p-10 pt-40">
          <p className="font-display text-sm tracking-widest text-primary">カルボスフェラ</p>
          <p className="mt-2 max-w-sm text-lg text-foreground/90">
            Canais de texto, calls de voz e perfis com GIF. O ponto de encontro da Calvosfera.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-panel/75 p-7 shadow-glow backdrop-blur-2xl sm:p-9">
          <div className="mb-7 inline-flex rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 font-display text-xs tracking-wide text-primary">
            カルボスフェラ
          </div>
          <h1 className="font-sans text-3xl font-bold tracking-tight">Bem-vindo à Calvosfera</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "in"
              ? "Entre com sua conta para continuar."
              : "Crie sua conta. Leva menos de um minuto."}
          </p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            <Field label="Nick">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                maxLength={64}
                autoComplete="username"
                placeholder="ex: careca_supremo"
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
              />
            </Field>
            <Button
              type="submit"
              disabled={busy}
              className="mt-2 h-11 w-full font-bold shadow-lg shadow-primary/20"
            >
              {busy ? "Aguarde…" : mode === "in" ? "Entrar" : "Criar conta"}
            </Button>
          </form>
          <p className="mt-7 text-center text-sm text-muted-foreground">
            {mode === "in" ? "Ainda não tem conta? " : "Já tem conta? "}
            <button
              onClick={() => setMode(mode === "in" ? "up" : "in")}
              className="font-semibold text-primary transition-colors hover:text-primary/80 hover:underline"
            >
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
