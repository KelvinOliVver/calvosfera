import { useCallback, useEffect, useState } from "react";
import { Bookmark, Hash, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type SavedCommunityMessage = {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  attachment_name?: string | null;
};

const keyFor = (userId: string, kind: string) => `calvosfera:${kind}:v1:${userId}`;

function readArray<T>(key: string): T[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

export function useCommunityTools(userId: string) {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [savedMessages, setSavedMessages] = useState<SavedCommunityMessage[]>([]);

  useEffect(() => {
    setFavoriteIds(readArray<string>(keyFor(userId, "favorites")));
    setSavedMessages(readArray<SavedCommunityMessage>(keyFor(userId, "saved-messages")));
  }, [userId]);

  const toggleFavorite = useCallback(
    (channelId: string) => {
      setFavoriteIds((current) => {
        const next = current.includes(channelId)
          ? current.filter((id) => id !== channelId)
          : [...current, channelId];
        try {
          window.localStorage.setItem(keyFor(userId, "favorites"), JSON.stringify(next));
        } catch {
          // Favorites still work for this session if storage is unavailable.
        }
        return next;
      });
    },
    [userId],
  );

  const toggleSavedMessage = useCallback(
    (message: SavedCommunityMessage) => {
      setSavedMessages((current) => {
        const next = current.some((item) => item.id === message.id)
          ? current.filter((item) => item.id !== message.id)
          : [{ ...message }, ...current].slice(0, 200);
        try {
          window.localStorage.setItem(keyFor(userId, "saved-messages"), JSON.stringify(next));
        } catch {
          // Saved messages still work for this session if storage is unavailable.
        }
        return next;
      });
    },
    [userId],
  );

  const saveDraft = useCallback(
    (channelId: string, value: string) => {
      try {
        const key = keyFor(userId, "drafts");
        const drafts = JSON.parse(window.localStorage.getItem(key) ?? "{}") as Record<
          string,
          string
        >;
        if (value.trim()) drafts[channelId] = value.slice(0, 2000);
        else delete drafts[channelId];
        window.localStorage.setItem(key, JSON.stringify(drafts));
      } catch {
        // Drafts remain in memory if storage is unavailable.
      }
    },
    [userId],
  );

  const readDraft = useCallback(
    (channelId: string) => {
      try {
        const drafts = JSON.parse(
          window.localStorage.getItem(keyFor(userId, "drafts")) ?? "{}",
        ) as Record<string, unknown>;
        return typeof drafts[channelId] === "string" ? (drafts[channelId] as string) : "";
      } catch {
        return "";
      }
    },
    [userId],
  );

  return { favoriteIds, savedMessages, toggleFavorite, toggleSavedMessage, saveDraft, readDraft };
}

export function SavedMessagesDialog({
  open,
  onOpenChange,
  messages,
  channelNames,
  onOpenChannel,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: SavedCommunityMessage[];
  channelNames: Record<string, string>;
  onOpenChannel: (channelId: string) => void;
  onRemove: (message: SavedCommunityMessage) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] max-w-xl overflow-y-auto border-border bg-panel text-foreground">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-primary" /> Mensagens salvas
          </DialogTitle>
          <DialogDescription>
            Guardadas apenas neste navegador. Até 200 mensagens.
          </DialogDescription>
        </DialogHeader>
        <div className="divide-y divide-border">
          {messages.map((message) => (
            <div key={message.id} className="flex items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm">
                  {message.content || message.attachment_name || "Anexo"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <Hash className="mr-1 inline h-3 w-3" />
                  {channelNames[message.channel_id] ?? "Canal indisponível"} ·{" "}
                  {new Date(message.created_at).toLocaleDateString("pt-BR")}
                </p>
                <Button
                  variant="link"
                  className="h-auto px-0 py-1 text-xs"
                  disabled={!channelNames[message.channel_id]}
                  onClick={() => {
                    onOpenChannel(message.channel_id);
                    onOpenChange(false);
                  }}
                >
                  Abrir canal
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remover mensagem salva"
                onClick={() => onRemove(message)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="py-12 text-center">
              <Bookmark className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium">Nenhuma mensagem salva</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Use o marcador ao lado de uma mensagem para guardá-la.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
