CREATE TABLE public.live_game_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  username text,
  nickname text,
  gift_name text,
  gift_count int NOT NULL DEFAULT 1,
  coins int NOT NULL DEFAULT 0,
  comment text,
  character_key text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  processor_id text,
  lease_until timestamptz,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.live_game_events TO service_role;

ALTER TABLE public.live_game_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX live_game_events_status_created_idx ON public.live_game_events (status, created_at);

CREATE OR REPLACE FUNCTION public.claim_live_game_events(
  p_limit int,
  p_processor_id text,
  p_lease_seconds int DEFAULT 60
)
RETURNS SETOF public.live_game_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT e.id
    FROM public.live_game_events e
    WHERE e.status = 'pending'
    ORDER BY e.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1, least(coalesce(p_limit, 10), 50))
  )
  UPDATE public.live_game_events e
  SET
    status = 'processing',
    processor_id = p_processor_id,
    lease_until = now() + make_interval(secs => greatest(10, coalesce(p_lease_seconds, 60))),
    attempts = coalesce(e.attempts, 0) + 1
  FROM picked
  WHERE e.id = picked.id
  RETURNING e.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.requeue_expired_live_game_events(
  p_lease_seconds int DEFAULT 60
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  UPDATE public.live_game_events
  SET status = 'pending', processor_id = NULL, lease_until = NULL
  WHERE status = 'processing'
    AND (
      lease_until IS NULL AND created_at < now() - make_interval(secs => greatest(30, coalesce(p_lease_seconds, 60)))
      OR lease_until < now()
    );
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_live_game_events(int, text, int) FROM public;
REVOKE ALL ON FUNCTION public.requeue_expired_live_game_events(int) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_live_game_events(int, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.requeue_expired_live_game_events(int) TO service_role;