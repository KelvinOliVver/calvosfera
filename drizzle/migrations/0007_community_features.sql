-- Community participation: polls, suggestions and moderation reports.
CREATE TABLE public.community_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question text NOT NULL CHECK (char_length(question) BETWEEN 5 AND 240),
  options text[] NOT NULL CHECK (cardinality(options) BETWEEN 2 AND 8),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.community_polls ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.community_polls TO authenticated;
CREATE POLICY "polls are readable by community members" ON public.community_polls
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "members create polls" ON public.community_polls
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = author_id);
CREATE POLICY "authors or admins delete polls" ON public.community_polls
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = author_id OR public.has_role((SELECT auth.uid()), 'admin'));

CREATE TABLE public.community_poll_votes (
  poll_id uuid NOT NULL REFERENCES public.community_polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  option_index smallint NOT NULL CHECK (option_index BETWEEN 0 AND 7),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);
ALTER TABLE public.community_poll_votes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_poll_votes TO authenticated;
CREATE POLICY "poll votes visible to signed in members" ON public.community_poll_votes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "members vote once per poll" ON public.community_poll_votes
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (SELECT 1 FROM public.community_polls p WHERE p.id = poll_id AND (p.ends_at IS NULL OR p.ends_at > now()))
    AND option_index < (SELECT cardinality(p.options) FROM public.community_polls p WHERE p.id = poll_id)
  );
CREATE POLICY "members change their vote while poll is open" ON public.community_poll_votes
  FOR UPDATE TO authenticated USING (
    (SELECT auth.uid()) = user_id
    AND EXISTS (SELECT 1 FROM public.community_polls p WHERE p.id = poll_id AND (p.ends_at IS NULL OR p.ends_at > now()))
  ) WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND option_index < (SELECT cardinality(p.options) FROM public.community_polls p WHERE p.id = poll_id)
  );
CREATE POLICY "members remove their vote" ON public.community_poll_votes
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE INDEX community_poll_votes_poll_idx ON public.community_poll_votes(poll_id);

CREATE TABLE public.community_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 120),
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 1200),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'accepted', 'declined', 'implemented')),
  response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.community_suggestions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_suggestions TO authenticated;
CREATE POLICY "suggestions readable by members" ON public.community_suggestions FOR SELECT TO authenticated USING (true);
CREATE POLICY "members submit suggestions" ON public.community_suggestions FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = author_id);
CREATE POLICY "authors edit own open suggestions" ON public.community_suggestions FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = author_id AND status = 'open')
  WITH CHECK ((SELECT auth.uid()) = author_id AND status = 'open');
CREATE POLICY "admins moderate suggestions" ON public.community_suggestions FOR UPDATE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY "authors or admins delete suggestions" ON public.community_suggestions FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = author_id OR public.has_role((SELECT auth.uid()), 'admin'));

CREATE TABLE public.community_suggestion_votes (
  suggestion_id uuid NOT NULL REFERENCES public.community_suggestions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (suggestion_id, user_id)
);
ALTER TABLE public.community_suggestion_votes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.community_suggestion_votes TO authenticated;
CREATE POLICY "suggestion votes visible to members" ON public.community_suggestion_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "members vote on suggestions" ON public.community_suggestion_votes FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "members remove own suggestion vote" ON public.community_suggestion_votes FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE TABLE public.community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  moderator_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT community_report_one_target CHECK ((target_user_id IS NULL) <> (target_message_id IS NULL))
);
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.community_reports TO authenticated;
CREATE POLICY "reporters see own and admins see all reports" ON public.community_reports FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = reporter_id OR public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY "members submit reports for someone else" ON public.community_reports FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = reporter_id AND target_user_id IS DISTINCT FROM (SELECT auth.uid()));
CREATE POLICY "admins resolve reports" ON public.community_reports FOR UPDATE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));
CREATE INDEX community_reports_status_created_idx ON public.community_reports(status, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.community_polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_poll_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_suggestions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_suggestion_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_reports;
