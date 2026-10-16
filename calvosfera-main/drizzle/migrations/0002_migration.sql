CREATE UNIQUE INDEX profiles_username_lower_uniq ON public.profiles (lower(username));

CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles readable" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.bans (
  user_id uuid PRIMARY KEY,
  reason text,
  banned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bans TO authenticated;
GRANT ALL ON public.bans TO service_role;
ALTER TABLE public.bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ban or admin" ON public.bans FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.is_banned(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.bans WHERE user_id = _user_id)
$$;

-- identifiers seen per account (ip / device / fingerprint)
CREATE TABLE public.user_identifiers (
  user_id uuid NOT NULL,
  kind text NOT NULL,
  value text NOT NULL,
  last_seen timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, value)
);
GRANT ALL ON public.user_identifiers TO service_role;
ALTER TABLE public.user_identifiers ENABLE ROW LEVEL SECURITY;

-- blocked identifiers
CREATE TABLE public.banned_identifiers (
  kind text NOT NULL,
  value text NOT NULL,
  source_user uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, value)
);
GRANT ALL ON public.banned_identifiers TO service_role;
ALTER TABLE public.banned_identifiers ENABLE ROW LEVEL SECURITY;

-- banned users cannot post or edit profile
DROP POLICY "own messages insert" ON public.messages;
CREATE POLICY "own messages insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_banned(auth.uid()));
DROP POLICY "own profile update" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id AND NOT public.is_banned(auth.uid()));
CREATE POLICY "admin delete messages" ON public.messages FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.user_roles (user_id, role) VALUES ('4f9107c9-6cbb-4e93-8189-044c53cce674', 'admin');