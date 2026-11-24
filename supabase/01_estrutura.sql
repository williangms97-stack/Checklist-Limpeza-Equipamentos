-- =============================================================================
-- Checklist de Limpeza de Equipamentos — Dois Marcos Sementes
-- Banco central no Supabase: tabelas, regras de acesso, funções e fotos
--
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo inteiro → Run.
-- Pode ser executado de novo sem perder dados (cria só o que ainda não existe e
-- atualiza as funções).
--
-- Desenho
-- - Cada tabela guarda o documento completo do sistema em "dados" (jsonb), o mesmo
--   formato usado no aparelho. Colunas geradas a partir dele dão chaves e índices.
-- - O navegador NÃO acessa as tabelas diretamente: tudo passa pelas funções ckl_*
--   abaixo, que conferem quem está chamando (perfil e situação).
-- - Fotos ficam no Storage, bucket privado "ckl-fotos".
-- - Prefixo ckl_ em tudo. O sistema tem projeto próprio no Supabase (separado do TSI).
-- - Primeiro administrador: o usuário admin@ckl.doismarcos.com.br (ver LEIA-ME.md).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Perfis de acesso (um por usuário do Supabase Auth)
-- ---------------------------------------------------------------------------
create table if not exists public.ckl_perfis (
  id            uuid primary key references auth.users (id) on delete cascade,
  usuario       text not null unique,
  nome          text not null,
  perfil        text not null default 'OPERADOR' check (perfil in ('ADM', 'OPERADOR')),
  ativo         boolean not null default false,
  criado_em     timestamptz not null default now(),
  criado_por    text,
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Dados do sistema (documento completo em "dados")
-- ---------------------------------------------------------------------------
-- modelo vigente de cada checklist (UBS 01, Secador 01...)
create table if not exists public.ckl_modelos (
  id            text primary key generated always as (dados ->> 'id') stored,
  dados         jsonb not null,
  area          text generated always as (dados ->> 'area') stored,
  removido      boolean not null default false,
  atualizado_em timestamptz not null default clock_timestamp()
);

-- cópia congelada de cada versão de modelo ("<id>@<versão>")
create table if not exists public.ckl_modelos_versoes (
  id            text primary key generated always as (dados ->> 'chave') stored,
  dados         jsonb not null,
  modelo_id     text generated always as (dados ->> 'modeloId') stored,
  removido      boolean not null default false,
  atualizado_em timestamptz not null default clock_timestamp()
);

-- checklists preenchidos (em andamento e concluídos), com a cópia do modelo usado
create table if not exists public.ckl_execucoes (
  id              text primary key generated always as (dados ->> 'id') stored,
  dados           jsonb not null,
  modelo_id       text generated always as (dados ->> 'modeloId') stored,
  responsavel_id  text generated always as (dados ->> 'responsavelId') stored,
  status          text generated always as (dados ->> 'status') stored,
  data_execucao   text generated always as (dados ->> 'dataExecucao') stored,
  recebido_em     timestamptz not null default now(),
  removido        boolean not null default false,
  atualizado_em   timestamptz not null default clock_timestamp()
);

create table if not exists public.ckl_fotos (
  id            text primary key generated always as (dados ->> 'id') stored,
  dados         jsonb not null,
  execucao_id   text generated always as (dados ->> 'execucaoId') stored,
  removido      boolean not null default false,
  atualizado_em timestamptz not null default clock_timestamp()
);

-- uma não conformidade por item NC (com o plano de ação)
create table if not exists public.ckl_nao_conformidades (
  id            text primary key generated always as (dados ->> 'id') stored,
  dados         jsonb not null,
  execucao_id   text generated always as (dados ->> 'execucaoId') stored,
  modelo_id     text generated always as (dados ->> 'modeloId') stored,
  situacao      text generated always as (dados ->> 'situacao') stored,
  removido      boolean not null default false,
  atualizado_em timestamptz not null default clock_timestamp()
);

create table if not exists public.ckl_historico (
  id            text primary key generated always as (dados ->> 'id') stored,
  dados         jsonb not null,
  entidade      text generated always as (dados ->> 'entidadeChave') stored,
  removido      boolean not null default false,
  atualizado_em timestamptz not null default clock_timestamp()
);

create index if not exists ckl_execucoes_modelo_idx on public.ckl_execucoes (modelo_id);
create index if not exists ckl_execucoes_responsavel_idx on public.ckl_execucoes (responsavel_id);
create index if not exists ckl_fotos_execucao_idx on public.ckl_fotos (execucao_id);
create index if not exists ckl_nc_execucao_idx on public.ckl_nao_conformidades (execucao_id);
create index if not exists ckl_historico_entidade_idx on public.ckl_historico (entidade);
do $$
declare t text;
begin
  foreach t in array array['ckl_modelos','ckl_modelos_versoes','ckl_execucoes','ckl_fotos','ckl_nao_conformidades','ckl_historico'] loop
    execute format('create index if not exists %I on public.%I (atualizado_em, id)', t || '_atualizado_idx', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Data de atualização automática (usada para baixar só o que mudou)
-- ---------------------------------------------------------------------------
create or replace function public.ckl_marcar_atualizacao() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := clock_timestamp();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['ckl_perfis','ckl_modelos','ckl_modelos_versoes','ckl_execucoes','ckl_fotos','ckl_nao_conformidades','ckl_historico'] loop
    execute format('drop trigger if exists ckl_atualizacao on public.%I', t);
    execute format('create trigger ckl_atualizacao before update on public.%I for each row execute function public.ckl_marcar_atualizacao()', t);
  end loop;
end $$;

-- histórico é somente inclusão; checklists e não conformidades nunca são apagados
create or replace function public.ckl_bloquear_alteracao() returns trigger
language plpgsql as $$
begin
  raise exception 'Este registro não pode ser alterado nem apagado.' using errcode = 'P0001';
end $$;
drop trigger if exists ckl_historico_imutavel on public.ckl_historico;
create trigger ckl_historico_imutavel before update or delete on public.ckl_historico
  for each row execute function public.ckl_bloquear_alteracao();
drop trigger if exists ckl_execucoes_sem_exclusao on public.ckl_execucoes;
create trigger ckl_execucoes_sem_exclusao before delete on public.ckl_execucoes
  for each row execute function public.ckl_bloquear_alteracao();
drop trigger if exists ckl_nc_sem_exclusao on public.ckl_nao_conformidades;
create trigger ckl_nc_sem_exclusao before delete on public.ckl_nao_conformidades
  for each row execute function public.ckl_bloquear_alteracao();
drop trigger if exists ckl_versoes_imutaveis on public.ckl_modelos_versoes;
create trigger ckl_versoes_imutaveis before update or delete on public.ckl_modelos_versoes
  for each row execute function public.ckl_bloquear_alteracao();

-- ---------------------------------------------------------------------------
-- 4. Acesso: só pelas funções. Tabelas fechadas para o navegador.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['ckl_perfis','ckl_modelos','ckl_modelos_versoes','ckl_execucoes','ckl_fotos','ckl_nao_conformidades','ckl_historico'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    -- a função ckl-usuarios usa a chave de serviço; garantido mesmo em projeto criado
    -- sem "Grant API access to new tables automatically"
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Perfil automático para cada usuário criado no Supabase Auth
--    - admin@ckl.doismarcos.com.br vira Administrador ativo quando ainda não há um;
--    - usuários criados pelo sistema (função ckl-usuarios) já vêm com perfil e ativos;
--    - qualquer outro entra INATIVO e não acessa nada.
-- ---------------------------------------------------------------------------
create or replace function public.ckl_novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_usuario text := lower(coalesce(nullif(meta ->> 'usuario', ''), split_part(new.email, '@', 1), new.id::text));
  primeiro boolean := lower(coalesce(new.email, '')) = 'admin@ckl.doismarcos.com.br'
                      and not exists (select 1 from public.ckl_perfis where perfil = 'ADM' and ativo);
  pelo_sistema boolean := coalesce((meta ->> 'ckl_criado_pelo_sistema')::boolean, false);
begin
  if exists (select 1 from public.ckl_perfis where usuario = v_usuario) then
    v_usuario := v_usuario || '-' || substr(new.id::text, 1, 4);
  end if;
  insert into public.ckl_perfis (id, usuario, nome, perfil, ativo, criado_por)
  values (
    new.id,
    v_usuario,
    coalesce(nullif(meta ->> 'nome', ''), case when primeiro then 'Administrador' else v_usuario end),
    case when primeiro then 'ADM' when pelo_sistema and meta ->> 'perfil' = 'ADM' then 'ADM' else 'OPERADOR' end,
    primeiro or pelo_sistema,
    case when pelo_sistema then nullif(meta ->> 'criado_por', '') else 'Painel do Supabase' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists ckl_novo_usuario on auth.users;
create trigger ckl_novo_usuario after insert on auth.users
  for each row execute function public.ckl_novo_usuario();

-- ---------------------------------------------------------------------------
-- 6. Funções auxiliares
-- ---------------------------------------------------------------------------
create or replace function public.ckl_exigir(p_adm boolean) returns public.ckl_perfis
language plpgsql stable security definer set search_path = public as $$
declare v public.ckl_perfis;
begin
  if auth.uid() is null then
    raise exception 'Sessão encerrada. Entre novamente.' using errcode = 'P0001';
  end if;
  select * into v from public.ckl_perfis where id = auth.uid();
  if not found or not v.ativo then
    raise exception 'Usuário inativo ou sem acesso ao sistema de checklist. Procure o administrador.' using errcode = 'P0001';
  end if;
  if p_adm and v.perfil <> 'ADM' then
    raise exception 'Operação permitida somente ao Administrador.' using errcode = 'P0001';
  end if;
  return v;
end $$;

create or replace function public.ckl_usuario_ativo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ckl_perfis where id = auth.uid() and ativo);
$$;

create or replace function public.ckl_perfil_json(p public.ckl_perfis) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'usuario', p.usuario, 'nome', p.nome, 'perfil', p.perfil, 'ativo', p.ativo,
                            'criadoEm', p.criado_em, 'criadoPor', p.criado_por,
                            'ultimoAcesso', (select u.last_sign_in_at from auth.users u where u.id = p.id));
$$;

create or replace function public.ckl_tabela(p_colecao text) returns text
language sql immutable as $$
  select case p_colecao
    when 'modelos' then 'ckl_modelos'
    when 'modelosVersoes' then 'ckl_modelos_versoes'
    when 'execucoes' then 'ckl_execucoes'
    when 'fotos' then 'ckl_fotos'
    when 'naoConformidades' then 'ckl_nao_conformidades'
    when 'historico' then 'ckl_historico'
    when 'cultivares' then 'ckl_cultivares'   -- tabela criada no 02_cultivares.sql
    when 'veiculos' then 'ckl_veiculos'       -- tabelas criadas no 03_veiculos.sql
    when 'motivos' then 'ckl_motivos'
  end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Funções chamadas pelo sistema (todas recebem um único parâmetro jsonb "p")
-- ---------------------------------------------------------------------------
create or replace function public.ckl_meu_perfil(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v public.ckl_perfis;
begin
  if auth.uid() is null then
    raise exception 'Sessão encerrada. Entre novamente.' using errcode = 'P0001';
  end if;
  select * into v from public.ckl_perfis where id = auth.uid();
  if not found then
    raise exception 'Este usuário não tem acesso ao sistema de checklist.' using errcode = 'P0001';
  end if;
  return public.ckl_perfil_json(v);
end $$;

-- baixa o que mudou em uma coleção desde um ponto (paginado por data + id)
-- p = { colecao, desde (opcional), depoisId (opcional), limite }
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
    -- operador: modelos e cadastros de todos; checklists, veículos, fotos e NCs só os próprios
    if v_colecao in ('historico', 'modelosVersoes') then
      return jsonb_build_object('linhas', '[]'::jsonb);
    elsif v_colecao in ('execucoes', 'veiculos') then
      v_filtro := format(' and responsavel_id = %L', eu.id::text);
    elsif v_colecao in ('fotos', 'naoConformidades') then
      -- (o 03_veiculos.sql troca esta função para incluir as fotos dos registros de veículo)
      v_filtro := format(' and execucao_id in (select e.id from public.ckl_execucoes e where e.responsavel_id = %L)', eu.id::text);
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

-- gravações do Administrador, todas de uma vez (tudo ou nada)
-- p = { operacoes: [ { colecao, tipo: 'salvar'|'inserir', valor } ] }
create or replace function public.ckl_lote(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  eu public.ckl_perfis := public.ckl_exigir(true);
  op jsonb;
  v_colecao text;
  v_tipo text;
  v_tabela text;
  v_valor jsonb;
  n int := 0;
begin
  for op in select * from jsonb_array_elements(coalesce(p -> 'operacoes', '[]'::jsonb)) loop
    v_colecao := op ->> 'colecao';
    v_tipo := op ->> 'tipo';
    v_tabela := public.ckl_tabela(v_colecao);
    v_valor := op -> 'valor';
    if v_tabela is null or v_colecao = 'fotos' then
      raise exception 'Coleção inválida: %', v_colecao using errcode = 'P0001';
    end if;
    if v_tipo not in ('salvar', 'inserir') then
      raise exception 'Exclusão não permitida (%).', v_colecao using errcode = 'P0001';
    end if;
    if v_valor is null or jsonb_typeof(v_valor) <> 'object' then
      raise exception 'Operação sem dados (%).', v_colecao using errcode = 'P0001';
    end if;
    if v_colecao = 'historico' then
      -- o responsável é sempre quem está conectado; evento repetido é ignorado
      insert into public.ckl_historico (dados) values (v_valor || jsonb_build_object('usuarioId', eu.id::text, 'usuarioNome', eu.nome))
        on conflict (id) do nothing;
    elsif v_colecao = 'modelosVersoes' then
      insert into public.ckl_modelos_versoes (dados) values (v_valor) on conflict (id) do nothing;
    elsif v_tipo = 'inserir' then
      begin
        execute format('insert into public.%I (dados) values ($1)', v_tabela) using v_valor;
      exception when unique_violation then
        raise exception 'Registro duplicado em %.', v_colecao using errcode = 'P0001';
      end;
    else
      if v_colecao = 'execucoes' and not exists (select 1 from public.ckl_execucoes where id = v_valor ->> 'id') then
        raise exception 'Checklist não encontrado no servidor.' using errcode = 'P0001';
      end if;
      execute format('insert into public.%1$I (dados) values ($1)
                        on conflict (id) do update set dados = excluded.dados, removido = false', v_tabela)
        using v_valor;
    end if;
    n := n + 1;
  end loop;
  return jsonb_build_object('aplicadas', n);
end $$;

-- checklist enviado pelo celular (em andamento ou concluído); pode chegar mais de uma vez
-- p = { execucao: {...}, fotos: [ {...sem os bytes, com "caminho"} ], naoConformidades: [...], eventos: [...] }
create or replace function public.ckl_enviar_execucao(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  eu public.ckl_perfis := public.ckl_exigir(false);
  e jsonb := p -> 'execucao';
  v_id text := e ->> 'id';
  v_status text := e ->> 'status';
  v_atual jsonb;
  x jsonb;
begin
  if v_id is null or coalesce(e ->> 'modeloId', '') = '' then
    raise exception 'Checklist incompleto.' using errcode = 'P0001';
  end if;
  if (e ->> 'responsavelId') is distinct from eu.id::text then
    raise exception 'O checklist pertence a outro usuário. Entre com o usuário que fez o checklist para enviá-lo.' using errcode = 'P0001';
  end if;
  if v_status not in ('em_andamento', 'concluido', 'concluido_nc', 'descartado') then
    raise exception 'Situação do checklist inválida.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.ckl_modelos where id = e ->> 'modeloId') then
    raise exception 'O modelo deste checklist não existe no servidor.' using errcode = 'P0001';
  end if;

  select dados into v_atual from public.ckl_execucoes where id = v_id;
  if found then
    if (v_atual ->> 'responsavelId') is distinct from eu.id::text then
      raise exception 'Este checklist pertence a outro usuário.' using errcode = 'P0001';
    end if;
    if (v_atual ->> 'status') <> 'em_andamento' then
      -- já enviado: depois disso só o administrador altera
      return jsonb_build_object('situacao', case when v_status = 'em_andamento' then 'ja_concluido' else 'ja_recebido' end, 'id', v_id);
    end if;
  end if;

  e := e || jsonb_build_object('responsavelNome', eu.nome, 'responsavelUsuario', eu.usuario);
  insert into public.ckl_execucoes (dados) values (e)
    on conflict (id) do update set dados = excluded.dados;

  for x in select * from jsonb_array_elements(coalesce(p -> 'fotos', '[]'::jsonb)) loop
    insert into public.ckl_fotos (dados) values ((x - 'dados') || jsonb_build_object('execucaoId', v_id))
      on conflict (id) do update set dados = excluded.dados;
  end loop;

  -- não conformidades só nascem no envio final; depois disso quem mexe é o administrador
  if v_status in ('concluido', 'concluido_nc') then
    for x in select * from jsonb_array_elements(coalesce(p -> 'naoConformidades', '[]'::jsonb)) loop
      insert into public.ckl_nao_conformidades (dados)
        values (x || jsonb_build_object('execucaoId', v_id, 'registradaPorId', eu.id::text, 'registradaPorNome', eu.nome))
        on conflict (id) do nothing;
    end loop;
  end if;

  for x in select * from jsonb_array_elements(coalesce(p -> 'eventos', '[]'::jsonb)) loop
    if x ->> 'entidadeChave' = 'execucao:' || v_id then
      insert into public.ckl_historico (dados) values (x || jsonb_build_object('usuarioId', eu.id::text, 'usuarioNome', eu.nome))
        on conflict (id) do nothing;
    end if;
  end loop;
  return jsonb_build_object('situacao', 'recebido', 'id', v_id);
end $$;

create or replace function public.ckl_listar_perfis(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.ckl_exigir(true);
  return coalesce((select jsonb_agg(public.ckl_perfil_json(x) order by x.nome) from public.ckl_perfis x), '[]'::jsonb);
end $$;

revoke all on function public.ckl_meu_perfil(jsonb), public.ckl_puxar(jsonb), public.ckl_lote(jsonb),
  public.ckl_enviar_execucao(jsonb), public.ckl_listar_perfis(jsonb) from public, anon;
grant execute on function public.ckl_meu_perfil(jsonb), public.ckl_puxar(jsonb), public.ckl_lote(jsonb),
  public.ckl_enviar_execucao(jsonb), public.ckl_listar_perfis(jsonb) to authenticated;
revoke all on function public.ckl_novo_usuario(), public.ckl_exigir(boolean),
  public.ckl_perfil_json(public.ckl_perfis) from public, anon, authenticated;
grant execute on function public.ckl_usuario_ativo() to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Fotografias: bucket privado, leitura e envio só para usuários ativos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ckl-fotos', 'ckl-fotos', false, 10485760, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

drop policy if exists "ckl fotos leitura" on storage.objects;
create policy "ckl fotos leitura" on storage.objects for select to authenticated
  using (bucket_id = 'ckl-fotos' and public.ckl_usuario_ativo());

drop policy if exists "ckl fotos envio" on storage.objects;
create policy "ckl fotos envio" on storage.objects for insert to authenticated
  with check (bucket_id = 'ckl-fotos' and (storage.foldername(name))[1] = 'execucoes' and public.ckl_usuario_ativo());

drop policy if exists "ckl fotos reenvio" on storage.objects;
create policy "ckl fotos reenvio" on storage.objects for update to authenticated
  using (bucket_id = 'ckl-fotos' and public.ckl_usuario_ativo())
  with check (bucket_id = 'ckl-fotos' and (storage.foldername(name))[1] = 'execucoes' and public.ckl_usuario_ativo());
