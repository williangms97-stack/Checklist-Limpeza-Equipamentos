/* ==========================================================================
   Repositório — a única porta de entrada dos dados
   --------------------------------------------------------------------------
   As telas e as regras de negócio (js/servicos) só conversam com CKL.repo.
   Sem servidor, CKL.repo é o RepositorioLocal (IndexedDB do aparelho).
   Com Supabase, js/servicos/nuvem.js troca CKL.repo por um objeto com o mesmo
   contrato (ver docs/ARQUITETURA.md).

   CONTRATO (todos os métodos devolvem Promise):
     repo.<colecao>.listar() · obter(chave) · porIndice(indice, valor)
     repo.<colecao>.umPorIndice(indice, valor) · contar() · salvar(obj)
     repo.<colecao>.inserir(obj) (falha se a chave já existir) · remover(chave)
     repo.lote([{ colecao, tipo: 'salvar'|'inserir'|'remover', valor|chave }])  -> tudo ou nada

   COLEÇÕES: usuarios, modelos, modelosVersoes, execucoes, fotos,
             naoConformidades, historico, filaSincronizacao, cultivares
   ========================================================================== */
(function (global) {
  'use strict';
  var CKL = global.CKL;
  var db = CKL.db;

  /* nome usado pelos serviços -> nome da estrutura no IndexedDB */
  var COLECOES = {
    usuarios: 'usuarios',
    modelos: 'modelos',
    modelosVersoes: 'modelos_versoes',
    execucoes: 'execucoes',
    fotos: 'fotos',
    naoConformidades: 'nao_conformidades',
    historico: 'historico',
    filaSincronizacao: 'fila_sincronizacao',
    cultivares: 'cultivares'
  };

  function colecao(nome) {
    return {
      listar: function () { return db.ler(nome, function (s) { return s.getAll(); }); },
      obter: function (chave) { return db.ler(nome, function (s) { return s.get(chave); }); },
      porIndice: function (indice, valor) { return db.ler(nome, function (s) { return s.index(indice).getAll(valor); }); },
      umPorIndice: function (indice, valor) { return db.ler(nome, function (s) { return s.index(indice).get(valor); }); },
      contar: function () { return db.ler(nome, function (s) { return s.count(); }); },
      salvar: function (obj) { return db.transacao([nome], 'readwrite', function (st) { st(nome).put(obj); }); },
      inserir: function (obj) { return db.transacao([nome], 'readwrite', function (st) { st(nome).add(obj); }); },
      remover: function (chave) { return db.transacao([nome], 'readwrite', function (st) { st(nome).delete(chave); }); }
    };
  }

  var RepositorioLocal = { tipo: 'local', COLECOES: COLECOES };
  Object.keys(COLECOES).forEach(function (k) { RepositorioLocal[k] = colecao(COLECOES[k]); });

  /** Gravações atômicas: ou todas acontecem, ou nenhuma. */
  RepositorioLocal.lote = function (operacoes) {
    if (!operacoes || !operacoes.length) return Promise.resolve();
    var nomes = [];
    operacoes.forEach(function (o) {
      var n = COLECOES[o.colecao];
      if (!n) throw new Error('Coleção desconhecida: ' + o.colecao);
      if (nomes.indexOf(n) < 0) nomes.push(n);
    });
    return db.transacao(nomes, 'readwrite', function (store) {
      operacoes.forEach(function (o) {
        var s = store(COLECOES[o.colecao]);
        if (o.tipo === 'inserir') s.add(o.valor);
        else if (o.tipo === 'salvar') s.put(o.valor);
        else if (o.tipo === 'remover') s.delete(o.chave);
        else throw new Error('Operação desconhecida: ' + o.tipo);
      });
    });
  };

  /* Gravações do preenchimento do checklist: sempre no aparelho primeiro; o envio ao
     servidor é feito pela fila (funciona sem internet). Sem servidor, é o mesmo que lote(). */
  RepositorioLocal.loteLocal = RepositorioLocal.lote;

  RepositorioLocal.erroDeDuplicidade = function (e) {
    return !!e && (e.name === 'ConstraintError' || e.codigo === 'DUPLICIDADE');
  };

  RepositorioLocal.iniciar = function () { return db.abrir(); };

  CKL.RepositorioLocal = RepositorioLocal;
  CKL.repo = RepositorioLocal;
})(window);
