-- =============================================================================
-- Checklist de Limpeza de Equipamentos — 03: limpeza de veículos
-- -----------------------------------------------------------------------------
-- Rodar depois do 01 e do 02. Pode ser executado de novo sem perder dados.
-- - ckl_veiculos: conferências de descarga e autorizações sem vistoria
--   (um registro por veículo, enviado pelo celular quando concluído).
-- - ckl_motivos: motivos padrão da autorização (cadastro do administrador).
-- - Fotos dos registros de veículo: mesmo bucket ckl-fotos, pasta execucoes/<id>.
-- =============================================================================

create table if not exists public.ckl_veiculos (
  id             text primary key generated always as (dados ->> 'id') stored,
  dados          jsonb not null,
  tipo           text generated always as (dados ->> 'tipo') stored,
  responsavel_id text generated always as (dados ->> 'responsavelId') stored,
  status         text generated always as (dados ->> 'status') stored,
  data_hora      text generated always as (dados ->> 'dataHora') stored,
  recebido_em    timestamptz not null default now(),
  removido       boolean not null default false,
  atualizado_em  timestamptz not null default clock_timestamp()
);

create table if not exists public.ckl_motivos (
  id            text primary key generated always as (dados ->> 'id') stored,
  dados         jsonb not null,
  nome          text generated always as (dados ->> 'nome') stored,
  removido      boolean not null default false,
  atualizado_em timestamptz not null default clock_timestamp()
);

create index if not exists ckl_veiculos_responsavel_idx on public.ckl_veiculos (responsavel_id);
create index if not exists ckl_veiculos_atualizado_idx on public.ckl_veiculos (atualizado_em, id);
create index if not exists ckl_motivos_atualizado_idx on public.ckl_motivos (atualizado_em, id);

