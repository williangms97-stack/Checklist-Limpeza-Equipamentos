# Arquitetura

HTML + JavaScript puro, sem build. Mesmo desenho do sistema de Fotos TSI.

## Camadas

```
js/ui/         Telas. Montam HTML, tratam toques e chamam os serviços.
   │
js/servicos/   Regras de negócio. Validam, decidem e descrevem o que gravar.
   │
CKL.repo       Repositório. Única porta de entrada dos dados.
   │
js/core/db.js  IndexedDB do aparelho.
```

As telas não acessam o banco. Permissões são conferidas nos serviços (`CKL.auth.exigirAdm()`),
não só escondidas na tela.

## Repositório

```
repo.<colecao>.listar() · obter(chave) · porIndice(i, v) · umPorIndice(i, v) · contar()
repo.<colecao>.salvar(obj) · inserir(obj) · remover(chave)
repo.lote(ops)       -> tudo ou nada; com Supabase, vai antes ao servidor (operações do ADM)
repo.loteLocal(ops)  -> sempre no aparelho; usado no preenchimento (o envio é pela fila)
```

## Dados

| Coleção | Chave | Conteúdo |
|---|---|---|
| `modelos` | `id` (`ubs-05`, `secador-basica-09`…) | Modelo vigente: área, cabeçalho do documento, orientação, termo, itens (`ordem`, `texto`, `secao`, `ativo`) |
| `modelosVersoes` | `"<id>@<versão>"` | Cópia congelada de cada versão |
| `execucoes` | `id` | Checklist preenchido: cópia do modelo usado, cultivares, responsável, operador do ponto e assinatura, `respostas[itemId]` (avaliação, data/hora, descrição, observação, plano, reavaliações, fotos), termo, status, resultado, correções |
| `fotos` | `id` | JPEG (até 1600 px), miniatura, item e contexto (avaliação/reavaliação) |
| `naoConformidades` | `"<execução>:<item>"` | Uma por item NC: descrição, reavaliações, plano de ação, situação (aberta/encerrada) e encerramento |
| `historico` | `id` | Eventos de auditoria (nunca alterados) |
| `filaSincronizacao` | `id` (único por execução) | O que falta enviar ao servidor |
| `usuarios` | `id` | Só no modo demonstrativo (sem servidor) |
| `cultivares` | `id` | Cadastro de cultivares: `nome`, `ativa`, quem criou/alterou (banco local versão 2; servidor `ckl_cultivares`, `supabase/02_cultivares.sql`) |

## Onde está cada regra

| Regra | Arquivo |
|---|---|
| Os 16 checklists originais | `js/dados/modelos-originais.js` (gerado — não editar) |
| Versões dos modelos | `js/servicos/modelos.js` |
| Preenchimento, pendências, envio, correção | `js/servicos/execucoes.js` |
| Não conformidades e plano de ação | `js/servicos/nao-conformidades.js` |
| Fila de envio | `js/servicos/sincronizacao.js` |
| Supabase (login, baixar novidades, enviar) | `js/servicos/nuvem.js` |
| Relatório PDF | `js/servicos/pdf.js` |
| Excel | `js/servicos/excel.js` |
| Aplicativo do celular | `js/ui/operador.js`, `js/ui/assinatura.js` |
| Painel | `js/ui/adm/*.js` |

As gravações do preenchimento passam por uma fila interna (`emOrdem` em `execucoes.js`): uma de cada
vez, na ordem dos toques, para um texto sendo salvo nunca ser perdido por um toque logo em seguida.

## Servidor central (Supabase)

Ligado quando `js/core/servidor.js` tem URL e chave pública. Instalação: `supabase/LEIA-ME.md`.

| Peça | Sem servidor | Com Supabase |
|---|---|---|
| `CKL.repo` | IndexedDB | Lê do IndexedDB; `lote()` do ADM vai antes ao servidor (`ckl_lote`) |
| `CKL.auth` | usuário e senha no navegador (demonstrativo) | Supabase Auth (`usuario@ckl.doismarcos.com.br`) + `ckl_perfis` |
| Usuários | coleção local | Edge Function `ckl-usuarios` |
| Fila | sem adaptador: nada é enviado ("Só neste aparelho") | fotos para o Storage + `ckl_enviar_execucao` |

- O checklist é enviado também **em andamento** (o painel acompanha). O servidor aceita
  atualizações só enquanto estiver em andamento e só do mesmo usuário; depois do envio final,
  só o ADM altera.
- Não conformidades nascem no envio final; o servidor nunca sobrescreve uma NC existente.
- Novidades: `ckl_puxar` por coleção (data de atualização + id, 500 por página). Operador recebe
  modelos e só os próprios checklists, fotos e NCs. Roda ao entrar, ao voltar a conexão, ao voltar
  à aba e a cada minuto.
- Checklist com alteração ainda não enviada neste aparelho não é sobrescrito pelo que vem do servidor.

## PWA e atualização

`sw.js` guarda os arquivos no aparelho. Ao publicar, aumente `VERSAO` em `sw.js` e em
`js/core/config.js` (mesmo número). Os dados (IndexedDB) não são afetados.

## Evolução do banco local

Aumente `BANCO.VERSAO` em `js/core/config.js` e acrescente um bloco `if (versaoAnterior < N)` em
`js/core/db.js`. Blocos antigos não devem ser alterados.
