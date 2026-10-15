ALTER TABLE public.profiles
  ADD COLUMN display_name text,
  ADD COLUMN pronouns text,
  ADD COLUMN banner_color text,
  ADD COLUMN theme_primary text,
  ADD COLUMN theme_accent text,
  ADD COLUMN status text NOT NULL DEFAULT 'online',
  ADD COLUMN custom_status text;

ALTER TABLE public.messages
  ADD COLUMN reply_to uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN edited_at timestamptz;

GRANT UPDATE ON public.messages TO authenticated;
CREATE POLICY "own messages update" ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND NOT public.is_banned(auth.uid()) AND NOT public.is_timed_out(auth.uid()))
  WITH CHECK (auth.uid() = user_id);