/* ==========================================================================
   Servidor central (Supabase)
   --------------------------------------------------------------------------
   Preencha URL e CHAVE_PUBLICA para ligar o sistema ao banco central.
   Em branco, o sistema funciona só com os dados do próprio aparelho
   (nada é enviado e nenhum envio é simulado).

   Passo a passo: supabase/LEIA-ME.md
   - URL: "Project URL", algo como https://abcdefghijkl.supabase.co
   - CHAVE_PUBLICA: a chave "publishable" (sb_publishable_...) ou a "anon public".
   Essas duas informações são públicas por natureza; a proteção dos dados está
   nas regras do banco (supabase/01_estrutura.sql).
   NUNCA coloque aqui a chave secreta ("secret" / "service_role").
   ========================================================================== */
(function (global) {
  'use strict';
  var CKL = global.CKL = global.CKL || {};

  CKL.servidor = {
    URL: '',
    CHAVE_PUBLICA: '',

    /* Quem entra com nome de usuário (ex.: "joao") é procurado no Supabase como
       joao@<DOMINIO_LOGIN>. */
    DOMINIO_LOGIN: 'ckl.doismarcos.com.br',

    /* De quanto em quanto tempo (segundos) o aparelho busca novidades no servidor */
    INTERVALO_SINCRONIA: 60,

    /* Nome da Edge Function de usuários e do bucket das fotografias */
    FUNCAO_USUARIOS: 'ckl-usuarios',
    BUCKET_FOTOS: 'ckl-fotos'
  };
})(window);
