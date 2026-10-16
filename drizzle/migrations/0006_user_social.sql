-- Social graph and direct messages. All public-schema tables use RLS.

-- Keep a non-editable per-user history so deleting/recreating requests cannot
-- bypass the hourly social anti-spam limit. This schema is not exposed by the Data API.
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE private.friend_request_rate_log (
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.friend_request_rate_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.friend_request_rate_log FROM PUBLIC, anon, authenticated;
CREATE INDEX friend_request_rate_log_recent_idx ON private.friend_request_rate_log(requester_id, created_at DESC);

CREATE FUNCTION private.enforce_friend_request_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  recent_requests integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> NEW.requested_by THEN
    RAISE EXCEPTION 'Friendship requests must be sent by the authenticated user';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.requested_by::text, 0));
  DELETE FROM private.friend_request_rate_log
  WHERE requester_id = NEW.requested_by AND created_at <= now() - interval '2 days';
  SELECT count(*) INTO recent_requests
  FROM private.friend_request_rate_log
  WHERE requester_id = NEW.requested_by
    AND created_at > now() - interval '1 hour';

  IF recent_requests >= 10 THEN
    RAISE EXCEPTION 'Friendship request limit reached; try again later'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO private.friend_request_rate_log (requester_id, target_id)
  VALUES (NEW.requested_by, CASE WHEN NEW.user_a = NEW.requested_by THEN NEW.user_b ELSE NEW.user_a END);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enforce_friend_request_rate() FROM PUBLIC, anon, authenticated;

CREATE TABLE public.blocked_users (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT blocked_users_no_self CHECK (blocker_id <> blocked_id)
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.blocked_users TO authenticated;
CREATE POLICY "participants can see block relationship" ON public.blocked_users
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IN (blocker_id, blocked_id));
CREATE POLICY "users create their own blocks" ON public.blocked_users
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = blocker_id);
CREATE POLICY "users remove their own blocks" ON public.blocked_users
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = blocker_id);

CREATE TABLE public.friendships (
  user_a uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_a, user_b),
  CONSTRAINT friendships_sorted_pair CHECK (user_a < user_b),
  CONSTRAINT friendships_requester_in_pair CHECK (requested_by IN (user_a, user_b))
);

CREATE TRIGGER enforce_friend_request_rate
  BEFORE INSERT ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION private.enforce_friend_request_rate();

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.friendships TO authenticated;
GRANT UPDATE (status, updated_at) ON public.friendships TO authenticated;
CREATE INDEX friendships_requester_status_idx ON public.friendships(requested_by, status);
CREATE POLICY "users can see their own friendships" ON public.friendships
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IN (user_a, user_b));
CREATE POLICY "users can request friendship" ON public.friendships
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = requested_by
    AND status = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users b
      WHERE (b.blocker_id = user_a AND b.blocked_id = user_b)
         OR (b.blocker_id = user_b AND b.blocked_id = user_a)
    )
  );
CREATE POLICY "recipient can accept friendship" ON public.friendships
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) IN (user_a, user_b)
    AND (SELECT auth.uid()) <> requested_by
    AND status = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users b
      WHERE (b.blocker_id = user_a AND b.blocked_id = user_b)
         OR (b.blocker_id = user_b AND b.blocked_id = user_a)
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) IN (user_a, user_b)
    AND (SELECT auth.uid()) <> requested_by
    AND status = 'accepted'
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users b
      WHERE (b.blocker_id = user_a AND b.blocked_id = user_b)
         OR (b.blocker_id = user_b AND b.blocked_id = user_a)
    )
  );
CREATE POLICY "participants can remove friendship or request" ON public.friendships
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) IN (user_a, user_b));

CREATE TABLE public.dm_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dm_conversations_sorted_pair CHECK (user_a < user_b),
  CONSTRAINT dm_conversations_unique_pair UNIQUE (user_a, user_b)
);

ALTER TABLE public.dm_conversations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.dm_conversations TO authenticated;
CREATE POLICY "participants can read unblocked conversations" ON public.dm_conversations
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) IN (user_a, user_b)
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users b
      WHERE (b.blocker_id = user_a AND b.blocked_id = user_b)
         OR (b.blocker_id = user_b AND b.blocked_id = user_a)
    )
  );
CREATE POLICY "friends can start a direct conversation" ON public.dm_conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IN (user_a, user_b)
    AND EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.user_a = dm_conversations.user_a
        AND f.user_b = dm_conversations.user_b
        AND f.status = 'accepted'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users b
      WHERE (b.blocker_id = user_a AND b.blocked_id = user_b)
         OR (b.blocker_id = user_b AND b.blocked_id = user_a)
    )
  );

CREATE TABLE public.dm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz
);

ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.dm_messages TO authenticated;
GRANT UPDATE (content, edited_at) ON public.dm_messages TO authenticated;
CREATE INDEX dm_messages_conversation_created_idx ON public.dm_messages(conversation_id, created_at DESC);
CREATE POLICY "participants can read unblocked direct messages" ON public.dm_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dm_conversations c
      WHERE c.id = conversation_id AND (SELECT auth.uid()) IN (c.user_a, c.user_b)
    )
  );
CREATE POLICY "participants can send direct messages" ON public.dm_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = sender_id
    AND NOT public.is_banned((SELECT auth.uid()))
    AND NOT public.is_timed_out((SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.dm_conversations c
      WHERE c.id = conversation_id AND (SELECT auth.uid()) IN (c.user_a, c.user_b)
    )
  );
CREATE POLICY "authors can edit their direct messages" ON public.dm_messages
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = sender_id
    AND EXISTS (
      SELECT 1 FROM public.dm_conversations c
      WHERE c.id = conversation_id AND (SELECT auth.uid()) IN (c.user_a, c.user_b)
    )
  )
  WITH CHECK ((SELECT auth.uid()) = sender_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages;
