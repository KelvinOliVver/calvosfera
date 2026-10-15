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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <img src={bg} alt="" width={1600} height={912} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-background/40" />
      <div className="relative w-full max-w-md rounded-2xl border bg-card/85 p-8 shadow-glow backdrop-blur-xl">
        <h1 className="text-center text-4xl text-sakura">Calvosfera</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {mode === "in" ? "Bem-vindo de volta, nakama ✦" : "Entre pro clã mais careca do anime"}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          {mode === "up" && (
            <Input placeholder="Nome de usuário" value={username} onChange={(e) => setUsername(e.target.value)} required maxLength={32} />
          )}
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          <Button type="submit" disabled={busy} className="w-full bg-sakura text-primary-foreground font-bold">
            {mode === "in" ? "Entrar" : "Criar conta"}
          </Button>
        </form>
        <Button variant="outline" onClick={google} className="mt-3 w-full">
          Continuar com Google
        </Button>
        <button
          onClick={() => setMode(mode === "in" ? "up" : "in")}
          className="mt-5 w-full text-center text-sm text-secondary hover:underline"
        >
          {mode === "in" ? "Não tem conta? Criar uma" : "Já tem conta? Entrar"}
        </button>
      </div>
    </div>
  );
}
