CREATE TABLE public.community_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 120),
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 1200),
  starts_at timestamptz NOT NULL,
  location text CHECK (location IS NULL OR char_length(location) <= 160),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.community_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_events TO authenticated;
CREATE POLICY "events readable by community members" ON public.community_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "members create events" ON public.community_events FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = author_id);
CREATE POLICY "organizers or admins update events" ON public.community_events FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = author_id OR public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK ((SELECT auth.uid()) = author_id OR public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY "organizers or admins delete events" ON public.community_events FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = author_id OR public.has_role((SELECT auth.uid()), 'admin'));
CREATE INDEX community_events_starts_at_idx ON public.community_events(starts_at);

CREATE TABLE public.community_event_rsvps (
  event_id uuid NOT NULL REFERENCES public.community_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
ALTER TABLE public.community_event_rsvps ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.community_event_rsvps TO authenticated;
CREATE POLICY "event attendance visible to members" ON public.community_event_rsvps FOR SELECT TO authenticated USING (true);
CREATE POLICY "members RSVP to active future events" ON public.community_event_rsvps FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (SELECT 1 FROM public.community_events e WHERE e.id = event_id AND e.status = 'scheduled' AND e.starts_at > now())
  );
CREATE POLICY "members cancel own RSVP" ON public.community_event_rsvps FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE INDEX community_event_rsvps_event_idx ON public.community_event_rsvps(event_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.community_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_event_rsvps;
