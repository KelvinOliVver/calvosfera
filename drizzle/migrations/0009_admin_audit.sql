CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (char_length(action) BETWEEN 3 AND 80),
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
CREATE POLICY "only admins read audit records" ON public.admin_audit_log
  FOR SELECT TO authenticated USING (public.has_role((SELECT auth.uid()), 'admin'));
CREATE INDEX admin_audit_log_created_idx ON public.admin_audit_log(created_at DESC);

-- Only the server service role may call this function. The check uses the
-- actor supplied by the authenticated server handler and records atomically.
CREATE OR REPLACE FUNCTION public.admin_set_role(_actor uuid, _target uuid, _enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE admin_count integer;
BEGIN
  IF _actor IS NULL OR _target IS NULL OR NOT public.has_role(_actor, 'admin') THEN
    RAISE EXCEPTION 'Only an administrator may manage administrator roles' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _target) THEN
    RAISE EXCEPTION 'Target user not found' USING ERRCODE = '22023';
  END IF;
  IF _enabled THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_target, 'admin') ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    IF _actor = _target THEN
      RAISE EXCEPTION 'You cannot remove your own administrator role' USING ERRCODE = '42501';
    END IF;
    SELECT count(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
    IF admin_count <= 1 THEN
      RAISE EXCEPTION 'The last administrator cannot be removed' USING ERRCODE = '42501';
    END IF;
    DELETE FROM public.user_roles WHERE user_id = _target AND role = 'admin';
  END IF;
  INSERT INTO public.admin_audit_log (actor_id, action, target_user_id, details)
  VALUES (_actor, CASE WHEN _enabled THEN 'admin_role_granted' ELSE 'admin_role_revoked' END, _target, '{}'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_role(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, uuid, boolean) TO service_role;
