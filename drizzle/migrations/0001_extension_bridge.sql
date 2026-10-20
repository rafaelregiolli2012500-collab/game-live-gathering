CREATE TABLE public.extension_settings (
  id text PRIMARY KEY,
  token text NOT NULL,
  keyword_lula text NOT NULL DEFAULT '#lula',
  keyword_flavio text NOT NULL DEFAULT '#flavio',
  default_character text NOT NULL DEFAULT 'none',
  last_seen_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.extension_settings TO service_role;
ALTER TABLE public.extension_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.viewer_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL DEFAULT 'main-arena',
  username text NOT NULL,
  character text NOT NULL,
  source_text text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, username)
);
GRANT ALL ON public.viewer_teams TO service_role;
ALTER TABLE public.viewer_teams ENABLE ROW LEVEL SECURITY;