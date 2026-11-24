-- =============================================================================
-- Checklist de Limpeza de Equipamentos — 04: cabeçalho das fichas de veículo
-- -----------------------------------------------------------------------------
-- Rodar depois do 01, 02 e 03. Pode ser executado de novo sem perder dados.
-- - ckl_documentos_veiculo: identificação, versão, página, elaborado/revisado/
--   aprovado por e data de aprovação das fichas "Conferência de descarga" e
--   "Autorização sem vistoria". Uma linha por ficha; só o administrador grava
--   (pela função ckl_lote, que já exige administrador). Todos os usuários leem.
-- =============================================================================

create table if not exists public.ckl_documentos_veiculo (
  id            text primary key generated always as (dados ->> 'id') stored,
  dados         jsonb not null,
  removido      boolean not null default false,
  atualizado_em timestamptz not null default clock_timestamp()
);

create index if not exists ckl_documentos_veiculo_atualizado_idx on public.ckl_documentos_veiculo (atualizado_em, id);

drop trigger if exists ckl_atualizacao on public.ckl_documentos_veiculo;
create trigger ckl_atualizacao before update on public.ckl_documentos_veiculo
  for each row execute function public.ckl_marcar_atualizacao();
alter table public.ckl_documentos_veiculo enable row level security;
revoke all on public.ckl_documentos_veiculo from anon, authenticated;
grant all on public.ckl_documentos_veiculo to service_role;

-- nunca é apagado (cada alteração fica no histórico)
drop trigger if exists ckl_documentos_veiculo_sem_exclusao on public.ckl_documentos_veiculo;
create trigger ckl_documentos_veiculo_sem_exclusao before delete on public.ckl_documentos_veiculo
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
    when 'documentosVeiculo' then 'ckl_documentos_veiculo'
  end;
$$;
