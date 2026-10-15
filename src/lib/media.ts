import { supabase } from "@/integrations/supabase/client";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export async function uploadMedia(userId: string, file: File, kind: "avatar" | "banner") {
  if (!file.type.startsWith("image/")) throw new Error("Envie uma imagem ou GIF");
  if (file.size > 10 * 1024 * 1024) throw new Error("Máximo 10MB");
  const ext = file.name.split(".").pop() || "png";
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (error) throw error;
  const { data, error: e2 } = await supabase.storage.from("media").createSignedUrl(path, TEN_YEARS);
  if (e2 || !data) throw e2 ?? new Error("Falha ao gerar link");
  return data.signedUrl;
}

export async function uploadAttachment(userId: string, file: File) {
  if (file.size > 50 * 1024 * 1024) throw new Error("Arquivo muito grande (máximo 50MB)");
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const path = `${userId}/files/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from("media").upload(path, file, {
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw error;
  const { data, error: e2 } = await supabase.storage.from("media").createSignedUrl(path, TEN_YEARS);
  if (e2 || !data) throw e2 ?? new Error("Falha ao gerar link");
  return { url: data.signedUrl, type: file.type || "application/octet-stream", name: file.name.slice(0, 200) };
}
