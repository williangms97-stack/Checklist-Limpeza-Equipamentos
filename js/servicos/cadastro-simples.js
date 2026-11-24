/* ==========================================================================
   Cadastro simples (uma lista de nomes mantida pelo administrador)
   --------------------------------------------------------------------------
   Usado pelas cultivares e pelos motivos de autorização de veículo.
   - Só o administrador inclui, renomeia, ativa e desativa (com histórico).
   - Nada é apagado: o que sai de uso é desativado e some das listas do celular.
   - Os registros guardam o TEXTO escolhido, então renomear ou desativar depois
     não muda o que já foi feito.
   Campos de cada item: id, nome, ativa, criadaEm/criadaPor, atualizadaEm/atualizadaPor.
   ========================================================================== */
(function (global) {
  'use strict';
  var CKL = global.CKL;
  var util = CKL.util;
  var repo = function () { return CKL.repo; };
  var Erro = function (m) { return CKL.auth.Erro(m); };
  var H = function () { return CKL.historico; };

  function chave(nome) { return util.limpar(nome).toUpperCase(); }
  /* ordem alfabética simples, caractere a caractere (a mesma das listas da empresa) */
  function comparar(a, b) { var x = chave(a), y = chave(b); return x < y ? -1 : x > y ? 1 : 0; }

  /**
   * op: { colecao, entidade, evento, tamanhoMaximo, iniciais: () => [nomes],
   *       nomes: { item: 'cultivar', feminino: true, Item: 'Cultivar' } }
   */
  CKL.criarCadastroSimples = function (op) {
    var N = op.nomes, fem = N.feminino;
    var o = function (fem1, masc) { return fem ? fem1 : masc; };
    var MAX = op.tamanhoMaximo || 80;

    function ordenar(lista) { return lista.sort(function (a, b) { return comparar(a.nome, b.nome); }); }

    function validarNome(nome, lista, ignorarId) {
      var n = util.limpar(nome);
      if (!n) throw Erro('Informe ' + o('a ', 'o ') + N.item + '.');
      if (n.length > MAX) throw Erro(N.Item + ': no máximo ' + MAX + ' caracteres.');
      var igual = lista.filter(function (c) { return c.id !== ignorarId && chave(c.nome) === chave(n); })[0];
      if (igual) throw Erro('"' + igual.nome + '" já está ' + o('cadastrada', 'cadastrado') + (igual.ativa === false ? ' (' + o('inativa', 'inativo') + ' — reative na lista).' : '.'));
      return n;
    }

    function novo(nome, quem, agora) {
      return { id: util.uuid(), nome: nome, ativa: true, criadaEm: agora, criadaPor: quem, atualizadaEm: agora, atualizadaPor: quem };
    }

    function gravar(ops, eventos) {
      return repo().lote(ops.concat(H().operacoes(eventos))).then(function () { CKL.eventos.emitir(op.evento); });
    }
    function iniciais() { return (op.iniciais && op.iniciais()) || []; }

    var s = {
      TAMANHO_MAXIMO: MAX,
      nomes: N,

      listar: function () { return repo()[op.colecao].listar().then(ordenar); },
      ativas: function () { return s.listar().then(function (l) { return l.filter(function (c) { return c.ativa !== false; }); }); },

      /** Textos para um campo de escolha. O valor já gravado continua na lista mesmo se foi desativado. */
      opcoes: function (valoresAtuais) {
        return s.ativas().then(function (l) {
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
        return repo()[op.colecao].listar().then(function (lista) {
          var c = novo(validarNome(nome, lista), adm.nome, util.agora());
          return gravar([{ colecao: op.colecao, tipo: 'salvar', valor: c }],
            [H().evento({ entidade: op.entidade, entidadeId: c.id, rotulo: c.nome, acao: 'criacao', campo: N.Item, valorNovo: c.nome })])
            .then(function () { return c; });
        });
      },

      renomear: function (id, nome) {
        var adm = CKL.auth.exigirAdm();
        return repo()[op.colecao].listar().then(function (lista) {
          var atual = lista.filter(function (c) { return c.id === id; })[0];
          if (!atual) throw Erro(N.Item + ' não ' + o('encontrada', 'encontrado') + '.');
          var n = validarNome(nome, lista, id);
          if (n === atual.nome) return atual;
          var c = Object.assign({}, atual, { nome: n, atualizadaEm: util.agora(), atualizadaPor: adm.nome });
          return gravar([{ colecao: op.colecao, tipo: 'salvar', valor: c }],
            [H().evento({ entidade: op.entidade, entidadeId: id, rotulo: n, acao: 'edicao', campo: 'Nome', valorAnterior: atual.nome, valorNovo: n })])
            .then(function () { return c; });
        });
      },

      definirSituacao: function (id, ativa) {
        var adm = CKL.auth.exigirAdm();
        return repo()[op.colecao].obter(id).then(function (atual) {
          if (!atual) throw Erro(N.Item + ' não ' + o('encontrada', 'encontrado') + '.');
          if ((atual.ativa !== false) === ativa) return atual;
          var c = Object.assign({}, atual, { ativa: ativa, atualizadaEm: util.agora(), atualizadaPor: adm.nome });
          var A = o('Ativa', 'Ativo'), I = o('Inativa', 'Inativo');
          return gravar([{ colecao: op.colecao, tipo: 'salvar', valor: c }],
            [H().evento({ entidade: op.entidade, entidadeId: id, rotulo: c.nome, acao: ativa ? 'ativacao' : 'desativacao',
              campo: 'Situação', valorAnterior: ativa ? I : A, valorNovo: ativa ? A : I })])
            .then(function () { return c; });
        });
      },

      /** Itens da lista inicial que ainda não estão cadastrados. */
      faltamDaListaInicial: function () {
        return repo()[op.colecao].listar().then(function (lista) {
          var existentes = lista.map(function (c) { return chave(c.nome); });
          return iniciais().filter(function (n) { return existentes.indexOf(chave(n)) < 0; });
        });
      },

      /** Administrador: inclui os itens da lista inicial que ainda não existem. Devolve quantos entraram. */
      carregarIniciais: function () {
        var adm = CKL.auth.exigirAdm();
        return s.faltamDaListaInicial().then(function (faltam) {
          if (!faltam.length) return 0;
          var agora = util.agora();
          var novos = faltam.map(function (n) { return novo(util.limpar(n), adm.nome, agora); });
          return gravar(novos.map(function (c) { return { colecao: op.colecao, tipo: 'salvar', valor: c }; }),
            [H().evento({ entidade: op.entidade, entidadeId: 'lista-inicial', rotulo: 'Lista inicial', acao: 'criacao',
              campo: 'Itens incluídos', valorNovo: novos.length, motivo: 'Carga inicial da lista da empresa' })])
            .then(function () { return novos.length; });
        });
      },

      /** Sem servidor: cria a lista inicial na primeira abertura. */
      semear: function () {
        var l = iniciais();
        if (!l.length) return Promise.resolve(false);
        return repo()[op.colecao].contar().then(function (n) {
          if (n > 0) return false;
          var agora = util.agora();
          return repo().lote(l.map(function (nome) {
            return { colecao: op.colecao, tipo: 'salvar', valor: novo(util.limpar(nome), 'Sistema (lista inicial)', agora) };
          })).then(function () { return true; });
        });
      }
    };
    return s;
  };
})(window);
