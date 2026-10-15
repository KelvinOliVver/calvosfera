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
    <div className="grid min-h-screen bg-[#171020] lg:grid-cols-[1.15fr_1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <img
          src={bg}
          alt="Cidade à noite com lua e cerejeiras"
          width={1600}
          height={912}
          className="absolute inset-0 h-full w-full object-cover brightness-[0.62]"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#211332]/45 via-transparent to-[#100b1b]/85" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#171020] via-[#171020]/55 to-transparent p-12 pt-40">
          <p className="font-display text-sm tracking-widest text-primary">カルボスフェラ</p>
          <p className="mt-3 max-w-md font-sans text-3xl font-bold leading-tight text-white">
            Seu lugar para conversar, jogar e estar junto.
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70">
            Canais de texto, chamadas de voz e perfis personalizados para sua comunidade.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center bg-gradient-to-br from-[#21172f] via-[#171020] to-[#1d1428] px-6 py-12">
        <div className="w-full max-w-[440px] rounded-2xl border border-white/[0.08] bg-[#241a33]/85 p-7 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-10">
          <div className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sakura font-display text-sm text-white shadow-lg shadow-primary/20">
            C
          </div>
          <div className="mb-7">
            <h1 className="font-sans text-2xl font-bold tracking-tight">Boas-vindas de volta!</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "in"
                ? "Estamos muito felizes em ver você novamente!"
                : "Crie sua conta para entrar na comunidade."}
            </p>
          </div>
          <form onSubmit={submit} className="space-y-5">
            <Field label="Nick">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                maxLength={64}
                autoComplete="username"
                placeholder="ex: careca_supremo"
                className="border-white/[0.07] bg-[#160f21] focus-visible:ring-primary/60"
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
                className="border-white/[0.07] bg-[#160f21] focus-visible:ring-primary/60"
              />
            </Field>
            <Button
              type="submit"
              disabled={busy}
              className="mt-1 h-11 w-full font-bold shadow-md shadow-black/10"
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
