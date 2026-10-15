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
    return <div className="flex h-screen items-center justify-center text-sakura font-display text-2xl">Carregando...</div>;
  }
  return user ? <ChatApp userId={user.id} /> : <AuthScreen />;
}
