/* ==========================================================================
   Não conformidades e planos de ação
   --------------------------------------------------------------------------
   - Uma não conformidade para cada item marcado NC, criada quando o checklist é
     enviado (D9: um plano de ação por item NC).
   - Ela NÃO é encerrada sozinha quando o checklist é concluído, nem quando o
     equipamento é liberado na reavaliação: só o administrador encerra, com comentário.
   - O administrador pode completar o plano de ação (o que, como, quem, data prevista).
   ========================================================================== */
(function (global) {
  'use strict';
  var CKL = global.CKL;
  var util = CKL.util, cfg = CKL.config;
  var SIT = cfg.SITUACAO_NC;
  var repo = function () { return CKL.repo; };
  var Erro = function (m) { return CKL.auth.Erro(m); };
  var H = function () { return CKL.historico; };

  function rotulo(n) { return n.checklistNome + ' · Item ' + n.itemOrdem + ' — ' + n.itemTexto; }

  /** Atrasada: aberta e com data prevista já vencida. */
  function atrasada(n) {
    return n.situacao !== SIT.ENCERRADA && !!(n.plano && n.plano.dataPrevista) && n.plano.dataPrevista < util.dataLocal();
  }

  var nc = CKL.naoConformidades = {
    rotulo: rotulo,
    atrasada: atrasada,

    listar: function () {
      return repo().naoConformidades.listar().then(function (l) { return l.sort(function (a, b) { return a.registradaEm < b.registradaEm ? 1 : -1; }); });
    },
    obter: function (id) { return repo().naoConformidades.obter(id); },
    daExecucao: function (execucaoId) { return repo().naoConformidades.porIndice('execucaoId', execucaoId); },

    /** Monta (sem gravar) as não conformidades dos itens NC de um checklist. */
    criarDaExecucao: function (e, usuario) {
      var agora = util.agora();
      return CKL.execucoes.itens(e).filter(function (i) { var r = e.respostas[i.id]; return r && r.avaliacao === 'NC'; }).map(function (i) {
        var r = e.respostas[i.id];
        return {
          id: e.id + ':' + i.id,
          execucaoId: e.id, protocolo: e.protocolo, modeloId: e.modeloId, area: e.area,
          checklistNome: e.nome, identificacao: e.identificacao, dataExecucao: e.dataExecucao,
          itemId: i.id, itemOrdem: i.ordem, itemTexto: i.texto,
          descricao: r.descricao || '', observacao: r.observacao || '',
          fotos: (r.fotos || []).slice(),
          registradaEm: r.em || agora, registradaPorId: (usuario && usuario.id) || e.responsavelId, registradaPorNome: (usuario && usuario.nome) || e.responsavelNome,
          reavaliacoes: JSON.parse(JSON.stringify(r.reavaliacoes || [])),
          liberadoNaRodada: CKL.execucoes.rodadaLiberacao(r),
          plano: Object.assign({ oQue: '', como: '', quem: '', dataPrevista: '' }, r.plano || {}),
          situacao: SIT.ABERTA, encerramento: null, criadoEm: agora, atualizadoEm: agora
        };
      });
    },

    /** Encerramento já montado (usado também pela correção do checklist). */
    encerramento: function (n, comentario) {
      var u = CKL.auth.usuario() || {};
      var novo = Object.assign({}, n, { situacao: SIT.ENCERRADA, atualizadoEm: util.agora(),
        encerramento: { em: util.agora(), porId: u.id || null, porNome: u.nome || 'Sistema', comentario: comentario } });
      var ev = H().evento({ entidade: 'nc', entidadeId: n.id, rotulo: rotulo(n), acao: 'encerramento', campo: 'Situação', valorAnterior: 'Aberta', valorNovo: 'Encerrada', motivo: comentario });
      return { nc: novo, evento: ev };
    },

    /** Administrador completa ou altera o plano de ação. */
    atualizarPlano: function (id, plano) {
      CKL.auth.exigirAdm();
      return repo().naoConformidades.obter(id).then(function (n) {
        if (!n) throw Erro('Não conformidade não encontrada.');
        if (n.situacao === SIT.ENCERRADA) throw Erro('Esta não conformidade está encerrada. Reabra para alterar o plano.');
        var rot = { oQue: 'O que será feito?', como: 'Como?', quem: 'Quem?', dataPrevista: 'Data prevista de conclusão' };
        var novo = Object.assign({}, n, { plano: Object.assign({}, n.plano) }), evs = [];
        Object.keys(rot).forEach(function (k) {
          if (plano[k] === undefined) return;
          var v = k === 'dataPrevista' ? (plano[k] || '') : String(plano[k] || '').trim().slice(0, cfg.TEXTO_MAXIMO);
          var antes = n.plano[k] || '';
          if (v === antes) return;
          novo.plano[k] = v;
          evs.push(H().evento({ entidade: 'nc', entidadeId: n.id, rotulo: rotulo(n), acao: 'plano', campo: rot[k],
            valorAnterior: k === 'dataPrevista' ? util.fmtData(antes) : antes, valorNovo: k === 'dataPrevista' ? util.fmtData(v) : v }));
        });
        if (!evs.length) return n;
        novo.atualizadoEm = util.agora();
        return repo().lote([{ colecao: 'naoConformidades', tipo: 'salvar', valor: novo }].concat(H().operacoes(evs)))
          .then(function () { CKL.eventos.emitir('nc:alterado'); return novo; });
      });
    },

    encerrar: function (id, comentario) {
      CKL.auth.exigirAdm();
      comentario = util.limpar(comentario);
      if (comentario.length < 5) return Promise.reject(Erro('Descreva como a não conformidade foi resolvida (mínimo de 5 caracteres).'));
      return repo().naoConformidades.obter(id).then(function (n) {
        if (!n) throw Erro('Não conformidade não encontrada.');
        if (n.situacao === SIT.ENCERRADA) return n;
        var enc = nc.encerramento(n, comentario);
        return repo().lote([{ colecao: 'naoConformidades', tipo: 'salvar', valor: enc.nc }].concat(H().operacoes([enc.evento])))
          .then(function () { CKL.eventos.emitir('nc:alterado'); return enc.nc; });
      });
    },

    reabrir: function (id, motivo) {
      CKL.auth.exigirAdm();
      motivo = util.limpar(motivo);
      if (motivo.length < 5) return Promise.reject(Erro('Informe o motivo da reabertura (mínimo de 5 caracteres).'));
      return repo().naoConformidades.obter(id).then(function (n) {
        if (!n) throw Erro('Não conformidade não encontrada.');
        if (n.situacao !== SIT.ENCERRADA) return n;
        var novo = Object.assign({}, n, { situacao: SIT.ABERTA, atualizadoEm: util.agora(),
          encerramentosAnteriores: (n.encerramentosAnteriores || []).concat(n.encerramento ? [n.encerramento] : []), encerramento: null });
        var ev = H().evento({ entidade: 'nc', entidadeId: n.id, rotulo: rotulo(n), acao: 'reabertura', campo: 'Situação', valorAnterior: 'Encerrada', valorNovo: 'Aberta', motivo: motivo });
        return repo().lote([{ colecao: 'naoConformidades', tipo: 'salvar', valor: novo }].concat(H().operacoes([ev])))
          .then(function () { CKL.eventos.emitir('nc:alterado'); return novo; });
      });
    }
  };
})(window);
