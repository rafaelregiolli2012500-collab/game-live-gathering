CREATE TABLE public.scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name text NOT NULL,
  score integer NOT NULL,
  character text NOT NULL,
  mode text NOT NULL,
  difficulty text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.scores TO service_role;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.round_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL DEFAULT 'main-arena',
  session_id text NOT NULL,
  round integer NOT NULL,
  winner text NOT NULL,
  loser text NOT NULL,
  contributors jsonb NOT NULL DEFAULT '[]'::jsonb,
  gifts_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, session_id, round)
);
GRANT ALL ON public.round_results TO service_role;
ALTER TABLE public.round_results ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.live_config (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.live_config TO service_role;
ALTER TABLE public.live_config ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.live_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence bigint GENERATED ALWAYS AS IDENTITY,
  game_id text NOT NULL,
  event_id text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, event_id)
);
GRANT SELECT ON public.live_events TO anon, authenticated;
GRANT ALL ON public.live_events TO service_role;
ALTER TABLE public.live_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gift events are public" ON public.live_events FOR SELECT TO anon, authenticated USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_events;