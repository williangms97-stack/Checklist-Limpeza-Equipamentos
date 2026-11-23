# Checklist de Limpeza de Equipamentos

Aplicativo do celular (`index.html`) + painel do administrador (`painel.html`) para os checklists de
limpeza das UBS e secadores. HTML + JavaScript puro, sem build. Publicado no GitHub Pages; banco
no Supabase da conta corporativa (projeto próprio, separado do TSI; prefixo `ckl_`).

**Leia `docs/CONTEXTO-DO-PROJETO.md`, `docs/ARQUITETURA.md` e `docs/ANALISE-DOS-CHECKLISTS.md`
antes de mudar regras.** Configuração do Supabase: `supabase/LEIA-ME.md`.

## Regras de trabalho

- **Fidelidade aos checklists originais é prioridade absoluta.** Não exclua, resuma, corrija a
  grafia nem invente itens sem autorização do usuário. `js/dados/modelos-originais.js` é gerado
  (`ferramentas/gerar-modelos.ps1`); mudanças de item depois da carga são feitas pelo painel
  (nova versão do modelo).
- Ao publicar mudança de arquivos do app, aumente `VERSAO` em `sw.js` e em `js/core/config.js`
  (mesmo número). Arquivo novo de JS/CSS: incluir em `index.html`, `painel.html` e na lista do `sw.js`.
- Mudança de banco = novo arquivo `supabase/0N_*.sql` que possa ser rodado de novo sem apagar dados.
  Tudo com prefixo `ckl_`; bucket `ckl-fotos`. O usuário roda o SQL no painel do Supabase.
- Em `servidor.js` só a chave pública (publishable/anon). Nunca a secret/service_role.
- Login: usuário vira `usuario@ckl.doismarcos.com.br` (`DOMINIO_LOGIN`).
- O app precisa continuar funcionando sem internet. Sem servidor configurado, não simular envio.
- Nunca versionar as planilhas (`.gitignore` bloqueia `*.xlsx`/`*.xls`). Repositório **público**.
- Textos em português, linguagem simples.
- Depois de cada alteração: commit (mensagem em português) e push para o GitHub.
