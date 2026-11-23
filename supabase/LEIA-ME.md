# Ligar o sistema ao Supabase

Passo a passo para colocar o banco central no ar. É feito uma vez só. Depois disso, o que for
preenchido nos celulares aparece no painel do computador.

O sistema usa o **mesmo projeto do Supabase da conta corporativa** do sistema de Fotos TSI. Tudo
o que este arquivo cria começa com `ckl_` (e o bucket se chama `ckl-fotos`), então não mexe em
nada do TSI.

| Arquivo | Para quê |
|---|---|
| `01_estrutura.sql` | Tabelas, regras de acesso, funções e o local das fotografias |
| `functions/ckl-usuarios/index.ts` | Função que cria usuários e redefine senhas a partir do painel |

## 1. Criar as tabelas

Supabase → **SQL Editor** → **New query** → cole o conteúdo inteiro de `01_estrutura.sql` → **Run**.

Deve terminar com "Success. No rows returned". Pode ser executado de novo sem perder dados.

> O cadastro livre ("Allow new users to sign up") já foi desligado na instalação do TSI. Se não
> foi, desligue em Authentication → Sign In / Providers.

## 2. Publicar a função de usuários

Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**:

1. Nome da função: `ckl-usuarios` (exatamente assim).
2. Apague o código de exemplo e cole o conteúdo inteiro de `functions/ckl-usuarios/index.ts`.
3. Clique em **Deploy function**. Em **Details**, desligue **Verify JWT** (a função já confere o usuário).

## 3. Criar o primeiro administrador

Supabase → **Authentication** → **Users** → **Add user** → **Create new user**:

- **Email:** `admin@ckl.doismarcos.com.br` (exatamente este)
- **Password:** uma senha forte
- marque **Auto Confirm User**

Ele vira Administrador do checklist automaticamente. No sistema, entra com o usuário **admin**.
Os demais usuários são criados pelo painel, em **Usuários**.

> O domínio `ckl.doismarcos.com.br` é só um identificador interno (ninguém recebe e-mail). Ele é
> diferente do usado no TSI para os acessos dos dois sistemas não se misturarem. Usuários criados
> para um sistema aparecem como inativos no outro e não têm acesso a nada lá.

## 4. Informar o endereço do banco ao sistema

Supabase → **Project Settings** → **API Keys**. Copie a **Project URL** e a chave **publishable**
(a mesma usada no TSI). No GitHub, abra `js/core/servidor.js`, clique no lápis e preencha:

```js
URL: 'https://xxxxxxxx.supabase.co',
CHAVE_PUBLICA: 'sb_publishable_...',
```

**Nunca** coloque nesse arquivo a chave **secret** / **service_role**.

## 5. Primeiro uso

1. Abra o **painel** (`.../painel.html`) e entre com `admin`.
2. Na tela **Acompanhamento** (ou **Modelos de checklist**), clique em **Carregar os checklists
   originais**: os 16 checklists vão para o servidor.
3. **Usuários**: crie a equipe (perfil Operador para quem só faz checklist).
4. No celular, abra o **aplicativo** e entre. O primeiro acesso em cada celular precisa de internet;
   depois funciona sem conexão e envia quando a internet volta.

Os checklists de teste feitos antes, sem servidor, ficam só no navegador onde foram feitos.

## Se algo der errado

| Sintoma | O que conferir |
|---|---|
| "Este usuário não tem acesso ao sistema de checklist" | O passo 1 foi executado antes de criar o usuário? Se não, rode o SQL e crie o usuário de novo |
| admin entra como inativo | O e-mail é exatamente `admin@ckl.doismarcos.com.br`? |
| "Não foi possível falar com a função ckl-usuarios" | A função foi publicada com esse nome? Veja Edge Functions → ckl-usuarios → Logs |
| Fotos não sobem | O bucket `ckl-fotos` existe em Storage? (criado pelo passo 1) |
| Painel continua dizendo "Dados neste aparelho" | `servidor.js` foi salvo com URL e chave? Recarregue com Ctrl+F5 |

## Espaço

Cada foto ocupa ~300 KB. O plano gratuito do Supabase tem 1 GB de arquivos, dividido com o TSI.
