import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import bg from "@/assets/bg.jpg";

export function AuthScreen() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { username } },
        });
        if (error) throw error;
        toast.success("Conta criada! Confirme no seu email para entrar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error(String(r.error.message ?? r.error));
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.2fr_1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <img src={bg} alt="Cidade à noite com lua e cerejeiras" width={1600} height={912} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-10 pt-32">
          <p className="font-display text-sm tracking-widest text-primary">カルボスフェラ</p>
          <p className="mt-2 max-w-sm text-lg">Canais de texto, calls de voz e perfis com GIF. O ponto de encontro da Calvosfera.</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl tracking-tight">Calvosfera</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "in" ? "Entre com sua conta para continuar." : "Crie sua conta. Leva menos de um minuto."}
          </p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "up" && (
              <Field label="Nome de usuário">
                <Input value={username} onChange={(e) => setUsername(e.target.value)} required maxLength={32} autoComplete="username" />
              </Field>
            )}
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </Field>
            <Field label="Senha">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "in" ? "current-password" : "new-password"} />
            </Field>
            <Button type="submit" disabled={busy} className="w-full font-bold">
              {busy ? "Aguarde…" : mode === "in" ? "Entrar" : "Criar conta"}
            </Button>
          </form>
          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" onClick={google} className="w-full">
            Continuar com Google
          </Button>
          <p className="mt-8 text-sm text-muted-foreground">
            {mode === "in" ? "Ainda não tem conta? " : "Já tem conta? "}
            <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="font-medium text-primary hover:underline">
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
