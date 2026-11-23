/* ==========================================================================
   Modelos de checklist (um por UBS / secador), com versões
   --------------------------------------------------------------------------
   - Os 16 modelos originais vêm de js/dados/modelos-originais.js na primeira vez.
   - Cada alteração feita pelo administrador cria uma NOVA versão; a anterior fica
     guardada em "modelosVersoes". Cada checklist preenchido leva uma cópia
     congelada da versão usada, então mudar o modelo não altera o que já foi feito.
   ========================================================================== */
(function (global) {
  'use strict';
  var CKL = global.CKL;
  var util = CKL.util;
  var repo = function () { return CKL.repo; };
  var Erro = function (m) { return CKL.auth.Erro(m); };
  var H = function () { return CKL.historico; };

  /* campos do cabeçalho que o administrador pode alterar (rótulo usado no histórico) */
  var CAMPOS = {
    nome: 'Nome', area: 'Área', titulo: 'Título', identificacao: 'Identificação', versaoDocumento: 'Versão do documento',
    pagina: 'Página', elaboradoPor: 'Elaborado por', revisadoPor: 'Revisado por', aprovadoPor: 'Aprovado por', aprovadoEm: 'Aprovado em'
  };

  function ordenar(lista) {
    var ordemArea = CKL.config.AREAS.map(function (a) { return a.id; });
    return lista.sort(function (a, b) {
      var ia = ordemArea.indexOf(a.area), ib = ordemArea.indexOf(b.area);
      if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      return util.compararNatural(a.nome, b.nome);
    });
  }

  function copia(o) { return JSON.parse(JSON.stringify(o)); }

  function versaoDoc(m) { return Object.assign(copia(m), { chave: m.id + '@' + m.versaoModelo, modeloId: m.id }); }

  function rotulo(m) { return m.nome + ' (' + m.identificacao + ')'; }

  /** Itens ativos, na ordem do documento. */
  function itensAtivos(m) {
    return (m.itens || []).filter(function (i) { return i.ativo !== false; }).sort(function (a, b) { return a.ordem - b.ordem; });
  }

  var modelos = CKL.modelos = {
    CAMPOS: CAMPOS,
    rotulo: rotulo,
    itensAtivos: itensAtivos,

    listar: function () { return repo().modelos.listar().then(ordenar); },
    ativos: function () { return modelos.listar().then(function (l) { return l.filter(function (m) { return m.ativo !== false; }); }); },
    obter: function (id) { return repo().modelos.obter(id); },
    versoes: function (id) {
      return repo().modelosVersoes.porIndice('modeloId', id).then(function (l) { return l.sort(function (a, b) { return b.versaoModelo - a.versaoModelo; }); });
    },

    /** Áreas existentes (as da configuração primeiro, depois as criadas pelo administrador). */
    areas: function (lista) {
      var fixas = CKL.config.AREAS.map(function (a) { return a.id; });
      var extras = util.unicos((lista || []).map(function (m) { return m.area; })).filter(function (a) { return fixas.indexOf(a) < 0; });
      return CKL.config.AREAS.concat(extras.map(function (a) { return { id: a, rotulo: a, descricao: '', icone: 'checklist' }; }));
    },

    /** Operações que criam os modelos originais (primeira abertura do banco). */
    operacoesIniciais: function () {
      var agora = util.agora();
      var ops = [];
      (CKL.modelosOriginais || []).forEach(function (o) {
        var m = copia(o);
        m.versaoModelo = 1;
        m.ativo = true;
        m.temTermo = !!m.termoConclusao;
        m.criadoEm = agora; m.criadoPor = 'Sistema (planilha original)';
        m.atualizadoEm = agora; m.atualizadoPor = 'Sistema (planilha original)';
        ops.push({ colecao: 'modelos', tipo: 'salvar', valor: m });
        ops.push({ colecao: 'modelosVersoes', tipo: 'salvar', valor: versaoDoc(m) });
      });
      return ops;
    },

    /** Sem servidor: cria os modelos originais na primeira abertura. */
    semear: function () {
      return repo().modelos.contar().then(function (n) {
        if (n > 0) return false;
        return repo().lote(modelos.operacoesIniciais()).then(function () { return true; });
      });
    },

    /** Com servidor: o administrador envia os modelos originais quando o servidor ainda não tem nenhum. */
    carregarOriginais: function () {
      CKL.auth.exigirAdm();
      return repo().modelos.contar().then(function (n) {
        if (n > 0) throw Erro('Os modelos já foram carregados.');
        var ops = modelos.operacoesIniciais();
        var evs = ops.filter(function (o) { return o.colecao === 'modelos'; }).map(function (o) {
          return H().evento({ entidade: 'modelo', entidadeId: o.valor.id, rotulo: rotulo(o.valor), acao: 'criacao', campo: 'Versão do modelo', valorNovo: 1,
            motivo: 'Carga inicial a partir da planilha original' });
        });
        return repo().lote(ops.concat(H().operacoes(evs))).then(function () { CKL.eventos.emitir('modelos:alterado'); });
      });
    },

    /**
     * Grava uma nova versão do modelo.
     * dados: campos do cabeçalho (CAMPOS), temTermo, termoConclusao e itens [{ id?, texto, secao, ativo }]
     * na ordem desejada. Itens nunca são apagados: são desativados (para manter o histórico).
     */
    salvarVersao: function (id, dados, motivo) {
      var adm = CKL.auth.exigirAdm();
      motivo = util.limpar(motivo);
      if (motivo.length < 5) return Promise.reject(Erro('Informe o motivo da alteração (mínimo de 5 caracteres).'));
      return repo().modelos.obter(id).then(function (atual) {
        if (!atual) throw Erro('Modelo não encontrado.');
        var novo = copia(atual), evs = [];
        function ev(campo, antes, depois) {
          evs.push(H().evento({ entidade: 'modelo', entidadeId: id, rotulo: rotulo(atual), acao: 'edicao', campo: campo, valorAnterior: antes, valorNovo: depois, motivo: motivo }));
        }
        Object.keys(CAMPOS).forEach(function (c) {
          if (dados[c] === undefined) return;
          var v = c === 'aprovadoEm' ? (util.textoParaData(dados[c]) || util.limpar(dados[c])) : util.limpar(dados[c]);
          if (c === 'nome' && v.length < 2) throw Erro('Informe o nome do checklist.');
          if (c === 'area' && !v) throw Erro('Informe a área.');
          if (String(atual[c] || '') !== v) { ev(CAMPOS[c], c === 'aprovadoEm' ? util.fmtData(atual[c]) : atual[c], c === 'aprovadoEm' ? util.fmtData(v) : v); novo[c] = v; }
        });
        if (dados.temTermo !== undefined && !!dados.temTermo !== !!atual.temTermo) {
          ev('Termo de conclusão (Liberada / Não liberada)', atual.temTermo ? 'Sim' : 'Não', dados.temTermo ? 'Sim' : 'Não');
          novo.temTermo = !!dados.temTermo;
          if (novo.temTermo && !novo.termoConclusao) {
            novo.termoConclusao = 'O setor de Qualidade realizou a verificação e atesta que a ' + novo.area + ' foi INSPECIONADA e encontra-se ( ) Liberada ( ) Não Liberada para os processos subsequentes.';
          }
        }
        if (dados.itens) {
          var porId = {};
          (atual.itens || []).forEach(function (i) { porId[i.id] = i; });
          var vistos = {}, lista = [];
          dados.itens.forEach(function (d, k) {
            var texto = util.limpar(d.texto);
            if (!texto) throw Erro('O item ' + (k + 1) + ' está sem descrição.');
            var antigo = d.id && porId[d.id];
            var item = antigo ? copia(antigo) : { id: id + '-n' + util.codigoCurto(6).toLowerCase(), linhaOriginal: null };
            item.ordem = k + 1;
            item.texto = texto;
            item.secao = util.limpar(d.secao) || null;
            item.ativo = d.ativo !== false;
            if (!antigo) ev('Item incluído', null, 'Item ' + item.ordem + ' — ' + texto);
            else {
              if (antigo.texto !== texto) ev('Texto do item ' + antigo.ordem, antigo.texto, texto);
              if ((antigo.secao || null) !== item.secao) ev('Seção do item ' + antigo.ordem, antigo.secao, item.secao);
              if ((antigo.ativo !== false) !== item.ativo) ev('Item ' + antigo.ordem + ' — ' + texto, antigo.ativo !== false ? 'Ativo' : 'Inativo', item.ativo ? 'Ativo' : 'Inativo');
              if (antigo.ordem !== item.ordem && antigo.ativo !== false) ev('Posição do item "' + texto + '"', antigo.ordem, item.ordem);
            }
            vistos[item.id] = true;
            lista.push(item);
          });
          // itens que sumiram da lista continuam guardados, desativados
          (atual.itens || []).forEach(function (i) {
            if (vistos[i.id]) return;
            var d = copia(i); d.ativo = false; d.ordem = lista.length + 1;
            if (i.ativo !== false) ev('Item ' + i.ordem + ' — ' + i.texto, 'Ativo', 'Inativo');
            lista.push(d);
          });
          if (!lista.some(function (i) { return i.ativo !== false; })) throw Erro('O checklist precisa de pelo menos um item ativo.');
          novo.itens = lista;
        }
        if (!evs.length) return atual;
        novo.versaoModelo = (atual.versaoModelo || 1) + 1;
        novo.atualizadoEm = util.agora();
        novo.atualizadoPor = adm.nome;
        evs.push(H().evento({ entidade: 'modelo', entidadeId: id, rotulo: rotulo(novo), acao: 'nova_versao', campo: 'Versão do modelo',
          valorAnterior: atual.versaoModelo || 1, valorNovo: novo.versaoModelo, motivo: motivo }));
        return repo().lote([
          { colecao: 'modelos', tipo: 'salvar', valor: novo },
          { colecao: 'modelosVersoes', tipo: 'salvar', valor: versaoDoc(novo) }
        ].concat(H().operacoes(evs))).then(function () { CKL.eventos.emitir('modelos:alterado'); return novo; });
      });
    },

    /** Novo checklist (ex.: um secador novo). */
    criar: function (dados) {
      var adm = CKL.auth.exigirAdm();
      var nome = util.limpar(dados.nome), area = util.limpar(dados.area);
      if (nome.length < 2) return Promise.reject(Erro('Informe o nome do checklist (ex.: Secador 09).'));
      if (!area) return Promise.reject(Erro('Informe a área.'));
      var itens = (dados.itens || []).map(function (t) { return util.limpar(t); }).filter(Boolean);
      if (!itens.length) return Promise.reject(Erro('Informe pelo menos um item (um por linha).'));
      return repo().modelos.listar().then(function (todos) {
        var base = util.nomeArquivoSeguro(area + '-' + nome).toLowerCase().replace(/_/g, '-');
        var id = base, n = 2;
        while (todos.some(function (m) { return m.id === id; })) id = base + '-' + (n++);
        if (todos.some(function (m) { return util.chave(m.nome) === util.chave(nome) && m.area === area; })) throw Erro('Já existe um checklist com esse nome nesta área.');
        var agora = util.agora();
        var m = {
          id: id, area: area, nome: nome,
          titulo: util.limpar(dados.titulo) || ('LIMPEZA DE EQUIPAMENTOS - ' + nome.toUpperCase()),
          identificacao: util.limpar(dados.identificacao), versaoDocumento: util.limpar(dados.versaoDocumento), pagina: '',
          elaboradoPor: util.limpar(dados.elaboradoPor), revisadoPor: util.limpar(dados.revisadoPor), aprovadoPor: util.limpar(dados.aprovadoPor),
          aprovadoEm: util.textoParaData(dados.aprovadoEm) || null,
          cabecalho: 'CHECK LIST / SISTEMA DE GESTÃO DA QUALIDADE',
          orientacao: (CKL.modelosOriginais && CKL.modelosOriginais[0] ? copia(CKL.modelosOriginais[0].orientacao) : []),
          notaReavaliacao: CKL.modelosOriginais && CKL.modelosOriginais[0] ? CKL.modelosOriginais[0].notaReavaliacao : '',
          temTermo: !!dados.temTermo,
          termoConclusao: dados.temTermo ? 'O setor de Qualidade realizou a verificação e atesta que a ' + area + ' foi INSPECIONADA e encontra-se ( ) Liberada ( ) Não Liberada para os processos subsequentes.' : null,
          rotuloObservacoes: 'Observações:',
          origem: { arquivo: null, aba: null, criadoNoSistema: true },
          itens: itens.map(function (t, k) { return { id: id + '-n' + util.codigoCurto(6).toLowerCase(), ordem: k + 1, texto: t, secao: null, linhaOriginal: null, ativo: true }; }),
          versaoModelo: 1, ativo: true, criadoEm: agora, criadoPor: adm.nome, atualizadoEm: agora, atualizadoPor: adm.nome
        };
        var ev = H().evento({ entidade: 'modelo', entidadeId: id, rotulo: rotulo(m), acao: 'criacao', campo: 'Itens', valorNovo: m.itens.length });
        return repo().lote([
          { colecao: 'modelos', tipo: 'inserir', valor: m },
          { colecao: 'modelosVersoes', tipo: 'salvar', valor: versaoDoc(m) }
        ].concat(H().operacoes([ev]))).then(function () { CKL.eventos.emitir('modelos:alterado'); return m; });
      });
    },

    /** Ativa ou desativa o checklist inteiro (desativado não aparece no aplicativo). */
    definirSituacao: function (id, ativo, motivo) {
      var adm = CKL.auth.exigirAdm();
      return repo().modelos.obter(id).then(function (m) {
        if (!m) throw Erro('Modelo não encontrado.');
        if ((m.ativo !== false) === ativo) return m;
        var novo = copia(m);
        novo.ativo = ativo; novo.atualizadoEm = util.agora(); novo.atualizadoPor = adm.nome;
        var ev = H().evento({ entidade: 'modelo', entidadeId: id, rotulo: rotulo(m), acao: ativo ? 'ativacao' : 'desativacao',
          campo: 'Situação', valorAnterior: ativo ? 'Inativo' : 'Ativo', valorNovo: ativo ? 'Ativo' : 'Inativo', motivo: motivo });
        return repo().lote([{ colecao: 'modelos', tipo: 'salvar', valor: novo }].concat(H().operacoes([ev])))
          .then(function () { CKL.eventos.emitir('modelos:alterado'); return novo; });
      });
    }
  };
})(window);
