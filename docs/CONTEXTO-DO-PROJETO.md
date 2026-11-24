# Contexto do projeto — regras de negócio

Decisões validadas com o usuário em 23/11/2026 (detalhes em `ANALISE-DOS-CHECKLISTS.md`).

## Estrutura

- **Área → checklist.** Áreas: UBS (01, 03, 04, 05, 06) e Secador (01 a 08, Básica 09, 10, 11).
  Nenhum equipamento é compartilhado entre checklists; cada um mantém nome, código, versão e itens
  do documento original.
- **Fidelidade ao documento.** Texto dos itens exatamente como na planilha (inclusive grafia:
  "Elavador", "Desnsimétricas", "QUIPAMENTOS", "Observções"). Textos antigos escondidos atrás de
  células mescladas não foram usados. Única adaptação: UBS 03 itens 17 e 18 tinham quebra de linha
  ("1 - 2 / 316"), lidos como "Caixa Mesa Densimétrica 1 - 2 - 316" e "... 3 - 4 - 317" (confirmado).
- **Nomes repetidos** (Secador 05 e 08, "Elevador" duas vezes) aparecem sempre com o número:
  "Item 2 — Elevador", "Item 6 — Elevador".
- **TSI (CKL 17, 18 e 19)** fica para depois.

## Preenchimento

- Cada item: **C**, **NC** ou **Equipamento não solicitado** (não conta como C nem NC). Data e hora
  automáticas.
- **Item NC:** descrição obrigatória; até **3 reavaliações** (C/NC + data/hora). Quando uma
  reavaliação dá C, o equipamento foi liberado naquela rodada (o sistema mostra "liberado na 2ª").
- **Plano de ação, um por item NC** (O que será feito? · Como? · Quem? · Data prevista de conclusão).
  Obrigatório — "O que", "Quem" e "Data prevista" — enquanto o equipamento não for liberado na
  reavaliação; opcional se foi liberado. ("Como?" sempre opcional.)
- **Fotos** sempre opcionais, ligadas ao item (câmera ou galeria).
- **Cultivar anterior e próxima cultivar** obrigatórias para enviar, escolhidas na lista do **cadastro
  de cultivares** (painel → Cultivares; só o administrador inclui, renomeia, ativa e desativa, com
  histórico). O checklist guarda o nome escolhido: renomear ou desativar depois não muda o que já
  foi feito. Lista inicial (66 cultivares, texto exato recebido em 24/11/2026):
  `js/dados/cultivares-iniciais.js`. Sem nenhuma cultivar cadastrada, o campo vira texto livre.
- **Termo de conclusão** (Liberada / Não Liberada) só nas UBS, obrigatório. "Liberada" fica
  bloqueada se algum equipamento terminou NC.
- **Assinaturas:** quem entra no aplicativo é o responsável pela vistoria (equipe de controle de
  qualidade). Do operador do ponto: nome obrigatório e assinatura na tela (opcional).
- Não envia enquanto houver pendência; a tela lista cada uma com atalho para o campo.

## Situação e rastreabilidade

- Status: Não iniciado · Em andamento · Concluído · Concluído com não conformidades · Descartado
  (iniciado por engano, com motivo).
- Cada checklist guarda: local, checklist, identificação, versão do documento e do modelo (cópia
  congelada do modelo), data, início, conclusão, responsável, operador do ponto, status, resultado.
- **Depois de enviado, o operador não altera.** Correção só pelo administrador, com motivo
  obrigatório; cada campo alterado vai para o histórico (valor anterior → novo).
- **Não conformidade não se encerra sozinha** (nem ao concluir o checklist, nem ao liberar na
  reavaliação). Só o administrador encerra, com comentário; pode reabrir com motivo.
- **"Previstos"**: sem regra de frequência por enquanto. O checklist é aberto manualmente a cada troca
  de cultivar. O painel mostra iniciados, concluídos, pendentes (em andamento), com NC e % de
  conclusão (concluídos ÷ iniciados).

## Modelos

- Alterar um modelo (cabeçalho, itens, ordem, seção, ativar/desativar item, termo) cria uma **nova
  versão**; as anteriores ficam guardadas. Itens nunca são apagados, só desativados.
- Novo checklist (novo secador, nova UBS ou nova área) pelo painel.
- Checklist desativado some do aplicativo; os já feitos continuam.

## Perfis

- **Operador:** faz e envia checklists pelo celular; vê só os próprios.
- **Administrador:** tudo do operador + painel, correções, NC, modelos, usuários e histórico.

## Banco central

Supabase da conta corporativa, em projeto próprio (separado do TSI), tudo com prefixo `ckl_`, bucket
`ckl-fotos`, login `usuario@ckl.doismarcos.com.br`. Repositório público no GitHub, publicado no
GitHub Pages. Sem `servidor.js` preenchido, nada é enviado e nada aparece como sincronizado.
