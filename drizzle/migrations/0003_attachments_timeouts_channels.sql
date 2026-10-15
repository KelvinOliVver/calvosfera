ALTER TABLE public.messages ADD COLUMN attachment_url text, ADD COLUMN attachment_type text, ADD COLUMN attachment_name text;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_content_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_content_len CHECK (char_length(content) <= 2000);

CREATE TABLE public.timeouts (
  user_id uuid PRIMARY KEY,
  until timestamptz NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timeouts TO authenticated;
GRANT ALL ON public.timeouts TO service_role;
ALTER TABLE public.timeouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "timeouts read" ON public.timeouts FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin timeouts insert" ON public.timeouts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin timeouts update" ON public.timeouts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin timeouts delete" ON public.timeouts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.is_timed_out(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.timeouts WHERE user_id = _user_id AND until > now())
$$;

DROP POLICY "own messages insert" ON public.messages;
CREATE POLICY "own messages insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_banned(auth.uid()) AND NOT public.is_timed_out(auth.uid())
    AND (char_length(content) > 0 OR attachment_url IS NOT NULL));

GRANT INSERT, UPDATE, DELETE ON public.channels TO authenticated;
CREATE POLICY "admin channels insert" ON public.channels FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin channels update" ON public.channels FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin channels delete" ON public.channels FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.timeouts;