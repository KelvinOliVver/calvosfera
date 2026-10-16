import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { AuthScreen } from "@/components/AuthScreen";
import { ChatApp } from "@/components/ChatApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Calvosfera — servidor anime" },
      { name: "description", content: "Chat e calls da Calvosfera com tema anime: perfis, banners e GIFs." },
      { property: "og:title", content: "Calvosfera — servidor anime" },
      { property: "og:description", content: "Chat e calls da Calvosfera com tema anime." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="app-loading flex min-h-dvh items-center justify-center px-6 text-center">
        <div className="flex flex-col items-center">
          <span className="auth-brand-mark flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-extrabold text-white">
            C
          </span>
          <p className="mt-5 font-display text-xl font-bold tracking-tight">Calvosfera</p>
          <p className="mt-1 text-sm text-muted-foreground">Preparando seu espaço...</p>
          <span className="loading-track mt-6 h-1 w-28 overflow-hidden rounded-full" aria-hidden="true">
            <span className="loading-progress block h-full w-1/2 rounded-full bg-primary" />
          </span>
        </div>
      </div>
    );
  }
  return user ? <ChatApp userId={user.id} /> : <AuthScreen />;
}
