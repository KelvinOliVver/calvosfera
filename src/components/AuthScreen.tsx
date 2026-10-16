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
      <header className="relative flex items-center gap-3 px-6 py-6 sm:px-10">
        <span className="auth-brand-mark flex h-9 w-9 items-center justify-center rounded-lg text-lg font-bold text-primary-foreground">
          C
        </span>
        <span className="text-base font-semibold tracking-tight">Calvosfera</span>
      </header>
      <main className="mx-auto grid min-h-[calc(100dvh-84px)] max-w-6xl items-center gap-10 px-6 pb-10 md:grid-cols-[minmax(0,1fr)_400px] sm:px-10">
        <div className="hidden max-w-xl md:block">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Comunidade Calvosfera
          </p>
          <h1 className="max-w-lg text-4xl font-semibold leading-[1.12] tracking-tight lg:text-5xl">
            Converse, jogue e fique por dentro.
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-white/75">
            Entre nos canais, encontre sua comunidade e continue de onde a conversa parou.
          </p>
        </div>
        <div className="auth-card mx-auto w-full max-w-[400px] rounded-2xl border border-border bg-panel p-7 sm:p-8 md:ml-auto md:mr-0">
          <h2 className="text-2xl font-semibold tracking-tight">
            {mode === "in" ? "Entrar" : "Criar sua conta"}
          </h2>
          <p className="mb-7 mt-2 text-sm leading-relaxed text-muted-foreground">
            {mode === "in"
              ? "Acesse sua conta para voltar à comunidade."
              : "Escolha um nick e faça parte da comunidade."}
          </p>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Nick">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                maxLength={64}
                autoComplete="username"
                placeholder="Seu nick"
                className="h-11 border-input bg-background transition-colors focus-visible:border-primary/60"
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
                className="h-11 border-input bg-background transition-colors focus-visible:border-primary/60"
              />
            </Field>
            <Button
              type="submit"
              disabled={busy}
              className="mt-2 h-11 w-full rounded-lg font-semibold"
            >
              {busy ? "Aguarde…" : mode === "in" ? "Entrar na Calvosfera" : "Criar conta"}
            </Button>
          </form>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-1 text-sm text-muted-foreground">
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
