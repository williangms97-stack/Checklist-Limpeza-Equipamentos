# Análise — Limpeza de veículos (caçamba)

Etapa 1 (análise) dos dois documentos enviados em 24/11/2026. Textos copiados exatamente como estão
nas planilhas (grafia original mantida). Nada foi programado ainda.

| Arquivo | Aba(s) | Título | Identificação |
|---|---|---|---|
| `03-CONFERENCIA DE VEICULOS LIMPEZA DE CAÇAMBA.xlsx` | Planilha1, Planilha2 | CONFERÊNCIA DE DESCARGA DO VEÍCULO | Limpeza De Veiculos |
| `AUTORIZAÇÃO PARA NÃO REALIZAR LIMPEZA DE CAÇAMBA.xlsx` | Registro | AUTORIZAÇÃO DE LIBERAÇÃO DE VEÍCULO SEM VISTORIA DE LIMPEZA NA CAÇAMBA | Limpeza de Caçamba |

Cabeçalho comum aos dois: "REGISTRO DE CONTROLE DE QUALIDADE", Página "1 / 1", Elaborado por
**Eloisa Silva**, Revisado por **Kizia Poliana**, Aprovado por **Willian Gomes**. Nenhum dos dois tem
número de versão nem data de aprovação (os checklists das UBS e secadores têm). Logotipo: o mesmo
da Dois Marcos já usado no sistema (o das planilhas é uma cópia menor).

**Diferença principal para os checklists de equipamentos:** aqui não há lista de itens C / NC. Cada
linha da planilha é **um veículo** — um registro curto e completo, preenchido de uma vez.

---

## 1. Conferência de descarga do veículo ("Limpeza De Veiculos")

Folha em paisagem, uma linha por veículo (Planilha1: 22 linhas; Planilha2: 12 linhas).

**Nota (texto original):**
> Nota: Em casos de veículos vindos da Bunge não é necessário o fechamento de peso.

**Orientação (texto original):**
> Esse Check List deverá ser feito em todos os veículos que forem realizar o processo de limpeza de
> caçamba. É de responsabilidade do controle de Qualidade a identificação do veículo e o preenchimento
> deste documento. Caso o veículo não tenha efetuado a descarga por completo deverá ser feito a limpeza
> ou direcionamento do veículo para os pontos de grão comercial  e logo após a limpeza ou descarga por
> completo o veículo deverá ser PESADO NOVAMENTE.

**Colunas (Planilha2, que traz as opções impressas):**

| Coluna | Opções na planilha | Proposta no aplicativo |
|---|---|---|
| Data / Hora | `____ / ____ / ____    ____ : ____` | automática |
| Turno | (  ) Diurno  (  ) Noturno | botões Diurno / Noturno |
| Placa | `___ - ___` | texto, em maiúsculas |
| Origem do Veículo | (   ) CAMPO   (   ) BUNGE   (   ) TRANS. | botões CAMPO / BUNGE / TRANS. |
| Foi retirado a identificação de caçamba? | (   ) SIM   (   ) NÃO | botões SIM / NÃO |
| O veículo foi descarregado por completo? | (   ) SIM   (   ) NÃO | botões SIM / NÃO |
| Descarga na Dois Marcos — O veículo fechou o peso? | (   ) SIM   (   ) NÃO | botões SIM / NÃO (ver V3: Bunge) |
| Responsável pela Abordagem | `__________________` | quem está logado (ver V5) |
| Observação | (em branco) | texto opcional |

A Planilha1 tem as mesmas colunas, com "Data" e "Hora" separadas e sem as opções impressas nas
linhas (só o Turno). As duas abas parecem ser versões do mesmo formulário (ver V1).

## 2. Autorização de liberação de veículo sem vistoria de limpeza na caçamba ("Limpeza de Caçamba")

Uma linha por veículo (14 linhas), sem nota nem orientação.

| Coluna | Na planilha | Proposta no aplicativo |
|---|---|---|
| Data/ Hora | `_____/ _____/ _____ ____:____` | automática |
| Placa | `______-_______` | texto, em maiúsculas |
| Nome do motorista | linha em branco | texto obrigatório |
| Cultivar anterior | linha em branco | lista do **cadastro de cultivares** (o mesmo dos checklists) |
| Motivo da autorização de veículo sem vistoria de limpeza | linha em branco | texto obrigatório (ver V7) |
| Assinatura do responsável | linha em branco | assinatura na tela (ver V6) |

---

## 3. Proposta de organização

