-- Sécurité (16/11/2026)
-- 1. Le bucket des miniatures n'accepte plus d'écriture ni de suppression avec la clé publique (anon).
--    Les envois passent par la fonction admin-projects, qui vérifie le mot de passe
--    puis délivre une URL d'envoi signée (valable une seule fois).
-- 2. Table de limitation de débit, utilisée par les fonctions cyberbot-chat (Jarvis) et admin-projects.

DROP POLICY IF EXISTS "Authenticated can upload thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete thumbnails" ON storage.objects;

-- Lecture publique conservée (les miniatures s'affichent sur le site).
-- Taille et types de fichiers limités, même pour les envois signés.
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif']
WHERE id = 'project-thumbnails';

-- ——— Limitation de débit ———
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  hits INTEGER NOT NULL DEFAULT 0
);

-- RLS sans aucune règle : seule la clé service_role (côté serveur) peut y accéder.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limits TO service_role;

-- Fonctions exécutées avec les droits de l'appelant (SECURITY INVOKER) : seule service_role peut les appeler.
-- Compte un passage et indique s'il reste sous la limite (true = autorisé).
CREATE OR REPLACE FUNCTION public.hit_rate_limit(p_key TEXT, p_max INTEGER, p_window_seconds INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_hits INTEGER;
BEGIN
  INSERT INTO public.rate_limits AS r (key, window_start, hits)
  VALUES (p_key, now(), 1)
  ON CONFLICT (key) DO UPDATE SET
    hits = CASE WHEN r.window_start < now() - make_interval(secs => p_window_seconds) THEN 1 ELSE r.hits + 1 END,
    window_start = CASE WHEN r.window_start < now() - make_interval(secs => p_window_seconds) THEN now() ELSE r.window_start END
  RETURNING hits INTO v_hits;

  -- Ménage occasionnel des compteurs expirés
  IF random() < 0.02 THEN
    DELETE FROM public.rate_limits WHERE window_start < now() - INTERVAL '2 days';
  END IF;

  RETURN v_hits <= p_max;
END;
$$;

-- Lit un compteur sans l'incrémenter (true = bloqué).
CREATE OR REPLACE FUNCTION public.rate_limit_blocked(p_key TEXT, p_max INTEGER, p_window_seconds INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT hits >= p_max FROM public.rate_limits
     WHERE key = p_key AND window_start >= now() - make_interval(secs => p_window_seconds)),
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.hit_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rate_limit_blocked(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hit_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.rate_limit_blocked(TEXT, INTEGER, INTEGER) TO service_role;
