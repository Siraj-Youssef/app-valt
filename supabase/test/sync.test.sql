-- Testes do push_ops e da segurança (RLS). Cada bloco falha com exception se algo der errado.
\set ON_ERROR_STOP 1
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');

create function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', u, false);
$$;

set role authenticated;

-- 1. Cria registros, numera com seq e devolve no formato do app.
do $$
declare r jsonb;
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
  r := public.push_ops('dev-a', '[{"col":"tasks","id":"t1","data":{"title":"Ler"},"updatedAt":100,"deleted":false},
                                  {"col":"settings","id":"profile","data":{"name":"Ana"},"updatedAt":100,"deleted":false}]');
  assert jsonb_array_length(r) = 2, 'deveria aceitar 2';
  assert r->0->>'col' = 'tasks' and r->0->'data'->>'title' = 'Ler' and (r->0->>'updatedAt')::bigint = 100
     and r->0->>'deviceId' = 'dev-a' and (r->0->>'deleted')::boolean = false, 'formato: ' || r::text;
  assert (r->1->>'seq')::bigint > (r->0->>'seq')::bigint, 'seq deve crescer';
  assert (select count(*) from public.records) = 2, 'dono vê os próprios registros';
end $$;

-- 2. Conflito: versão mais antiga perde e recebe a vencedora; mais nova vence e ganha seq novo.
do $$
declare r jsonb; old_seq bigint;
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
  select seq into old_seq from public.records where id = 't1';
  r := public.push_ops('dev-b', '[{"col":"tasks","id":"t1","data":{"title":"Velho"},"updatedAt":50,"deleted":false}]');
  assert r->0->'data'->>'title' = 'Ler' and r->0->>'deviceId' = 'dev-a', 'antiga deveria perder: ' || r::text;
  assert (select seq from public.records where id = 't1') = old_seq, 'rejeitada não muda seq';
  r := public.push_ops('dev-b', '[{"col":"tasks","id":"t1","data":{"title":"Novo"},"updatedAt":200,"deleted":false}]');
  assert r->0->'data'->>'title' = 'Novo' and (r->0->>'seq')::bigint > old_seq, 'nova deveria vencer';
end $$;

-- 3. Empate de timestamp: maior deviceId vence, comparando byte a byte como o JavaScript ('-' < 'a').
do $$
declare r jsonb;
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
  perform public.push_ops('a-z', '[{"col":"goals","id":"g1","data":{"v":1},"updatedAt":300,"deleted":false}]');
  r := public.push_ops('aa', '[{"col":"goals","id":"g1","data":{"v":2},"updatedAt":300,"deleted":false}]');
  assert r->0->'data'->>'v' = '2', 'aa > a-z em JS: ' || r::text;
  r := public.push_ops('a-z', '[{"col":"goals","id":"g1","data":{"v":3},"updatedAt":300,"deleted":false}]');
  assert r->0->'data'->>'v' = '2', 'a-z < aa em JS: ' || r::text;
end $$;

-- 4. Exclusão vira tombstone (data nula, deleted = true).
do $$
declare r jsonb;
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
  r := public.push_ops('dev-a', '[{"col":"goals","id":"g1","data":null,"updatedAt":400,"deleted":true}]');
  assert (r->0->>'deleted')::boolean and r->0->'data' = 'null'::jsonb, 'tombstone: ' || r::text;
end $$;

-- 5. Isolamento: B não vê nem altera registros de A, mesmo usando os mesmos ids.
do $$
declare r jsonb;
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
  assert (select count(*) from public.records) = 0, 'B não pode ver registros de A';
  r := public.push_ops('dev-x', '[{"col":"tasks","id":"t1","data":{"title":"De B"},"updatedAt":1,"deleted":false}]');
  assert r->0->'data'->>'title' = 'De B', 'B tem o próprio t1';
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
  assert (select data->>'title' from public.records where id = 't1') = 'Novo', 't1 de A intacto';
end $$;

-- 6. Validação recusa o lote inteiro.
do $$
declare bad text;
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
  foreach bad in array array[
    '[{"col":"senhas","id":"x","data":{},"updatedAt":1}]',
    '[{"col":"tasks","id":"","data":{},"updatedAt":1}]',
    '[{"col":"tasks","id":"x","data":[1],"updatedAt":1}]',
    '[{"col":"tasks","id":"x","data":{},"updatedAt":"ontem"}]',
    '{"col":"tasks"}'
  ] loop
    begin
      perform public.push_ops('dev-a', bad::jsonb);
      raise exception 'deveria recusar %', bad;
    exception when sqlstate '22023' then null;
    end;
  end loop;
  begin
    perform public.push_ops('dev-a', '[{"col":"tasks","id":"x","data":{"a":1},"updatedAt":1}]'::jsonb || '[{"col":"bad","id":"y","data":{},"updatedAt":1}]'::jsonb);
    raise exception 'deveria recusar';
  exception when sqlstate '22023' then null;
  end;
  assert not exists (select 1 from public.records where id = 'x'), 'lote recusado não grava nada';
end $$;

-- 7. Sem sessão não grava; escrita direta na tabela é proibida.
do $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  begin
    perform public.push_ops('dev-a', '[]');
    raise exception 'sem sessão deveria falhar';
  exception when sqlstate '28000' then null;
  end;
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
  begin
    insert into public.records values ('00000000-0000-0000-0000-00000000000a', 'tasks', 'z', '{}', 1, 'd', false, 1);
    raise exception 'insert direto deveria falhar';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
set role anon;
do $$
begin
  begin
    perform public.push_ops('dev-a', '[]');
    raise exception 'anon não pode chamar push_ops';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.records;
    raise exception 'anon não pode ler records';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 8. A tabela está na publicação do Realtime.
do $$ begin
  assert exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'records'), 'realtime';
end $$;

\echo 'OK: todos os testes passaram'
