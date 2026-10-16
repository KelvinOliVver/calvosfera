CREATE TABLE public.message_reactions (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('👍', '❤️', '😂', '😮', '🎉')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, reaction)
);
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
CREATE POLICY "message reactions visible to signed in members" ON public.message_reactions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "members add their own reactions" ON public.message_reactions
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND NOT public.is_banned((SELECT auth.uid()))
    AND NOT public.is_timed_out((SELECT auth.uid()))
  );
CREATE POLICY "members remove their own reactions" ON public.message_reactions
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE INDEX message_reactions_message_idx ON public.message_reactions(message_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
