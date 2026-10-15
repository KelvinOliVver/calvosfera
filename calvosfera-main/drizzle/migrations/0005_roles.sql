-- Cargos adicionais para a comunidade. Apenas a função de servidor pode atribuí-los.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'moderator';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vip';