**Entrada do aplicativo (pedido do usuário):** depois do login, a primeira tela pergunta o que vai ser
feito, com três botões grandes — **UBS**, **Secador** e **Limpeza de veículo** — para o operador e para
o administrador. Abaixo deles continuam os checklists em andamento e os enviados.

- **UBS / Secador:** seguem como hoje (escolher o checklist → cultivares → itens).
- **Limpeza de veículo:** duas opções:
  1. **Conferência de descarga do veículo** — formulário de uma tela, um veículo por registro;
  2. **Autorização de liberação sem vistoria de limpeza** — idem.

**Regras iguais às dos checklists:** data/hora e responsável automáticos; funciona sem internet e envia
quando a conexão volta; depois de enviado o operador não altera; correção só pelo administrador, com
motivo e histórico; PDF e Excel.

**Painel:** nova tela **Veículos** com as conferências e autorizações, filtros (período, placa, origem,
turno, responsável), indicadores (veículos conferidos, autorizações sem vistoria, descargas
incompletas, sem fechamento de peso, identificação não retirada) e relatórios.

---

## 4. Dúvidas para validar (Etapa 2)

- **V1.** A conferência tem duas abas com o mesmo formulário. Uso a **Planilha2** (Data/Hora juntas,
  opções impressas) como a versão vigente?
- **V2.** Turno: o usuário marca Diurno/Noturno, ou o sistema já sugere pela hora? Se sugerir, qual o
  horário de troca de turno?
- **V3.** Origem **BUNGE**: a nota diz que não é necessário o fechamento de peso. A pergunta "O veículo
  fechou o peso?" vira "Não se aplica (Bunge)" automaticamente, ou continua SIM/NÃO opcional?
- **V4.** Resposta **NÃO** (identificação não retirada, descarga incompleta, peso não fechado): só fica
  registrada e destacada no painel, ou abre não conformidade com plano de ação como nos equipamentos?
  Sugestão: destaque no painel e **observação obrigatória** quando houver NÃO, sem plano de ação.
- **V5.** "Responsável pela Abordagem" é sempre quem está logado (automático)?
- **V6.** Autorização: quem assina como "responsável" — o próprio usuário logado (assina na tela) ou
  outra pessoa que autorizou (informa o nome e assina)? Assinatura obrigatória?
- **V7.** Motivo da autorização: texto livre, ou uma lista de motivos padrão + "Outro"?
- **V8.** Fotos (placa, caçamba): opcionais, como nos checklists, ou não usar?
- **V9.** Os documentos não têm versão nem data de aprovação. Mostro só o que está neles (sem versão),
  ou você informa?
- **V10.** Relatório PDF: por **período**, no mesmo formato da planilha (uma linha por veículo, folha
  deitada), além do PDF de cada registro? Excel com uma aba por formulário.
- **V11.** Placa: aceitar o formato antigo (ABC-1234) e o Mercosul (ABC1D23), conferindo o formato?

---

## 5. Decisões validadas (24/11/2026)

| Nº | Decisão |
|---|---|
| Entrada | Depois do login, a primeira tela pergunta: **UBS**, **Secador** ou **Limpeza de veículo** (operador e administrador). |
| V1 | Conferência segue a **Planilha2** (Data/Hora juntas, opções impressas). |
| V2 | Turno **sugerido pela hora**: Diurno das 07:00 às 18:59; Noturno das 19:00 às 06:59. O usuário pode trocar. |
| V3 | Origem **BUNGE**: "O veículo fechou o peso?" vira **"Não se aplica (Bunge)"** automaticamente. |
| V4 | Resposta **NÃO**: fica destacada no painel e a **observação passa a ser obrigatória**; não abre não conformidade. |
| V5 | "Responsável pela Abordagem" = **usuário logado** (automático). |
| V6 | Autorização: o **próprio usuário logado** é o responsável e **assina na tela**; assinatura **obrigatória**. |
| V7 | Motivo: **texto livre**, com opção de escolher um **motivo do cadastro** (painel → Motivos de autorização). |
| V8 | Fotos **opcionais**. |
| V9 | Sem versão nem data de aprovação por enquanto (mostra só o que está no documento). |
| V10 | PDF **por período** no formato da planilha (folha deitada, um veículo por linha) **e** PDF de cada registro. |
| V11 | Placa: aceita o formato antigo (ABC-1234) e o Mercosul (ABC1D23); fora disso, **avisa** que pode estar incorreta, sem bloquear. |
