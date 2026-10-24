-- GAME.LIVE — RPCs opcionais para reserva atômica da fila
-- Executar no SQL do backend (Lovable Cloud)
-- NÃO é destrutivo: só adiciona funções e colunas opcionais.

-- Colunas opcionais para lease (seguro se já existirem — ajuste se der erro)
alter table public.live_game_events
  add column if not exists processor_id text,
  add column if not exists lease_until timestamptz,
  add column if not exists attempts int default 0;

-- Reserva atômica de eventos pending
create or replace function public.claim_live_game_events(
  p_limit int,
  p_processor_id text,
  p_lease_seconds int default 60
)
returns setof public.live_game_events
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select e.id
    from public.live_game_events e
    where e.status = 'pending'
    order by e.created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  )
  update public.live_game_events e
  set
    status = 'processing',
    processor_id = p_processor_id,
    lease_until = now() + make_interval(secs => greatest(10, coalesce(p_lease_seconds, 60))),
    attempts = coalesce(e.attempts, 0) + 1
  from picked
  where e.id = picked.id
  returning e.*;
end;
$$;

-- Reencaminha processing com lease expirado de volta para pending
create or replace function public.requeue_expired_live_game_events(
  p_lease_seconds int default 60
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.live_game_events
  set status = 'pending', processor_id = null, lease_until = null
  where status = 'processing'
    and (
      lease_until is null and created_at < now() - make_interval(secs => greatest(30, coalesce(p_lease_seconds, 60)))
      or lease_until < now()
    );
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Permissões: apenas service_role deve executar (padrão security definer)
revoke all on function public.claim_live_game_events(int, text, int) from public;
revoke all on function public.requeue_expired_live_game_events(int) from public;
grant execute on function public.claim_live_game_events(int, text, int) to service_role;
grant execute on function public.requeue_expired_live_game_events(int) to service_role;
