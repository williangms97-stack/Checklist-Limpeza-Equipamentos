/* ==========================================================================
   Formulários de limpeza de veículos — textos originais das planilhas
   --------------------------------------------------------------------------
   Fonte: "03-CONFERENCIA DE VEICULOS LIMPEZA DE CAÇAMBA.xlsx" (aba Planilha2) e
   "AUTORIZAÇÃO PARA NÃO REALIZAR LIMPEZA DE CAÇAMBA.xlsx" (aba Registro).
   Texto copiado exatamente como está nos documentos (ver docs/ANALISE-VEICULOS.md).
   Os documentos não têm versão nem data de aprovação (decisão V9). O administrador pode
   mudar o quadro de identificação no painel (js/servicos/documentos-veiculo.js).
   ========================================================================== */
(function (global) {
  'use strict';
  var CKL = global.CKL = global.CKL || {};

  var comum = {
    cabecalho: 'REGISTRO DE CONTROLE DE QUALIDADE',
    pagina: '1 / 1',
    elaboradoPor: 'Eloisa Silva',
    revisadoPor: 'Kizia Poliana',
    aprovadoPor: 'Willian Gomes'
  };

  CKL.formulariosVeiculos = {
    conferencia: Object.assign({}, comum, {
      tipo: 'conferencia',
      nome: 'Conferência de descarga do veículo',
      titulo: 'CONFERÊNCIA DE DESCARGA DO VEÍCULO',
      identificacao: 'Limpeza De Veiculos',
      origem: { arquivo: '03-CONFERENCIA DE VEICULOS LIMPEZA DE CAÇAMBA.xlsx', aba: 'Planilha2' },
      nota: 'Nota: Em casos de veículos vindos da Bunge não é necessário o fechamento de peso.',
      orientacao: 'Esse Check List deverá ser feito em todos os veículos que forem realizar o processo de limpeza de caçamba. É de responsabilidade do controle de Qualidade a identificação do veículo e o preenchimento deste documento. Caso o veículo não tenha efetuado a descarga por completo deverá ser feito a limpeza ou direcionamento do veículo para os pontos de grão comercial  e logo após a limpeza ou descarga por completo o veículo deverá ser PESADO NOVAMENTE.',
      rotulos: {
        dataHora: 'Data / Hora',
        turno: 'Turno',
        placa: 'Placa',
        origem: 'Origem do Veículo',
        identificacaoRetirada: 'Foi retirado a identificação de caçamba?',
        descarregadoCompleto: 'O veículo foi descarregado por completo?',
        grupoPeso: 'Descarga na Dois Marcos',
        fechouPeso: 'O veículo fechou o peso?',
        responsavel: 'Responsável pela Abordagem',
        observacao: 'Observação'
      },
      turnos: [{ valor: 'diurno', rotulo: 'Diurno' }, { valor: 'noturno', rotulo: 'Noturno' }],
      origens: [{ valor: 'CAMPO', rotulo: 'CAMPO' }, { valor: 'BUNGE', rotulo: 'BUNGE' }, { valor: 'TRANS.', rotulo: 'TRANS.' }]
    }),

    autorizacao: Object.assign({}, comum, {
      tipo: 'autorizacao',
      nome: 'Autorização de liberação sem vistoria',
      titulo: 'AUTORIZAÇÃO DE LIBERAÇÃO DE VEÍCULO SEM VISTORIA DE LIMPEZA NA CAÇAMBA',
      identificacao: 'Limpeza de Caçamba',
      origem: { arquivo: 'AUTORIZAÇÃO PARA NÃO REALIZAR LIMPEZA DE CAÇAMBA.xlsx', aba: 'Registro' },
      rotulos: {
        dataHora: 'Data/ Hora',
        placa: 'Placa',
        motorista: 'Nome do motorista',
        cultivarAnterior: 'Cultivar anterior',
        motivo: 'Motivo da autorização de veículo sem vistoria de limpeza',
        assinatura: 'Assinatura do responsável'
      }
    })
  };
})(window);
