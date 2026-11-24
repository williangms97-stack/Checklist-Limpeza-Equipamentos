/* ==========================================================================
   Cadastros mantidos pelo administrador
   --------------------------------------------------------------------------
   - Cultivares: campos "Cultivar anterior" e "Próxima cultivar" dos checklists e
     da autorização de veículo. Lista inicial: js/dados/cultivares-iniciais.js.
   - Motivos de autorização: motivos padrão da autorização de liberação de veículo
     sem vistoria (o usuário também pode escrever um motivo livre).
   Regras comuns em js/servicos/cadastro-simples.js.
   ========================================================================== */
(function (global) {
  'use strict';
  var CKL = global.CKL;

  CKL.cultivares = CKL.criarCadastroSimples({
    colecao: 'cultivares', entidade: 'cultivar', evento: 'cultivares:alterado', tamanhoMaximo: 80,
    iniciais: function () { return CKL.cultivaresIniciais || []; },
    nomes: { item: 'cultivar', Item: 'Cultivar', feminino: true }
  });

  CKL.motivos = CKL.criarCadastroSimples({
    colecao: 'motivos', entidade: 'motivo', evento: 'motivos:alterado', tamanhoMaximo: 200,
    nomes: { item: 'motivo', Item: 'Motivo', feminino: false }
  });
})(window);
