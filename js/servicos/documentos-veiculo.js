/* ==========================================================================
   Cabeçalho das fichas de limpeza de veículo (editável pelo administrador)
   --------------------------------------------------------------------------
   Os textos das fichas ficam em js/dados/formularios-veiculos.js. Aqui ficam só
   os dados do quadro de identificação que mudam com o tempo: identificação,
   versão, página, elaborado/revisado/aprovado por e data de aprovação.
   - Um registro por ficha (id = 'conferencia' | 'autorizacao') na coleção
     documentosVeiculo. Sem registro, vale o que está no arquivo de dados.
   - Cada registro de veículo guarda uma cópia do cabeçalho do dia em que foi
     feito (veiculos.iniciar), então mudar aqui não altera o que já foi feito.
   - Toda alteração pede motivo e fica no Histórico.
   ========================================================================== */
(function (global) {
  'use strict';
  var CKL = global.CKL;
  var util = CKL.util;
  var repo = function () { return CKL.repo; };
  var Erro = function (m) { return CKL.auth.Erro(m); };
  var H = function () { return CKL.historico; };
  var F = function () { return CKL.formulariosVeiculos; };

  var TIPOS = ['conferencia', 'autorizacao'];
  var CAMPOS = {
    identificacao: 'Identificação', versaoDocumento: 'Versão', pagina: 'Página', elaboradoPor: 'Elaborado por',
    revisadoPor: 'Revisado por', aprovadoPor: 'Aprovado por', aprovadoEm: 'Aprovado em'
  };
  var EVENTO = 'documentosVeiculo:alterado';      // dados novos no aparelho (sincronia)
  var APLICADO = 'documentosVeiculo:aplicado';    // fichas já atualizadas (as telas redesenham)

  /* valores do arquivo de dados, guardados antes de qualquer alteração */
  var ORIGINAIS = {};
  TIPOS.forEach(function (t) {
    ORIGINAIS[t] = {};
    Object.keys(CAMPOS).forEach(function (c) { ORIGINAIS[t][c] = F()[t][c] || ''; });
  });

  var registros = {};   // último registro lido de cada ficha
  var ouvindo = false;

  function aplicar(lista) {
    registros = {};
    (lista || []).forEach(function (r) { if (TIPOS.indexOf(r.id) >= 0) registros[r.id] = r; });
    TIPOS.forEach(function (t) {
      Object.assign(F()[t], ORIGINAIS[t], (registros[t] && registros[t].campos) || {});
      F()[t].versaoCabecalho = registros[t] ? registros[t].versao : 0;
    });
  }

  function erroAmigavel(e) {
    var msg = (e && e.message) || '';
    if (/Coleção inválida/i.test(msg)) {
      var er = Erro('O servidor ainda não guarda o cabeçalho das fichas de veículo. Rode o arquivo supabase/04_documentos_veiculo.sql no SQL Editor do Supabase e tente de novo.');
      return er;
    }
    return e;
  }

  var documentosVeiculo = {
    TIPOS: TIPOS,
    CAMPOS: CAMPOS,
    EVENTO: EVENTO,
    APLICADO: APLICADO,

    /** Lê os cabeçalhos guardados e aplica nas fichas (chamado ao abrir o sistema e a cada mudança). */
    carregar: function () {
      if (!ouvindo && CKL.eventos) { ouvindo = true; CKL.eventos.ouvir(EVENTO, function () { documentosVeiculo.carregar(); }); }
      if (!repo() || !repo().documentosVeiculo) return Promise.resolve();
      return repo().documentosVeiculo.listar().then(function (l) { aplicar(l); CKL.eventos.emitir(APLICADO); }).catch(function (e) {
        console.warn('[documentosVeiculo] cabeçalho não carregado:', e && e.message);
      });
    },

    /** Cabeçalho vigente de uma ficha. */
    atual: function (tipo) {
      var f = F()[tipo], r = registros[tipo], d = {};
      Object.keys(CAMPOS).forEach(function (c) { d[c] = f[c] || ''; });
      d.versao = r ? r.versao : 0;
      d.atualizadoEm = r ? r.atualizadoEm : null;
      d.atualizadoPor = r ? r.atualizadoPor : null;
      return d;
    },

    /** Administrador: grava o cabeçalho de uma ficha. Devolve false se nada mudou. */
    salvar: function (tipo, dados, motivo) {
      var adm = CKL.auth.exigirAdm();
      if (TIPOS.indexOf(tipo) < 0) return Promise.reject(Erro('Ficha inválida.'));
      motivo = util.limpar(motivo);
      return repo().documentosVeiculo.obter(tipo).then(function (salvo) {
        var antes = documentosVeiculo.atual(tipo), campos = {}, evs = [];
        Object.keys(CAMPOS).forEach(function (c) {
          var v = dados[c] === undefined ? antes[c] : (c === 'aprovadoEm' ? (util.textoParaData(dados[c]) || util.limpar(dados[c])) : util.limpar(dados[c]));
          campos[c] = v;
          if (String(antes[c] || '') !== String(v || '')) {
            var fmt = function (x) { return !x ? null : c === 'aprovadoEm' ? util.fmtData(x) : x; };
            evs.push(H().evento({ entidade: 'documentoVeiculo', entidadeId: tipo, rotulo: F()[tipo].nome, acao: 'edicao',
              campo: CAMPOS[c], valorAnterior: fmt(antes[c]) || null, valorNovo: fmt(v) || null, motivo: motivo }));
          }
        });
        if (!evs.length) return false;
        if (!campos.identificacao) throw Erro('Informe a identificação.');
        if (motivo.length < 5) throw Erro('Informe o motivo da alteração (mínimo de 5 caracteres).');
        var agora = util.agora();
        var r = { id: tipo, tipo: tipo, campos: campos, versao: ((salvo && salvo.versao) || 0) + 1, atualizadoEm: agora, atualizadoPor: adm.nome };
        return repo().lote([{ colecao: 'documentosVeiculo', tipo: 'salvar', valor: r }].concat(H().operacoes(evs)))
          .then(function () { return documentosVeiculo.carregar(); })
          .then(function () { return true; });
      }).catch(function (e) { throw erroAmigavel(e); });
    }
  };

  CKL.documentosVeiculo = documentosVeiculo;
})(window);
