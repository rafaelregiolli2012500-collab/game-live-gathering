CREATE TABLE public.gift_images (
  game_id text NOT NULL,
  image_key text NOT NULL,
  image_url text,
  preview text,
  gift_id text,
  source text NOT NULL DEFAULT 'ai',
  guess text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, image_key)
);
GRANT ALL ON public.gift_images TO service_role;
ALTER TABLE public.gift_images ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.extension_activity (
  id bigserial PRIMARY KEY,
  game_id text NOT NULL,
  kind text NOT NULL,
  ok boolean NOT NULL DEFAULT false,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.extension_activity TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.extension_activity_id_seq TO service_role;
ALTER TABLE public.extension_activity ENABLE ROW LEVEL SECURITY;
CREATE INDEX extension_activity_game_created ON public.extension_activity (game_id, created_at DESC);