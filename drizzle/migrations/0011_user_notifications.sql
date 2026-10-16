-- Persist user-scoped activity notifications for mentions, replies, friend requests and DMs.
CREATE TABLE public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('mention', 'reply', 'friend_request', 'direct_message')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 240),
  channel_id uuid REFERENCES public.channels(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CONSTRAINT user_notifications_have_actor CHECK (user_id IS DISTINCT FROM actor_id)
);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, DELETE ON public.user_notifications TO authenticated;
GRANT UPDATE (read_at) ON public.user_notifications TO authenticated;
CREATE POLICY "members read their own notifications" ON public.user_notifications
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "members mark their own notifications read" ON public.user_notifications
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "members delete their own notifications" ON public.user_notifications
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE INDEX user_notifications_user_created_idx ON public.user_notifications(user_id, created_at DESC);
CREATE INDEX user_notifications_user_unread_idx ON public.user_notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE OR REPLACE FUNCTION public.notify_message_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  _reply_author uuid;
BEGIN
  IF NEW.reply_to IS NOT NULL THEN
    SELECT m.user_id INTO _reply_author
    FROM public.messages AS m
    WHERE m.id = NEW.reply_to AND m.channel_id = NEW.channel_id;

    IF _reply_author IS NOT NULL AND _reply_author IS DISTINCT FROM NEW.user_id THEN
      INSERT INTO public.user_notifications (user_id, actor_id, kind, title, body, channel_id, message_id)
      VALUES (_reply_author, NEW.user_id, 'reply', 'Alguém respondeu sua mensagem', left(coalesce(NEW.content, ''), 240), NEW.channel_id, NEW.id);
    END IF;
  END IF;

  INSERT INTO public.user_notifications (user_id, actor_id, kind, title, body, channel_id, message_id)
  SELECT p.id, NEW.user_id, 'mention', 'Você foi mencionado', left(coalesce(NEW.content, ''), 240), NEW.channel_id, NEW.id
  FROM public.profiles AS p
  WHERE p.id IS DISTINCT FROM NEW.user_id
    AND position('@' || lower(p.username) IN lower(coalesce(NEW.content, ''))) > 0;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_friend_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  _recipient uuid;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  _recipient := CASE WHEN NEW.requested_by = NEW.user_a THEN NEW.user_b ELSE NEW.user_a END;
  INSERT INTO public.user_notifications (user_id, actor_id, kind, title, body)
  VALUES (_recipient, NEW.requested_by, 'friend_request', 'Nova solicitação de amizade', 'Alguém quer adicionar você à lista de amigos.');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_direct_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  _recipient uuid;
BEGIN
  SELECT CASE WHEN c.user_a = NEW.sender_id THEN c.user_b ELSE c.user_a END
  INTO _recipient
  FROM public.dm_conversations AS c
  WHERE c.id = NEW.conversation_id;

  IF _recipient IS NOT NULL AND _recipient IS DISTINCT FROM NEW.sender_id THEN
    INSERT INTO public.user_notifications (user_id, actor_id, kind, title, body, conversation_id)
    VALUES (_recipient, NEW.sender_id, 'direct_message', 'Nova mensagem privada', left(coalesce(NEW.content, ''), 240), NEW.conversation_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_notify_activity
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_message_activity();
CREATE TRIGGER friendships_notify_request
  AFTER INSERT ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.notify_friend_request();
CREATE TRIGGER dm_messages_notify_recipient
  AFTER INSERT ON public.dm_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_direct_message();

REVOKE ALL ON FUNCTION public.notify_message_activity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_friend_request() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_direct_message() FROM PUBLIC, anon, authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
