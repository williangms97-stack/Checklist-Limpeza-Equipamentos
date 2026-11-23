# Checklist de Limpeza de Equipamentos — Dois Marcos Sementes

Sistema para registrar, acompanhar e comprovar a limpeza dos equipamentos das **UBS** e dos
**secadores**, a partir dos 16 checklists originais da Qualidade (CKL UBS e CKL Secador).

- **Aplicativo do celular** (`index.html`): quem faz a vistoria escolhe a área (UBS ou Secador), o
  checklist, informa as cultivares e marca cada item como **C**, **NC** ou **Equipamento não
  solicitado**. Item NC: descrição, até 3 reavaliações, plano de ação e fotos. No fim: termo
  Liberada / Não Liberada (UBS), nome e assinatura do operador do ponto, e envio.
- **Painel do computador** (`painel.html`, só administrador): acompanhamento (iniciados, concluídos,
  pendentes, com NC, % de conclusão, situação por UBS e secador), filtros, consulta dos checklists,
  relatório PDF, exportação Excel, não conformidades e planos de ação, modelos (com versões),
  usuários e histórico de alterações.

Funciona sem internet (dados no aparelho, IndexedDB). O envio ao banco central (Supabase) é
ligado preenchendo `js/core/servidor.js` — ver [supabase/LEIA-ME.md](supabase/LEIA-ME.md).

## Abrir no computador (teste local)

Não precisa instalar nada. Na pasta do projeto, no PowerShell:

```powershell
.\ferramentas\servidor-local.ps1
```

Depois abra <http://localhost:8080/> (aplicativo) ou <http://localhost:8080/painel.html> (painel).
Sem servidor central, o sistema entra com os acessos de demonstração mostrados na tela de entrada
(`admin` / `admin123` e `inspetor` / `ckl123`) — troque as senhas em **Usuários**.

> Os dados de teste ficam só no navegador onde foram feitos.

## Publicado (GitHub Pages)

- Aplicativo: `https://williangms97-stack.github.io/Checklist-Limpeza-Equipamentos/`
- Painel: `https://williangms97-stack.github.io/Checklist-Limpeza-Equipamentos/painel.html`

No celular, abra o endereço do aplicativo e use "Adicionar à tela inicial".

## Documentos

| Arquivo | Conteúdo |
|---|---|
| [docs/ANALISE-DOS-CHECKLISTS.md](docs/ANALISE-DOS-CHECKLISTS.md) | Etapas 1 e 2: os 16 checklists item por item, comparação e decisões validadas |
| [docs/CONTEXTO-DO-PROJETO.md](docs/CONTEXTO-DO-PROJETO.md) | Regras de negócio do sistema |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Como o código está organizado e onde está cada regra |
| [supabase/LEIA-ME.md](supabase/LEIA-ME.md) | Passo a passo para ligar o banco central |

## Origem dos checklists

`js/dados/modelos-originais.js` foi gerado das planilhas por `ferramentas/extrair-planilha.ps1` e
`ferramentas/gerar-modelos.ps1` (texto visível de cada aba, sem alterações). As planilhas
(`*.xlsx`) não ficam no repositório.
