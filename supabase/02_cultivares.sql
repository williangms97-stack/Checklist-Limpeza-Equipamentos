-- =============================================================================
-- Checklist de Limpeza de Equipamentos — 02: cadastro de cultivares
-- -----------------------------------------------------------------------------
-- Rodar depois do 01_estrutura.sql. Pode ser executado de novo sem perder dados.
-- - Tabela ckl_cultivares (mesmo formato das outras: documento em "dados").
-- - Todos os usuários ativos baixam a lista; só o Administrador grava (ckl_lote).
-- - Cultivar não é apagada: é desativada (fica no histórico).
-- - A lista inicial é carregada pelo painel (tela Cultivares).
-- =============================================================================

create table if not exists public.ckl_cultivares (
  id            text primary key generated always as (dados ->> 'id') stored,
  dados         jsonb not null,
  nome          text generated always as (dados ->> 'nome') stored,
  removido      boolean not null default false,
  atualizado_em timestamptz not null default clock_timestamp()
);

create index if not exists ckl_cultivares_atualizado_idx on public.ckl_cultivares (atualizado_em, id);

drop trigger if exists ckl_atualizacao on public.ckl_cultivares;
create trigger ckl_atualizacao before update on public.ckl_cultivares
  for each row execute function public.ckl_marcar_atualizacao();

drop trigger if exists ckl_cultivares_sem_exclusao on public.ckl_cultivares;
create trigger ckl_cultivares_sem_exclusao before delete on public.ckl_cultivares
  for each row execute function public.ckl_bloquear_alteracao();

alter table public.ckl_cultivares enable row level security;
revoke all on public.ckl_cultivares from anon, authenticated;
grant all on public.ckl_cultivares to service_role;

-- coleção "cultivares" passa a ser aceita por ckl_puxar e ckl_lote
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
  end;
$$;
