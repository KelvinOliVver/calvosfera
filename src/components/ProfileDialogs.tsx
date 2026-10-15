import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadMedia } from "@/lib/media";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
};

export function Avatar({ p, size = 40, online }: { p?: Profile | undefined; size?: number; online?: boolean }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {p?.avatar_url ? (
        <img src={p.avatar_url} alt={p.username} className="h-full w-full rounded-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-accent font-bold text-primary">
          {(p?.username ?? "?").slice(0, 1).toUpperCase()}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-panel ${online ? "bg-online" : "bg-muted-foreground"}`}
        />
      )}
    </div>
  );
}

function ProfileCard({ p }: { p: Profile }) {
  return (
    <div className="overflow-hidden rounded-xl bg-card">
      <div className="h-32 bg-accent">
        {p.banner_url && <img src={p.banner_url} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="px-4 pb-4">
        <div className="-mt-10 inline-block rounded-full border-4 border-card">
          <Avatar p={p} size={80} />
        </div>
        <h3 className="mt-2 text-xl">{p.username}</h3>
        {p.bio && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{p.bio}</p>}
      </div>
    </div>
  );
}

export function ViewProfile({ p, onClose, actions }: { p: Profile | null; onClose: () => void; actions?: React.ReactNode }) {
  return (
    <Dialog open={!!p} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="overflow-hidden border-0 p-0">
        <DialogTitle className="sr-only">Perfil</DialogTitle>
        {p && <ProfileCard p={p} />}
        {p && actions && <div className="flex justify-end gap-2 px-4 pb-4">{actions}</div>}
      </DialogContent>
    </Dialog>
  );
}

export function EditProfile({
  open,
  onOpenChange,
  me,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  me: Profile;
  onSaved: (p: Profile) => void;
}) {
  const [draft, setDraft] = useState<Profile>(me);
  const [busy, setBusy] = useState(false);

  async function pick(kind: "avatar" | "banner", file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadMedia(me.id, file, kind);
      setDraft((d) => ({ ...d, [kind === "avatar" ? "avatar_url" : "banner_url"]: url }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
                bio: draft.bio?.slice(0, 300) ?? null,
        avatar_url: draft.avatar_url,
        banner_url: draft.banner_url,
      })
      .eq("id", me.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onSaved(draft);
    onOpenChange(false);
    toast.success("Perfil salvo");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setDraft(me);
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar perfil</DialogTitle>
        </DialogHeader>
        <ProfileCard p={draft} />
        <div className="grid grid-cols-2 gap-2">
          <label className="cursor-pointer rounded-md border px-3 py-2 text-center text-sm transition hover:bg-accent focus-within:ring-2 focus-within:ring-ring">
            Foto / GIF
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick("avatar", e.target.files?.[0])} />
          </label>
          <label className="cursor-pointer rounded-md border px-3 py-2 text-center text-sm transition hover:bg-accent focus-within:ring-2 focus-within:ring-ring">
            Banner / GIF
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick("banner", e.target.files?.[0])} />
          </label>
        </div>
        <Textarea value={draft.bio ?? ""} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} placeholder="Sobre mim" maxLength={300} />
        <Button disabled={busy} onClick={save} className="font-bold">
          {busy ? "Enviando..." : "Salvar"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
