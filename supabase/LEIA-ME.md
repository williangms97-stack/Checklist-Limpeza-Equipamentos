# Ligar o sistema ao Supabase

Passo a passo para colocar o banco central no ar. É feito uma vez só. Depois disso, o que for
preenchido nos celulares aparece no painel do computador.

O sistema tem um **projeto próprio no Supabase**, na conta corporativa, separado do projeto do
sistema de Fotos TSI: banco, fotos e usuários de um não se misturam com os do outro.

| Arquivo | Para quê |
|---|---|
| `01_estrutura.sql` | Tabelas, regras de acesso, funções e o local das fotografias |
| `02_cultivares.sql` | Cadastro de cultivares (rodar depois do 01) |
| `03_veiculos.sql` | Limpeza de veículos e motivos de autorização (rodar depois do 02) |
| `04_documentos_veiculo.sql` | Cabeçalho editável das fichas de veículo (rodar depois do 03) |
| `functions/ckl-usuarios/index.ts` | Função que cria usuários e redefine senhas a partir do painel |

## 1. Criar o projeto

Supabase (conta corporativa) → **New project**:

- **Name:** `Checklist Limpeza` (ou outro nome que identifique)
- **Database Password:** gere uma senha forte e guarde (não é usada pelo sistema, só pelo Supabase)
- **Region:** South America (São Paulo)

Espere o projeto terminar de ser criado (1 a 2 minutos).

## 2. Desligar o cadastro livre

Authentication → **Sign In / Providers** → desligue **Allow new users to sign up** → **Save**.

Assim ninguém cria conta sozinho: os usuários só são criados pelo painel do sistema.

## 3. Criar as tabelas

**SQL Editor** → **New query** → cole o conteúdo inteiro de `01_estrutura.sql` → **Run**. Depois, numa
query nova, faça o mesmo com `02_cultivares.sql`, depois com `03_veiculos.sql` e depois com `04_documentos_veiculo.sql`. Antes de rodar, confira a primeira linha: o
título tem de ser o do Checklist de Limpeza (nunca rode aqui o SQL de outro sistema).

Deve terminar com "Success. No rows returned". Pode ser executado de novo sem perder dados.

## 4. Publicar a função de usuários

**Edge Functions** → **Deploy a new function** → **Via Editor**:

1. Nome da função: `ckl-usuarios` (exatamente assim).
2. Apague o código de exemplo e cole o conteúdo inteiro de `functions/ckl-usuarios/index.ts`.
3. Clique em **Deploy function**. Em **Details**, desligue **Verify JWT** (a função já confere o usuário).

## 5. Criar o primeiro administrador

**Authentication** → **Users** → **Add user** → **Create new user**:

- **Email:** `admin@ckl.doismarcos.com.br` (exatamente este)
- **Password:** uma senha forte
- marque **Auto Confirm User**

Ele vira Administrador do checklist automaticamente. No sistema, entra com o usuário **admin**.
Os demais usuários são criados pelo painel, em **Usuários**.

> O domínio `ckl.doismarcos.com.br` é só um identificador interno (ninguém recebe e-mail).

## 6. Informar o endereço do banco ao sistema

**Project Settings** → **API Keys**. Copie a **Project URL** e a chave **publishable**
(`sb_publishable_...`). Elas podem ser passadas ao Claude, que preenche `js/core/servidor.js`,
ou preenchidas direto no GitHub (abra o arquivo e clique no lápis):

```js
URL: 'https://xxxxxxxx.supabase.co',
CHAVE_PUBLICA: 'sb_publishable_...',
```

**Nunca** coloque nesse arquivo (nem mande para ninguém) a chave **secret** / **service_role**
nem a senha do banco.

## 7. Primeiro uso

1. Abra o **painel** (`.../painel.html`) e entre com `admin`.
2. Na tela **Acompanhamento** (ou **Modelos de checklist**), clique em **Carregar os checklists
   originais**: os 16 checklists vão para o servidor.
3. **Cultivares**: clique em **Cadastrar 66 cultivares** (lista inicial da empresa).
4. **Motivos de autorização** (opcional): cadastre os motivos mais usados para liberar veículo sem vistoria.
5. **Usuários**: crie a equipe (perfil Operador para quem só faz checklist).
6. No celular, abra o **aplicativo** e entre. O primeiro acesso em cada celular precisa de internet;
   depois funciona sem conexão e envia quando a internet volta.

Os checklists de teste feitos antes, sem servidor, ficam só no navegador onde foram feitos.

## Se algo der errado

| Sintoma | O que conferir |
|---|---|
| "Este usuário não tem acesso ao sistema de checklist" | O passo 3 foi executado antes de criar o usuário? Se não, rode o SQL e crie o usuário de novo |
| admin entra como inativo | O e-mail é exatamente `admin@ckl.doismarcos.com.br`? |
| "Não foi possível falar com a função ckl-usuarios" | A função foi publicada com esse nome? Veja Edge Functions → ckl-usuarios → Logs |
| Tela Cultivares diz que o servidor não tem o cadastro | Rode o `02_cultivares.sql` |
| Registro de veículo fica "Falha no envio" ou a tela Motivos diz que o servidor não tem o cadastro | Rode o `03_veiculos.sql` |
| Ao salvar o cabeçalho de uma ficha de veículo aparece "o servidor ainda não guarda o cabeçalho" | Rode o `04_documentos_veiculo.sql` |
| Fotos não sobem | O bucket `ckl-fotos` existe em Storage? (criado pelo passo 3) |
| Painel continua dizendo "Dados neste aparelho" | `servidor.js` foi salvo com URL e chave? Recarregue com Ctrl+F5 |
| Nada carrega e o painel do Supabase mostra o projeto "Paused" | No plano gratuito o projeto pausa após 7 dias sem uso. Clique em **Restore project**; os dados continuam lá |

## Espaço

Cada foto ocupa ~300 KB. O plano gratuito do Supabase tem, por projeto, 1 GB de arquivos e 500 MB
de banco — só para este sistema.