do $$
declare t text;
begin
  foreach t in array array['ckl_veiculos', 'ckl_motivos'] loop
    execute format('drop trigger if exists ckl_atualizacao on public.%I', t);
    execute format('create trigger ckl_atualizacao before update on public.%I for each row execute function public.ckl_marcar_atualizacao()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- registros de veículo e motivos nunca são apagados
drop trigger if exists ckl_veiculos_sem_exclusao on public.ckl_veiculos;
create trigger ckl_veiculos_sem_exclusao before delete on public.ckl_veiculos
  for each row execute function public.ckl_bloquear_alteracao();
drop trigger if exists ckl_motivos_sem_exclusao on public.ckl_motivos;
create trigger ckl_motivos_sem_exclusao before delete on public.ckl_motivos
  for each row execute function public.ckl_bloquear_alteracao();

-- coleções aceitas por ckl_puxar e ckl_lote
create or replace function public.ckl_tabela(p_colecao text) returns text
language sql immutable as $$
  select case p_colecao
    when 'modelos' then 'ckl_modelos'
    when 'modelosVersoes' then 'ckl_modelos_versoes'
    when 'execucoes' then 'ckl_execucoes'
    when 'fotos' then 'ckl_fotos'
    when 'naoConformidades' then 'ckl_nao_conformidades'
    when 'historico' then 'ckl_historico'
    when 'cultivares' then 'ckl_cultivares'
    when 'veiculos' then 'ckl_veiculos'
    when 'motivos' then 'ckl_motivos'
  end;
$$;

-- baixar novidades: o operador recebe só os próprios registros de veículo e as fotos deles
create or replace function public.ckl_puxar(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  eu public.ckl_perfis := public.ckl_exigir(false);
  v_colecao text := p ->> 'colecao';
  v_tabela text := public.ckl_tabela(v_colecao);
  v_desde timestamptz := coalesce((p ->> 'desde')::timestamptz, '-infinity'::timestamptz);
  v_depois text := coalesce(p ->> 'depoisId', '');
  v_limite int := least(greatest(coalesce((p ->> 'limite')::int, 500), 1), 1000);
  v_filtro text := '';
  v_linhas jsonb;
begin
  if v_tabela is null then
    raise exception 'Coleção inválida: %', v_colecao using errcode = 'P0001';
  end if;
  if eu.perfil <> 'ADM' then
    if v_colecao in ('historico', 'modelosVersoes') then
      return jsonb_build_object('linhas', '[]'::jsonb);
    elsif v_colecao in ('execucoes', 'veiculos') then
      v_filtro := format(' and responsavel_id = %L', eu.id::text);
    elsif v_colecao = 'naoConformidades' then
      v_filtro := format(' and execucao_id in (select e.id from public.ckl_execucoes e where e.responsavel_id = %L)', eu.id::text);
    elsif v_colecao = 'fotos' then
      v_filtro := format(' and (execucao_id in (select e.id from public.ckl_execucoes e where e.responsavel_id = %1$L)'
                         ' or execucao_id in (select v.id from public.ckl_veiculos v where v.responsavel_id = %1$L))', eu.id::text);
    end if;
  end if;

  execute format(
    'select coalesce(jsonb_agg(jsonb_build_object(''id'', id, ''dados'', dados, ''removido'', removido, ''atualizadoEm'', atualizado_em) order by atualizado_em, id), ''[]''::jsonb)
       from (select id, dados, removido, atualizado_em from public.%1$I
              where (atualizado_em, id) > ($1, $2) %2$s
              order by atualizado_em, id limit $3) x',
    v_tabela, v_filtro)
  into v_linhas using v_desde, v_depois, v_limite;

  return jsonb_build_object('linhas', v_linhas, 'servidorEm', clock_timestamp());
end $$;

-- registro de veículo enviado pelo celular (só concluído; pode chegar mais de uma vez)
-- p = { veiculo: {...}, fotos: [ {...sem os bytes, com "caminho"} ], eventos: [...] }
create or replace function public.ckl_enviar_veiculo(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  eu public.ckl_perfis := public.ckl_exigir(false);
  v jsonb := p -> 'veiculo';
  v_id text := v ->> 'id';
  x jsonb;
begin
  if v_id is null or coalesce(v ->> 'tipo', '') not in ('conferencia', 'autorizacao') then
    raise exception 'Registro de veículo incompleto.' using errcode = 'P0001';
  end if;
  if (v ->> 'responsavelId') is distinct from eu.id::text then
    raise exception 'O registro pertence a outro usuário. Entre com o usuário que fez o registro para enviá-lo.' using errcode = 'P0001';
  end if;
  if (v ->> 'status') is distinct from 'concluido' then
    raise exception 'Só registros concluídos são enviados.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.ckl_veiculos where id = v_id) then
    -- já recebido: depois disso só o administrador altera
    return jsonb_build_object('situacao', 'ja_recebido', 'id', v_id);
  end if;

  v := v || jsonb_build_object('responsavelNome', eu.nome, 'responsavelUsuario', eu.usuario);
  insert into public.ckl_veiculos (dados) values (v);

  for x in select * from jsonb_array_elements(coalesce(p -> 'fotos', '[]'::jsonb)) loop
    insert into public.ckl_fotos (dados) values ((x - 'dados') || jsonb_build_object('execucaoId', v_id))
      on conflict (id) do nothing;
  end loop;

  for x in select * from jsonb_array_elements(coalesce(p -> 'eventos', '[]'::jsonb)) loop
    if x ->> 'entidadeChave' = 'veiculo:' || v_id then
      insert into public.ckl_historico (dados) values (x || jsonb_build_object('usuarioId', eu.id::text, 'usuarioNome', eu.nome))
        on conflict (id) do nothing;
    end if;
  end loop;
  return jsonb_build_object('situacao', 'recebido', 'id', v_id);
end $$;

revoke all on function public.ckl_puxar(jsonb), public.ckl_enviar_veiculo(jsonb) from public, anon;
grant execute on function public.ckl_puxar(jsonb), public.ckl_enviar_veiculo(jsonb) to authenticated;
