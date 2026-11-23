/* ==========================================================================
   Execução de checklist (um checklist preenchido)
   --------------------------------------------------------------------------
   Regras (validadas com o usuário — ver docs/ANALISE-DOS-CHECKLISTS.md):
   - Cada item recebe C, NC ou "Equipamento não solicitado" (NS), com data/hora automática.
   - Item NC: descrição obrigatória; até 3 reavaliações (C/NC + data/hora). Quando uma
     reavaliação dá C, o equipamento foi liberado naquela rodada.
   - Item que termina NC (não liberado): plano de ação com "O que será feito?",
     "Quem?" e "Data prevista de conclusão" obrigatórios ("Como?" opcional).
   - UBS: termo Liberada / Não Liberada obrigatório; "Liberada" só sem equipamento NC.
   - Operador do local: nome obrigatório e assinatura na tela (opcional).
   - Fotos: sempre opcionais.
   - Depois de enviado, o checklist não muda mais pelo aplicativo. Correção só pelo
     administrador, com motivo, e tudo fica no histórico.
   - Cada checklist guarda a cópia da versão do modelo usada naquele dia.
   ========================================================================== */
(function (global) {
  'use strict';
  var CKL = global.CKL;
  var util = CKL.util, cfg = CKL.config;
  var ST = cfg.STATUS;
  var repo = function () { return CKL.repo; };
  var Erro = function (m) { return CKL.auth.Erro(m); };
  var H = function () { return CKL.historico; };

  function copia(o) { return JSON.parse(JSON.stringify(o)); }

  function rotulo(e) { return e.nome + ' · ' + util.fmtData(e.dataExecucao) + ' · ' + e.protocolo; }

  function novoProtocolo() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return 'CKL-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + util.codigoCurto(4);
  }

  function resposta(e, itemId) {
    var r = e.respostas[itemId];
    if (!r) r = e.respostas[itemId] = { avaliacao: null, em: null, descricao: '', observacao: '', plano: { oQue: '', como: '', quem: '', dataPrevista: '' }, reavaliacoes: [], fotos: [] };
    if (!r.plano) r.plano = { oQue: '', como: '', quem: '', dataPrevista: '' };
    if (!r.reavaliacoes) r.reavaliacoes = [];
    if (!r.fotos) r.fotos = [];
    return r;
  }

  /** Situação final do item: C, NC ou NS (null quando ainda não avaliado). */
  function situacaoFinal(r) {
    if (!r || !r.avaliacao) return null;
    if (r.avaliacao !== 'NC') return r.avaliacao;
    var ult = r.reavaliacoes && r.reavaliacoes[r.reavaliacoes.length - 1];
    return ult && ult.resultado === 'C' ? 'C' : 'NC';
  }
  /** Rodada em que o item NC foi liberado (1, 2 ou 3), ou null. */
  function rodadaLiberacao(r) {
    if (!r || r.avaliacao !== 'NC') return null;
    var ult = r.reavaliacoes && r.reavaliacoes[r.reavaliacoes.length - 1];
    return ult && ult.resultado === 'C' ? ult.rodada : null;
  }

  function itens(e) { return (e.modelo && e.modelo.itens) || []; }

  /** Números do checklist (usados no resumo, no painel e no relatório). */
  function resultado(e) {
    var r = { total: 0, avaliados: 0, conformes: 0, naoConformes: 0, naoSolicitados: 0, liberadosReavaliacao: 0, naoLiberados: 0, rodadaLiberacao: null };
    itens(e).forEach(function (i) {
      r.total++;
      var x = e.respostas[i.id];
      if (!x || !x.avaliacao) return;
      r.avaliados++;
      if (x.avaliacao === 'C') r.conformes++;
      else if (x.avaliacao === 'NS') r.naoSolicitados++;
      else {
        r.naoConformes++;
        var rod = rodadaLiberacao(x);
        if (rod) { r.liberadosReavaliacao++; r.rodadaLiberacao = Math.max(r.rodadaLiberacao || 0, rod); }
        else r.naoLiberados++;
      }
    });
    r.equipamentosLiberados = r.avaliados === r.total && r.naoLiberados === 0;
    return r;
  }

  /** O que falta para poder enviar. Lista de { itemId|null, campo, mensagem }. */
  function pendencias(e) {
    var p = [];
    if (!util.limpar(e.cultivarAnterior)) p.push({ itemId: null, campo: 'cultivarAnterior', mensagem: 'Informe a cultivar anterior.' });
    if (!util.limpar(e.proximaCultivar)) p.push({ itemId: null, campo: 'proximaCultivar', mensagem: 'Informe a próxima cultivar.' });
    var algumNcFinal = false;
    itens(e).forEach(function (i) {
      var r = e.respostas[i.id], nome = 'Item ' + i.ordem + ' — ' + i.texto;
      if (!r || !r.avaliacao) { p.push({ itemId: i.id, campo: 'avaliacao', mensagem: nome + ': falta avaliar.' }); return; }
      if (r.avaliacao !== 'NC') return;
      if (!util.limpar(r.descricao)) p.push({ itemId: i.id, campo: 'descricao', mensagem: nome + ': descreva a não conformidade.' });
      if (situacaoFinal(r) === 'NC') {
        algumNcFinal = true;
        var pl = r.plano || {};
        var falta = [];
        if (!util.limpar(pl.oQue)) falta.push('o que será feito');
        if (!util.limpar(pl.quem)) falta.push('quem');
        if (!pl.dataPrevista) falta.push('data prevista de conclusão');
        if (falta.length) p.push({ itemId: i.id, campo: 'plano', mensagem: nome + ': plano de ação sem ' + falta.join(', ') + '.' });
      }
    });
    if (e.modelo.temTermo) {
      if (!e.termo) p.push({ itemId: null, campo: 'termo', mensagem: 'Marque no termo de conclusão se a ' + e.area + ' está Liberada ou Não Liberada.' });
      else if (e.termo === cfg.TERMO.LIBERADA && algumNcFinal) p.push({ itemId: null, campo: 'termo', mensagem: 'A ' + e.area + ' não pode ser marcada como Liberada com equipamento não conforme (não liberado na reavaliação).' });
    }
    if (!util.limpar(e.operadorLocal && e.operadorLocal.nome)) p.push({ itemId: null, campo: 'operadorLocal', mensagem: 'Informe o nome do operador do local.' });
    return p;
  }

  function exigirEditavel(e) {
    var u = CKL.auth.exigirLogin();
    if (!e) throw Erro('Checklist não encontrado.');
    if (e.status !== ST.EM_ANDAMENTO) throw Erro('Este checklist já foi enviado e não pode mais ser alterado.');
    if (e.responsavelId !== u.id) throw Erro('Este checklist foi iniciado por ' + e.responsavelNome + '. Só ele pode continuar.');
    return u;
  }

  /** Grava a execução no aparelho e coloca na fila de envio (mais eventos e fotos opcionais). */
  function gravar(e, extras) {
    e.alteradoEm = util.agora();
    e.situacaoEnvio = cfg.SITUACAO_ENVIO.AGUARDANDO;
    return CKL.sincronizacao.opsFila(e).then(function (opsFila) {
      return repo().loteLocal([{ colecao: 'execucoes', tipo: 'salvar', valor: e }].concat(extras || [], opsFila));
    }).then(function () {
      CKL.eventos.emitir('execucoes:alterado', { id: e.id });
      CKL.sincronizacao.processarDepois();
      return e;
    });
  }

  /* Todas as gravações do preenchimento passam por esta fila, uma de cada vez e na ordem
     dos toques: assim um texto sendo salvo nunca é sobrescrito por um toque logo em seguida. */
  var cadeia = Promise.resolve();
  function emOrdem(fn) {
    var p = cadeia.then(fn);
    cadeia = p.catch(function () {});
    return p;
  }

  /** Altera a execução em andamento: fn(execucao) faz a mudança e pode devolver operações extras. */
  function alterar(id, fn) {
    return emOrdem(function () {
      return repo().execucoes.obter(id).then(function (e) {
        exigirEditavel(e);
        var extras = fn(e) || [];
        return Promise.resolve(extras).then(function (x) { return gravar(e, x); });
      });
    });
  }

  var execucoes = CKL.execucoes = {
    rotulo: rotulo,
    situacaoFinal: situacaoFinal,
    rodadaLiberacao: rodadaLiberacao,
    resultado: resultado,
    pendencias: pendencias,
    itens: itens,

    obter: function (id) { return repo().execucoes.obter(id); },
    listar: function () {
      return repo().execucoes.listar().then(function (l) { return l.sort(function (a, b) { return a.iniciadoEm < b.iniciadoEm ? 1 : -1; }); });
    },
    /** Checklists do usuário conectado (o aplicativo mostra só os próprios). */
    meus: function () {
      var u = CKL.auth.usuario();
      return execucoes.listar().then(function (l) { return l.filter(function (e) { return u && e.responsavelId === u.id; }); });
    },
    fotosDe: function (id) { return repo().fotos.porIndice('execucaoId', id); },
    urlDaFoto: function (f) { return f && f.dados ? URL.createObjectURL(new Blob([f.dados], { type: f.tipo || 'image/jpeg' })) : null; },

    /** Começa um checklist a partir da versão vigente do modelo. */
    iniciar: function (modeloId, dados) {
      var u = CKL.auth.exigirLogin();
      return CKL.modelos.obter(modeloId).then(function (m) {
        if (!m || m.ativo === false) throw Erro('Este checklist não está disponível.');
        var snap = copia(m);
        snap.itens = CKL.modelos.itensAtivos(m);
        var agora = util.agora();
        var e = {
          id: util.uuid(), protocolo: novoProtocolo(),
          modeloId: m.id, versaoModelo: m.versaoModelo || 1, modelo: snap,
          area: m.area, nome: m.nome, identificacao: m.identificacao, titulo: m.titulo,
          responsavelId: u.id, responsavelNome: u.nome, responsavelUsuario: u.usuario,
          dataExecucao: util.dataLocal(), iniciadoEm: agora, concluidoEm: null, alteradoEm: agora,
          status: ST.EM_ANDAMENTO,
          cultivarAnterior: util.limpar(dados && dados.cultivarAnterior), proximaCultivar: util.limpar(dados && dados.proximaCultivar),
          respostas: {}, observacoes: '', termo: null, operadorLocal: { nome: '', assinatura: null, assinadoEm: null },
          resultado: null, correcoes: [], descarte: null,
          situacaoEnvio: cfg.SITUACAO_ENVIO.AGUARDANDO, erroEnvio: null
        };
        var ev = H().evento({ entidade: 'execucao', entidadeId: e.id, rotulo: rotulo(e), acao: 'inicio', campo: 'Versão do modelo', valorNovo: e.versaoModelo });
        return gravar(e, H().operacoes([ev]));
      });
    },

    /** Dados gerais: cultivares, observações, termo e nome do operador do local. */
    definirGerais: function (id, d) {
      return alterar(id, function (e) {
        if (d.cultivarAnterior !== undefined) e.cultivarAnterior = util.limpar(d.cultivarAnterior);
        if (d.proximaCultivar !== undefined) e.proximaCultivar = util.limpar(d.proximaCultivar);
        if (d.observacoes !== undefined) e.observacoes = String(d.observacoes || '').slice(0, cfg.TEXTO_MAXIMO * 2);
        if (d.termo !== undefined) {
          if (d.termo && !e.modelo.temTermo) throw Erro('Este checklist não tem termo de conclusão.');
          e.termo = d.termo || null;
        }
        if (d.operadorNome !== undefined) e.operadorLocal.nome = util.limpar(d.operadorNome);
        if (d.assinatura !== undefined) { e.operadorLocal.assinatura = d.assinatura || null; e.operadorLocal.assinadoEm = d.assinatura ? util.agora() : null; }
      });
    },

    /** Marca C, NC ou NS no item. Trocar a marcação apaga as reavaliações daquele item. */
    avaliar: function (id, itemId, avaliacao) {
      if (cfg.AVALIACOES.indexOf(avaliacao) < 0) return Promise.reject(Erro('Avaliação inválida.'));
      return alterar(id, function (e) {
        if (!itens(e).some(function (i) { return i.id === itemId; })) throw Erro('Item não encontrado neste checklist.');
        var r = resposta(e, itemId);
        if (r.avaliacao === avaliacao) return;
        r.avaliacao = avaliacao;
        r.em = util.agora();
        if (avaliacao !== 'NC') r.reavaliacoes = [];
      });
    },

    /** Textos do item: descricao (NC), observacao e plano { oQue, como, quem, dataPrevista }. */
    definirTextos: function (id, itemId, d) {
      return alterar(id, function (e) {
        var r = resposta(e, itemId), max = cfg.TEXTO_MAXIMO;
        if (d.descricao !== undefined) r.descricao = String(d.descricao || '').slice(0, max);
        if (d.observacao !== undefined) r.observacao = String(d.observacao || '').slice(0, max);
        if (d.plano) {
          ['oQue', 'como', 'quem'].forEach(function (k) { if (d.plano[k] !== undefined) r.plano[k] = String(d.plano[k] || '').slice(0, max); });
          if (d.plano.dataPrevista !== undefined) r.plano.dataPrevista = d.plano.dataPrevista || '';
        }
      });
    },

    /** Registra a próxima reavaliação (1ª, 2ª ou 3ª) de um item NC. */
    reavaliar: function (id, itemId, resultadoReav) {
      if (resultadoReav !== 'C' && resultadoReav !== 'NC') return Promise.reject(Erro('Reavaliação inválida.'));
      return alterar(id, function (e) {
        var r = resposta(e, itemId);
        if (r.avaliacao !== 'NC') throw Erro('A reavaliação é só para item não conforme.');
        var ult = r.reavaliacoes[r.reavaliacoes.length - 1];
        if (ult && ult.resultado === 'C') throw Erro('Este equipamento já foi liberado na ' + ult.rodada + 'ª reavaliação.');
        if (r.reavaliacoes.length >= cfg.MAX_REAVALIACOES) throw Erro('Já foram feitas as ' + cfg.MAX_REAVALIACOES + ' reavaliações previstas.');
        r.reavaliacoes.push({ rodada: r.reavaliacoes.length + 1, resultado: resultadoReav, em: util.agora() });
      });
    },
    /** Desfaz a última reavaliação (enquanto o checklist não foi enviado). */
    desfazerReavaliacao: function (id, itemId) {
      return alterar(id, function (e) { resposta(e, itemId).reavaliacoes.pop(); });
    },

    /** Anexa a fotografia já preparada (CKL.imagem.processar) ao item. */
    adicionarFoto: function (id, itemId, foto, contexto) {
      return alterar(id, function (e) {
        var r = resposta(e, itemId);
        if (r.fotos.length >= cfg.FOTO.MAX_POR_ITEM) throw Erro('Limite de ' + cfg.FOTO.MAX_POR_ITEM + ' fotos por item.');
        var item = itens(e).filter(function (i) { return i.id === itemId; })[0];
        var f = Object.assign({}, foto, {
          id: util.uuid(), execucaoId: e.id, itemId: itemId, itemOrdem: item ? item.ordem : null, itemTexto: item ? item.texto : '',
          contexto: contexto || 'avaliacao', caminho: null
        });
        r.fotos.push(f.id);
        return [{ colecao: 'fotos', tipo: 'salvar', valor: f }];
      });
    },
    removerFoto: function (id, itemId, fotoId) {
      return alterar(id, function (e) {
        var r = resposta(e, itemId);
        r.fotos = r.fotos.filter(function (x) { return x !== fotoId; });
        return [{ colecao: 'fotos', tipo: 'remover', chave: fotoId }];
      });
    },

    /** Envia (conclui) o checklist. Depois disso ele não muda mais pelo aplicativo. */
    finalizar: function (id) {
      return emOrdem(function () { return repo().execucoes.obter(id); }).then(function (e) {
        var u = exigirEditavel(e);
        var p = pendencias(e);
        if (p.length) { var er = Erro('Ainda há ' + util.plural(p.length, 'pendência', 'pendências') + '. Confira a lista antes de enviar.'); er.pendencias = p; throw er; }
        var res = resultado(e);
        e.resultado = res;
        e.status = res.naoConformes > 0 ? ST.CONCLUIDO_NC : ST.CONCLUIDO;
        e.concluidoEm = util.agora();
        var ncs = CKL.naoConformidades.criarDaExecucao(e, u);
        var ev = H().evento({ entidade: 'execucao', entidadeId: e.id, rotulo: rotulo(e), acao: 'envio', campo: 'Situação',
          valorAnterior: cfg.ROTULO_STATUS[ST.EM_ANDAMENTO], valorNovo: cfg.ROTULO_STATUS[e.status] });
        return gravar(e, ncs.map(function (n) { return { colecao: 'naoConformidades', tipo: 'salvar', valor: n }; }).concat(H().operacoes([ev])))
          .then(function () { CKL.eventos.emitir('nc:alterado'); return e; });
      });
    },

    /** Descarta um checklist iniciado por engano (fica no histórico como descartado). */
    descartar: function (id, motivo) {
      motivo = util.limpar(motivo);
      if (motivo.length < 5) return Promise.reject(Erro('Informe o motivo (mínimo de 5 caracteres).'));
      return emOrdem(function () { return repo().execucoes.obter(id); }).then(function (e) {
        var u = exigirEditavel(e);
        e.status = 'descartado';
        e.descarte = { em: util.agora(), porId: u.id, porNome: u.nome, motivo: motivo };
        var ev = H().evento({ entidade: 'execucao', entidadeId: e.id, rotulo: rotulo(e), acao: 'descarte', motivo: motivo });
        return gravar(e, H().operacoes([ev]));
      });
    },

    /**
     * Correção pelo administrador depois do envio, com motivo obrigatório.
     * mudancas: { cultivarAnterior, proximaCultivar, observacoes, termo, operadorNome,
     *             itens: { <itemId>: { avaliacao, descricao, observacao } } }
     */
    corrigir: function (id, mudancas, motivo) {
      var adm = CKL.auth.exigirAdm();
      motivo = util.limpar(motivo);
      if (motivo.length < 5) return Promise.reject(Erro('Informe o motivo da correção (mínimo de 5 caracteres).'));
      return Promise.all([repo().execucoes.obter(id), CKL.naoConformidades.daExecucao(id)]).then(function (x) {
        var e = x[0], ncsAtuais = x[1];
        if (!e) throw Erro('Checklist não encontrado.');
        if (e.status !== ST.CONCLUIDO && e.status !== ST.CONCLUIDO_NC) throw Erro('Só checklists enviados podem ser corrigidos pelo administrador.');
        var evs = [], campos = [], ops = [];
        function mudou(campo, antes, depois) {
          campos.push(campo);
          evs.push(H().evento({ entidade: 'execucao', entidadeId: e.id, rotulo: rotulo(e), acao: 'correcao', campo: campo, valorAnterior: antes, valorNovo: depois, motivo: motivo }));
        }
        [['cultivarAnterior', 'Cultivar anterior'], ['proximaCultivar', 'Próxima cultivar'], ['observacoes', 'Observações']].forEach(function (c) {
          if (mudancas[c[0]] === undefined) return;
          var v = c[0] === 'observacoes' ? String(mudancas[c[0]] || '').trim() : util.limpar(mudancas[c[0]]);
          if ((e[c[0]] || '') !== v) { mudou(c[1], e[c[0]], v); e[c[0]] = v; }
        });
        if (mudancas.operadorNome !== undefined) {
          var nome = util.limpar(mudancas.operadorNome);
          if (!nome) throw Erro('O nome do operador do local não pode ficar em branco.');
          if (nome !== e.operadorLocal.nome) { mudou('Operador do local', e.operadorLocal.nome, nome); e.operadorLocal.nome = nome; }
        }
        if (mudancas.termo !== undefined && e.modelo.temTermo && mudancas.termo !== e.termo) {
          mudou('Termo de conclusão', cfg.ROTULO_TERMO[e.termo], cfg.ROTULO_TERMO[mudancas.termo]); e.termo = mudancas.termo;
        }
        var u = CKL.auth.usuario();
        Object.keys(mudancas.itens || {}).forEach(function (itemId) {
          var item = itens(e).filter(function (i) { return i.id === itemId; })[0];
          if (!item) return;
          var d = mudancas.itens[itemId], r = resposta(e, itemId), nome = 'Item ' + item.ordem + ' — ' + item.texto;
          if (d.avaliacao && d.avaliacao !== r.avaliacao) {
            mudou(nome + ' (avaliação)', cfg.ROTULO_AVALIACAO[r.avaliacao], cfg.ROTULO_AVALIACAO[d.avaliacao]);
            r.avaliacao = d.avaliacao;
            if (d.avaliacao !== 'NC') r.reavaliacoes = [];
          }
          if (d.descricao !== undefined && util.limpar(d.descricao) !== util.limpar(r.descricao)) { mudou(nome + ' (descrição da NC)', r.descricao, d.descricao); r.descricao = String(d.descricao || ''); }
          if (d.observacao !== undefined && util.limpar(d.observacao) !== util.limpar(r.observacao)) { mudou(nome + ' (observação)', r.observacao, d.observacao); r.observacao = String(d.observacao || ''); }
        });
        if (!evs.length) return e;
        if (r0(e)) throw Erro(r0(e));
        // não conformidades: item que passou a NC ganha registro; item que deixou de ser NC tem a NC encerrada
        var porItem = {};
        ncsAtuais.forEach(function (n) { porItem[n.itemId] = n; });
        CKL.naoConformidades.criarDaExecucao(e, u).forEach(function (n) {
          if (!porItem[n.itemId]) ops.push({ colecao: 'naoConformidades', tipo: 'salvar', valor: Object.assign(n, { origem: 'correcao' }) });
        });
        ncsAtuais.forEach(function (n) {
          var r = e.respostas[n.itemId];
          if ((!r || r.avaliacao !== 'NC') && n.situacao !== cfg.SITUACAO_NC.ENCERRADA) {
            var enc = CKL.naoConformidades.encerramento(n, 'Avaliação do item corrigida pelo administrador: ' + motivo);
            ops.push({ colecao: 'naoConformidades', tipo: 'salvar', valor: enc.nc });
            evs.push(enc.evento);
          }
        });
        e.resultado = resultado(e);
        e.status = e.resultado.naoConformes > 0 ? ST.CONCLUIDO_NC : ST.CONCLUIDO;
        e.correcoes = (e.correcoes || []).concat([{ em: util.agora(), porId: adm.id, porNome: adm.nome, motivo: motivo, campos: campos }]);
        e.alteradoEm = util.agora();
        return repo().lote([{ colecao: 'execucoes', tipo: 'salvar', valor: e }].concat(ops, H().operacoes(evs))).then(function () {
          CKL.eventos.emitir('execucoes:alterado', { id: e.id });
          CKL.eventos.emitir('nc:alterado');
          return e;
        });
      });
      /* a correção não pode deixar o checklist incoerente */
      function r0(e) {
        var faltas = pendencias(e).filter(function (p) { return p.campo !== 'plano'; });
        return faltas.length ? 'A correção deixaria o checklist incompleto: ' + faltas[0].mensagem : '';
      }
    }
  };
})(window);
