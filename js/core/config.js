/* ==========================================================================
   Configurações gerais do sistema
   Tudo o que é parâmetro de negócio fica aqui, para ajuste sem tocar nas telas.
   ========================================================================== */
(function (global) {
  'use strict';
  var CKL = global.CKL = global.CKL || {};

  CKL.config = {
    VERSAO: '1.2.0',
    NOME_SISTEMA: 'Checklist de Limpeza de Equipamentos',
    NOME_CURTO: 'Checklist de Limpeza',
    EMPRESA: 'Dois Marcos Sementes',

    BANCO: { NOME: 'ckl-dois-marcos', VERSAO: 3 },

    PERFIS: { ADM: 'ADM', OPERADOR: 'OPERADOR' },
    ROTULO_PERFIL: { ADM: 'Administrador', OPERADOR: 'Operador' },

    /* Áreas na ordem em que aparecem no aplicativo (D1: Área → checklist) */
    AREAS: [
      { id: 'UBS', rotulo: 'UBS', descricao: 'Unidades de Beneficiamento de Sementes', icone: 'fabrica' },
      { id: 'Secador', rotulo: 'Secador', descricao: 'Secadores e secadores básicas', icone: 'secador' }
    ],

    /* Situação do checklist */
    STATUS: { NAO_INICIADO: 'nao_iniciado', EM_ANDAMENTO: 'em_andamento', CONCLUIDO: 'concluido', CONCLUIDO_NC: 'concluido_nc', DESCARTADO: 'descartado' },
    ROTULO_STATUS: {
      nao_iniciado: 'Não iniciado',
      em_andamento: 'Em andamento',
      concluido: 'Concluído',
      concluido_nc: 'Concluído com não conformidades',
      descartado: 'Descartado'
    },

    /* Resultado de cada item (D7: terceira opção "Equipamento não solicitado") */
    AVALIACOES: ['C', 'NC', 'NS'],
    ROTULO_AVALIACAO: { C: 'Conforme', NC: 'Não conforme', NS: 'Equipamento não solicitado' },
    SIGLA_AVALIACAO: { C: 'C', NC: 'NC', NS: 'Não solicitado' },
    MAX_REAVALIACOES: 3,                 // D4: até 3 reavaliações por item NC

    /* Termo de conclusão (D5: só nas UBS) */
    TERMO: { LIBERADA: 'liberada', NAO_LIBERADA: 'nao_liberada' },
    ROTULO_TERMO: { liberada: 'Liberada', nao_liberada: 'Não Liberada' },

    SITUACAO_NC: { ABERTA: 'aberta', ENCERRADA: 'encerrada' },

    SITUACAO_ENVIO: { LOCAL: 'local', AGUARDANDO: 'aguardando', SINCRONIZADO: 'sincronizado', FALHA: 'falha' },
    ROTULO_SITUACAO_ENVIO: {
      local: 'Só neste aparelho',
      aguardando: 'Aguardando envio',
      sincronizado: 'Sincronizado',
      falha: 'Falha no envio'
    },

    /* Acessos de demonstração (só quando NÃO há servidor central) */
    USUARIOS_INICIAIS: [
      { id: 'usuario-admin', nome: 'Administrador', usuario: 'admin', senha: 'admin123', perfil: 'ADM' },
      { id: 'usuario-operador', nome: 'Inspetor de Demonstração', usuario: 'inspetor', senha: 'ckl123', perfil: 'OPERADOR' }
    ],
    SENHA_MINIMA: 6,

    /* Fotografias dos equipamentos (D8: sempre opcionais) */
    FOTO: {
      LADO_MAXIMO: 1600,          // px do maior lado da imagem guardada (~300 KB por foto)
      QUALIDADE: 0.8,             // JPEG
      MIN_LADO_MAIOR: 480,        // abaixo disso a imagem é recusada
      MIN_LADO_MENOR: 360,
      MINIATURA: 360,
      MAX_POR_ITEM: 6,
      LUMINANCIA_MIN: 45,
      LUMINANCIA_MAX: 215,
      DESVIO_MIN: 4,
      NITIDEZ_MIN: 0.025
    },

    /* Assinatura do operador do local (D6) */
    ASSINATURA: { LARGURA: 900, ALTURA: 300 },

    TEXTO_MAXIMO: 600,             // caracteres das observações e descrições
    ITENS_POR_PAGINA: 50,

    /* Bibliotecas pesadas, carregadas só quando são usadas */
    BIBLIOTECAS: {
      planilha: ['vendor/xlsx.full.min.js'],
      pdf: ['vendor/jspdf.umd.min.js', 'js/servicos/pdf-fontes.js']
    }
  };
})(window);
