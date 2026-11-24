/* ==========================================================================
   Cadastro de cultivares
   --------------------------------------------------------------------------
   - Lista usada nos campos "Cultivar anterior" e "Próxima cultivar".
   - Só o administrador inclui, renomeia, ativa e desativa (com histórico).
   - Nada é apagado: cultivar fora de uso é desativada e some da lista do
     celular. O checklist guarda o NOME da cultivar escolhida, então renomear
     ou desativar depois não muda os checklists já feitos.
   - Carga inicial: js/dados/cultivares-iniciais.js.
   ========================================================================== */
(function (global) {
  'use strict';
  var CKL = global.CKL;
  var util = CKL.util;
  var repo = function () { return CKL.repo; };
  var Erro = function (m) { return CKL.auth.Erro(m); };
  var H = function () { return CKL.historico; };
  var TAMANHO_MAXIMO = 80;

  function chave(nome) { return util.limpar(nome).toUpperCase(); }
  /* ordem alfabética simples (a mesma da lista da empresa) */
  function comparar(a, b) { var x = chave(a), y = chave(b); return x < y ? -1 : x > y ? 1 : 0; }
  function ordenar(lista) { return lista.sort(function (a, b) { return comparar(a.nome, b.nome); }); }

  function validarNome(nome, lista, ignorarId) {
    var n = util.limpar(nome);
    if (!n) throw Erro('Informe o nome da cultivar.');
    if (n.length > TAMANHO_MAXIMO) throw Erro('O nome da cultivar pode ter no máximo ' + TAMANHO_MAXIMO + ' caracteres.');
    var igual = lista.filter(function (c) { return c.id !== ignorarId && chave(c.nome) === chave(n); })[0];
    if (igual) throw Erro('A cultivar "' + igual.nome + '" já está cadastrada' + (igual.ativa === false ? ' (inativa — reative-a na lista).' : '.'));
    return n;
  }

  function novaCultivar(nome, quem, agora) {
    return { id: util.uuid(), nome: nome, ativa: true, criadaEm: agora, criadaPor: quem, atualizadaEm: agora, atualizadaPor: quem };
  }

  function gravar(ops, eventos) {
    return repo().lote(ops.concat(H().operacoes(eventos))).then(function () { CKL.eventos.emitir('cultivares:alterado'); });
  }

  var cultivares = CKL.cultivares = {
    TAMANHO_MAXIMO: TAMANHO_MAXIMO,

    listar: function () { return repo().cultivares.listar().then(ordenar); },
    ativas: function () { return cultivares.listar().then(function (l) { return l.filter(function (c) { return c.ativa !== false; }); }); },

    /** Nomes para os campos do checklist. O valor já gravado continua na lista mesmo se a cultivar foi desativada. */
    opcoes: function (valoresAtuais) {
      return cultivares.ativas().then(function (l) {
        var nomes = l.map(function (c) { return c.nome; });
        (valoresAtuais || []).forEach(function (v) {
          var n = util.limpar(v);
          if (n && nomes.indexOf(n) < 0) nomes.push(n);
        });
        return nomes.sort(comparar);
      });
    },

    criar: function (nome) {
      var adm = CKL.auth.exigirAdm();
      return repo().cultivares.listar().then(function (lista) {
        var c = novaCultivar(validarNome(nome, lista), adm.nome, util.agora());
        return gravar([{ colecao: 'cultivares', tipo: 'salvar', valor: c }],
          [H().evento({ entidade: 'cultivar', entidadeId: c.id, rotulo: c.nome, acao: 'criacao', campo: 'Cultivar', valorNovo: c.nome })])
          .then(function () { return c; });
      });
    },

    renomear: function (id, nome) {
      var adm = CKL.auth.exigirAdm();
      return repo().cultivares.listar().then(function (lista) {
        var atual = lista.filter(function (c) { return c.id === id; })[0];
        if (!atual) throw Erro('Cultivar não encontrada.');
        var n = validarNome(nome, lista, id);
        if (n === atual.nome) return atual;
        var c = Object.assign({}, atual, { nome: n, atualizadaEm: util.agora(), atualizadaPor: adm.nome });
        return gravar([{ colecao: 'cultivares', tipo: 'salvar', valor: c }],
          [H().evento({ entidade: 'cultivar', entidadeId: id, rotulo: n, acao: 'edicao', campo: 'Nome', valorAnterior: atual.nome, valorNovo: n })])
          .then(function () { return c; });
      });
    },

    definirSituacao: function (id, ativa) {
      var adm = CKL.auth.exigirAdm();
      return repo().cultivares.obter(id).then(function (atual) {
        if (!atual) throw Erro('Cultivar não encontrada.');
        if ((atual.ativa !== false) === ativa) return atual;
        var c = Object.assign({}, atual, { ativa: ativa, atualizadaEm: util.agora(), atualizadaPor: adm.nome });
        return gravar([{ colecao: 'cultivares', tipo: 'salvar', valor: c }],
          [H().evento({ entidade: 'cultivar', entidadeId: id, rotulo: c.nome, acao: ativa ? 'ativacao' : 'desativacao',
            campo: 'Situação', valorAnterior: ativa ? 'Inativa' : 'Ativa', valorNovo: ativa ? 'Ativa' : 'Inativa' })])
          .then(function () { return c; });
      });
    },

    /** Quantas cultivares da lista inicial ainda não estão cadastradas. */
    faltamDaListaInicial: function () {
      return repo().cultivares.listar().then(function (lista) {
        var existentes = lista.map(function (c) { return chave(c.nome); });
        return (CKL.cultivaresIniciais || []).filter(function (n) { return existentes.indexOf(chave(n)) < 0; });
      });
    },

    /** Administrador: inclui as cultivares da lista inicial que ainda não existem. Devolve quantas entraram. */
    carregarIniciais: function () {
      var adm = CKL.auth.exigirAdm();
      return cultivares.faltamDaListaInicial().then(function (faltam) {
        if (!faltam.length) return 0;
        var agora = util.agora();
        var novas = faltam.map(function (n) { return novaCultivar(util.limpar(n), adm.nome, agora); });
        return gravar(novas.map(function (c) { return { colecao: 'cultivares', tipo: 'salvar', valor: c }; }),
          [H().evento({ entidade: 'cultivar', entidadeId: 'lista-inicial', rotulo: 'Lista inicial de cultivares', acao: 'criacao',
            campo: 'Cultivares incluídas', valorNovo: novas.length, motivo: 'Carga inicial da lista de cultivares da empresa' })])
          .then(function () { return novas.length; });
      });
    },

    /** Sem servidor: cria a lista inicial na primeira abertura. */
    semear: function () {
      return repo().cultivares.contar().then(function (n) {
        if (n > 0 || !(CKL.cultivaresIniciais || []).length) return false;
        var agora = util.agora();
        return repo().lote(CKL.cultivaresIniciais.map(function (nome) {
          return { colecao: 'cultivares', tipo: 'salvar', valor: novaCultivar(util.limpar(nome), 'Sistema (lista inicial)', agora) };
        })).then(function () { return true; });
      });
    }
  };
})(window);
