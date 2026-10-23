-- Rumo: banco de sincronização no Supabase (plano gratuito).
-- Rode este arquivo inteiro uma vez em: Supabase → SQL Editor → New query → Run.
-- Pode rodar de novo sem problema (é idempotente).
--
-- Modelo: cada registro do app (tarefa, conclusão, meta...) é um documento JSON identificado por
-- (usuário, coleção, id). As escritas passam só pela função push_ops, que aplica "last writer wins"
-- por registro e numera cada mudança com seq. Os aparelhos leem "tudo com seq > último visto"
-- e recebem um aviso em tempo real (Supabase Realtime) quando algo muda.

create table if not exists public.records (
  user_id    uuid   not null references auth.users (id) on delete cascade,
  col        text   not null check (col in ('tasks', 'completions', 'settings', 'goals', 'goalLogs')),
  id         text   not null check (length(id) between 1 and 128),
  data       jsonb,
  updated_at bigint not null,
  device_id  text   not null,
  deleted    boolean not null default false,
  seq        bigint not null,
  primary key (user_id, col, id)
);

create index if not exists records_by_seq on public.records (user_id, seq);
create sequence if not exists public.records_seq;

-- Cada usuário só enxerga as próprias linhas (vale para leitura e para o tempo real).
alter table public.records enable row level security;
drop policy if exists "dono le" on public.records;
create policy "dono le" on public.records for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.records from anon, authenticated;
grant select on public.records to authenticated;
revoke all on sequence public.records_seq from anon, authenticated;

-- Aplica um lote de operações do aparelho p_device e devolve a versão vencedora de cada registro.
create or replace function public.push_ops(p_device text, p_ops jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  dev text := left(coalesce(p_device, ''), 64);
  op jsonb;
  op_col text;
  op_id text;
  op_ts bigint;
  op_deleted boolean;
  cur public.records;
  result jsonb := '[]'::jsonb;
begin
  if uid is null then
    raise exception 'Sessão inválida' using errcode = '28000';
  end if;
  if dev = '' then
    raise exception 'deviceId inválido' using errcode = '22023';
  end if;
  if jsonb_typeof(p_ops) is distinct from 'array' then
    raise exception 'ops deve ser uma lista' using errcode = '22023';
  end if;
  if jsonb_array_length(p_ops) > 500 then
    raise exception 'Máximo de 500 operações por lote' using errcode = '22023';
  end if;

  -- Serializa os lotes de um mesmo usuário: cada seq é gravado antes de o próximo ser gerado,
  -- então quem lê "seq > X" nunca pula uma mudança que ainda estava em andamento.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  for op in select value from jsonb_array_elements(p_ops) loop
    op_col := op->>'col';
    op_id := op->>'id';
    op_deleted := coalesce((op->>'deleted')::boolean, false);
    if op_col is null or op_col not in ('tasks', 'completions', 'settings', 'goals', 'goalLogs') then
      raise exception 'Coleção desconhecida: %', op_col using errcode = '22023';
    end if;
    if op_id is null or length(op_id) not between 1 and 128 then
      raise exception 'id inválido' using errcode = '22023';
    end if;
    if jsonb_typeof(op->'updatedAt') is distinct from 'number' then
      raise exception 'updatedAt inválido' using errcode = '22023';
    end if;
    op_ts := (op->>'updatedAt')::numeric::bigint;
    if not op_deleted then
      if jsonb_typeof(op->'data') is distinct from 'object' then
        raise exception 'data deve ser um objeto' using errcode = '22023';
      end if;
      if length((op->'data')::text) > 16384 then
        raise exception 'Registro grande demais' using errcode = '22023';
      end if;
    end if;

    select * into cur from public.records r where r.user_id = uid and r.col = op_col and r.id = op_id;
    -- LWW: maior timestamp vence; empate decidido pelo deviceId (mesma regra do app).
    -- collate "C" compara byte a byte, igual ao JavaScript.
    if found and not (op_ts > cur.updated_at or (op_ts = cur.updated_at and dev collate "C" > cur.device_id collate "C")) then
      result := result || jsonb_build_array(public.record_change(cur));
      continue;
    end if;

    insert into public.records as r (user_id, col, id, data, updated_at, device_id, deleted, seq)
    values (uid, op_col, op_id, case when op_deleted then null else op->'data' end, op_ts, dev, op_deleted, nextval('public.records_seq'))
    on conflict (user_id, col, id) do update set
      data = excluded.data, updated_at = excluded.updated_at, device_id = excluded.device_id,
      deleted = excluded.deleted, seq = excluded.seq
    returning r.* into cur;
    result := result || jsonb_build_array(public.record_change(cur));
  end loop;

  return result;
end;
$$;

-- Formato que o app entende (mesmo do tipo Change em app/src/data/types.ts).
create or replace function public.record_change(r public.records)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'col', r.col, 'id', r.id, 'data', r.data, 'updatedAt', r.updated_at,
    'deviceId', r.device_id, 'deleted', r.deleted, 'seq', r.seq
  );
$$;

revoke all on function public.push_ops(text, jsonb) from public, anon;
grant execute on function public.push_ops(text, jsonb) to authenticated;
revoke all on function public.record_change(public.records) from public, anon;

-- Tempo real: avisa os outros aparelhos do mesmo usuário quando um registro muda.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'records'
  ) then
    alter publication supabase_realtime add table public.records;
  end if;
end;
$$;
