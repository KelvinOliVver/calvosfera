ALTER TABLE public.profiles
  ADD COLUMN profile_extras jsonb NOT NULL DEFAULT '{"avatar_frame":"none","badge":null,"connections":[],"widgets":[],"wishlist":[]}'::jsonb;
