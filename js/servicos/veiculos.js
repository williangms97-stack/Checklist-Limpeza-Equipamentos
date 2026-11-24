/* ==========================================================================
   Limpeza de veículos: conferência de descarga e autorização sem vistoria
   --------------------------------------------------------------------------
   Regras validadas com o usuário (docs/ANALISE-VEICULOS.md):
   - Um registro por veículo, preenchido numa tela e enviado de uma vez.
   - Data/hora e responsável automáticos (quem está logado).
   - Conferência: turno sugerido pela hora (Diurno 07:00–18:59); origem BUNGE →
     "fechou o peso?" = Não se aplica; qualquer NÃO exige observação e fica
     destacado no painel (não abre não conformidade).
   - Autorização: placa, motorista, cultivar anterior, motivo (livre ou do cadastro)
     e assinatura obrigatória de quem está logado.
   - Placa: formato antigo (ABC-1234) ou Mercosul (ABC1D23); fora disso só avisa.
   - Fotos opcionais. Depois de enviado, só o administrador corrige (com motivo).
   - Rascunho fica só no aparelho; vai para a fila de envio ao ser enviado.
   ========================================================================== */
(function (global) {
  'use strict';
  var CKL = global.CKL;
  var util = CKL.util, cfg = CKL.config;
  var ST = cfg.STATUS;
  var repo = function () { return CKL.repo; };
  var Erro = function (m) { return CKL.auth.Erro(m); };
  var H = function () { return CKL.historico; };
  var F = function () { return CKL.formulariosVeiculos; };

  var TIPOS = ['conferencia', 'autorizacao'];
  var SIM_NAO = ['SIM', 'NAO'];
  var CAMPOS = {
    conferencia: ['turno', 'placa', 'origem', 'identificacaoRetirada', 'descarregadoCompleto', 'fechouPeso', 'observacao'],
    autorizacao: ['placa', 'motorista', 'cultivarAnterior', 'motivo', 'motivoDoCadastro']
  };
  var ROTULO_RESPOSTA = { SIM: 'SIM', NAO: 'NÃO', NA: 'Não se aplica (Bunge)' };
  var ROTULO_TURNO = { diurno: 'Diurno', noturno: 'Noturno' };

  function copia(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- Placa ---------- */
  function compactar(p) { return String(p || '').toUpperCase().replace(/[\s-]/g, ''); }
  function placaValida(p) { var s = compactar(p); return /^[A-Z]{3}\d{4}$/.test(s) || /^[A-Z]{3}\d[A-Z]\d{2}$/.test(s); }
  function formatarPlaca(p) {
    var s = compactar(p);
    if (/^[A-Z]{3}\d{4}$/.test(s)) return s.slice(0, 3) + '-' + s.slice(3);
    if (/^[A-Z]{3}\d[A-Z]\d{2}$/.test(s)) return s;
    return util.limpar(p).toUpperCase();
  }

  /** Diurno das 07:00 às 18:59; Noturno das 19:00 às 06:59 (decisão V2). */
  function turnoSugerido(d) { var h = (d ? new Date(d) : new Date()).getHours(); return h >= 7 && h < 19 ? 'diurno' : 'noturno'; }

  function novoProtocolo(tipo) {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return (tipo === 'autorizacao' ? 'AUT-' : 'VEI-') + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + util.codigoCurto(4);
  }

  function rotulo(v) { return (v.tipo === 'autorizacao' ? 'Autorização sem vistoria' : 'Conferência de descarga') + ' · ' + (v.placa || 'sem placa') + ' · ' + util.fmtDataHora(v.dataHora); }

  /** Respostas NÃO da conferência (destaque no painel; exigem observação). */
  function alertas(v) {
    if (v.tipo !== 'conferencia') return [];
    var l = [];
    if (v.identificacaoRetirada === 'NAO') l.push('Identificação de caçamba não retirada');
    if (v.descarregadoCompleto === 'NAO') l.push('Veículo não descarregado por completo');
    if (v.fechouPeso === 'NAO') l.push('Veículo não fechou o peso');
    return l;
  }

  function pendencias(v) {
    var p = [], R = (F()[v.tipo] || {}).rotulos || {};
    function falta(campo, msg) { p.push({ campo: campo, mensagem: msg }); }
    if (!util.limpar(v.placa)) falta('placa', 'Informe a placa.');
    if (v.tipo === 'conferencia') {
      if (!v.turno) falta('turno', 'Marque o turno.');
      if (!v.origem) falta('origem', 'Marque a origem do veículo.');
      if (!v.identificacaoRetirada) falta('identificacaoRetirada', 'Responda: ' + R.identificacaoRetirada);
      if (!v.descarregadoCompleto) falta('descarregadoCompleto', 'Responda: ' + R.descarregadoCompleto);
      if (!v.fechouPeso) falta('fechouPeso', 'Responda: ' + R.fechouPeso);
      if (alertas(v).length && !util.limpar(v.observacao)) falta('observacao', 'Escreva a observação: há resposta NÃO.');
    } else {
      if (!util.limpar(v.motorista)) falta('motorista', 'Informe o nome do motorista.');
      if (!util.limpar(v.cultivarAnterior)) falta('cultivarAnterior', 'Informe a cultivar anterior.');
      if (!util.limpar(v.motivo)) falta('motivo', 'Informe o motivo da autorização.');
      if (!v.assinatura || !v.assinatura.imagem) falta('assinatura', 'Assine na tela (assinatura do responsável).');
    }
    return p;
  }

  function exigirEditavel(v) {
    var u = CKL.auth.exigirLogin();
    if (!v) throw Erro('Registro não encontrado.');
    if (v.status !== ST.EM_ANDAMENTO) throw Erro('Este registro já foi enviado e não pode mais ser alterado pelo aplicativo.');
    if (v.responsavelId !== u.id) throw Erro('Este registro pertence a outro usuário.');
    return u;
  }

  function gravar(v, extras, enfileirar) {
    v.alteradoEm = util.agora();
    var fila = enfileirar ? CKL.sincronizacao.opsFila(v, { colecao: 'veiculos', rotulo: rotulo(v) }) : Promise.resolve([]);
    return fila.then(function (opsFila) {
      return repo().loteLocal([{ colecao: 'veiculos', tipo: 'salvar', valor: v }].concat(extras || [], opsFila));
    }).then(function () {
      CKL.eventos.emitir('veiculos:alterado', { id: v.id });
      if (enfileirar) CKL.sincronizacao.processarDepois();
      return v;
    });
  }

  /* gravações em sequência, na ordem dos toques (como nos checklists) */
  var cadeia = Promise.resolve();
  function emOrdem(fn) { var p = cadeia.then(fn); cadeia = p.catch(function () {}); return p; }
  function alterar(id, fn) {
    return emOrdem(function () {
      return repo().veiculos.obter(id).then(function (v) {
        exigirEditavel(v);
        var extras = fn(v) || [];
        return gravar(v, extras, false);
      });
    });
  }

  function aplicarCampos(v, d) {
    CAMPOS[v.tipo].forEach(function (c) {
      if (d[c] === undefined) return;
      var x = d[c];
      if (c === 'placa') v.placa = String(x || '').toUpperCase().slice(0, 12);
      else if (c === 'turno') { if (x && !ROTULO_TURNO[x]) throw Erro('Turno inválido.'); v.turno = x || null; }
      else if (c === 'origem') {
        if (x && !F().conferencia.origens.some(function (o) { return o.valor === x; })) throw Erro('Origem inválida.');
        v.origem = x || null;
        // Bunge: não é necessário o fechamento de peso (nota do documento)
        if (x === 'BUNGE') v.fechouPeso = 'NA';
        else if (v.fechouPeso === 'NA') v.fechouPeso = null;
      }
      else if (c === 'identificacaoRetirada' || c === 'descarregadoCompleto') {
        if (x && SIM_NAO.indexOf(x) < 0) throw Erro('Resposta inválida.');
        v[c] = x || null;
      }
      else if (c === 'fechouPeso') {
        if (v.origem === 'BUNGE') { v.fechouPeso = 'NA'; return; }
        if (x && SIM_NAO.indexOf(x) < 0) throw Erro('Resposta inválida.');
        v.fechouPeso = x || null;
      }
      else if (c === 'motivoDoCadastro') v.motivoDoCadastro = !!x;
      else if (c === 'observacao' || c === 'motivo') v[c] = String(x || '').slice(0, cfg.TEXTO_MAXIMO);
      else v[c] = util.limpar(x).slice(0, 120);
    });
  }

  var veiculos = CKL.veiculos = {
    TIPOS: TIPOS,
    ROTULO_RESPOSTA: ROTULO_RESPOSTA,
    ROTULO_TURNO: ROTULO_TURNO,
    rotulo: rotulo,
    alertas: alertas,
    pendencias: pendencias,
    placaValida: placaValida,
    formatarPlaca: formatarPlaca,
    turnoSugerido: turnoSugerido,
    formulario: function (tipo) { return F()[tipo]; },

    obter: function (id) { return repo().veiculos.obter(id); },
    listar: function () {
      return repo().veiculos.listar().then(function (l) { return l.sort(function (a, b) { return a.dataHora < b.dataHora ? 1 : -1; }); });
    },
    meus: function () {
      var u = CKL.auth.usuario();
      return veiculos.listar().then(function (l) { return l.filter(function (v) { return u && v.responsavelId === u.id; }); });
    },
    fotosDe: function (id) { return repo().fotos.porIndice('execucaoId', id); },

    /** Abre um registro novo (rascunho no aparelho). */
    iniciar: function (tipo) {
      var u = CKL.auth.exigirLogin();
      if (TIPOS.indexOf(tipo) < 0) return Promise.reject(Erro('Formulário inválido.'));
      var agora = util.agora(), doc = copia(F()[tipo]);
      var v = {
        id: util.uuid(), tipo: tipo, protocolo: novoProtocolo(tipo),
        // cópia do cabeçalho vigente: mudanças posteriores no painel não alteram este registro
        documento: { titulo: doc.titulo, identificacao: doc.identificacao, cabecalho: doc.cabecalho, pagina: doc.pagina,
          versaoDocumento: doc.versaoDocumento || '', elaboradoPor: doc.elaboradoPor, revisadoPor: doc.revisadoPor,
          aprovadoPor: doc.aprovadoPor, aprovadoEm: doc.aprovadoEm || '' },
        dataHora: agora, dataRegistro: util.dataLocal(), alteradoEm: agora, concluidoEm: null,
        responsavelId: u.id, responsavelNome: u.nome, responsavelUsuario: u.usuario,
        status: ST.EM_ANDAMENTO,
        placa: '', placaConferir: false, fotos: [],
        correcoes: [], situacaoEnvio: null, erroEnvio: null
      };
      if (tipo === 'conferencia') Object.assign(v, { observacao: '', turno: turnoSugerido(), origem: null, identificacaoRetirada: null, descarregadoCompleto: null, fechouPeso: null });
      else Object.assign(v, { motorista: '', cultivarAnterior: '', motivo: '', motivoDoCadastro: false, assinatura: null });
      return emOrdem(function () { return gravar(v, [], false); });
    },

    definir: function (id, d) { return alterar(id, function (v) { aplicarCampos(v, d || {}); }); },

    assinar: function (id, imagem) {
      return alterar(id, function (v) {
        if (v.tipo !== 'autorizacao') throw Erro('Este formulário não tem assinatura.');
        v.assinatura = imagem ? { imagem: imagem, em: util.agora(), porId: v.responsavelId, porNome: v.responsavelNome } : null;
      });
    },

    adicionarFoto: function (id, foto) {
      return alterar(id, function (v) {
        if ((v.fotos || []).length >= cfg.FOTO.MAX_POR_ITEM) throw Erro('Limite de ' + cfg.FOTO.MAX_POR_ITEM + ' fotos por registro.');
        var f = Object.assign({}, foto, { id: util.uuid(), execucaoId: v.id, itemId: 'veiculo', itemOrdem: null, itemTexto: 'Veículo', contexto: 'veiculo', caminho: null });
        v.fotos = (v.fotos || []).concat([f.id]);
        return [{ colecao: 'fotos', tipo: 'salvar', valor: f }];
      });
    },
    removerFoto: function (id, fotoId) {
      return alterar(id, function (v) {
        v.fotos = (v.fotos || []).filter(function (x) { return x !== fotoId; });
        return [{ colecao: 'fotos', tipo: 'remover', chave: fotoId }];
      });
    },

    /** Envia o registro: depois disso não muda mais pelo aplicativo. */
    finalizar: function (id) {
      return emOrdem(function () {
        return repo().veiculos.obter(id).then(function (v) {
          exigirEditavel(v);
          var p = pendencias(v);
          if (p.length) { var er = Erro('Ainda há ' + util.plural(p.length, 'pendência', 'pendências') + '. Confira antes de enviar.'); er.pendencias = p; throw er; }
          v.placa = formatarPlaca(v.placa);
          v.placaConferir = !placaValida(v.placa);
          v.alertas = alertas(v);
          v.status = ST.CONCLUIDO;
          v.concluidoEm = util.agora();
          v.situacaoEnvio = cfg.SITUACAO_ENVIO.AGUARDANDO;
          var ev = H().evento({ entidade: 'veiculo', entidadeId: v.id, rotulo: rotulo(v), acao: 'envio', campo: 'Situação',
            valorAnterior: cfg.ROTULO_STATUS[ST.EM_ANDAMENTO], valorNovo: cfg.ROTULO_STATUS[ST.CONCLUIDO] });
          return gravar(v, H().operacoes([ev]), true);
        });
      });
    },

    /** Apaga um rascunho que ainda não foi enviado (nunca saiu do aparelho). */
    descartarRascunho: function (id) {
      return emOrdem(function () {
        return repo().veiculos.obter(id).then(function (v) {
          exigirEditavel(v);
          var ops = [{ colecao: 'veiculos', tipo: 'remover', chave: v.id }].concat((v.fotos || []).map(function (f) { return { colecao: 'fotos', tipo: 'remover', chave: f }; }));
          return repo().loteLocal(ops).then(function () { CKL.eventos.emitir('veiculos:alterado', { id: v.id }); });
        });
      });
    },

    /**
     * Correção pelo administrador (registro enviado), com motivo obrigatório.
     * mudancas: os mesmos campos do formulário (a assinatura não é corrigida).
     */
    corrigir: function (id, mudancas, motivo) {
      var adm = CKL.auth.exigirAdm();
      motivo = util.limpar(motivo);
      if (motivo.length < 5) return Promise.reject(Erro('Informe o motivo da correção (mínimo de 5 caracteres).'));
      return repo().veiculos.obter(id).then(function (v) {
        if (!v) throw Erro('Registro não encontrado.');
        if (v.status !== ST.CONCLUIDO) throw Erro('Só registros enviados podem ser corrigidos pelo administrador.');
        var antes = copia(v), R = F()[v.tipo].rotulos;
        aplicarCampos(v, mudancas || {});
        if (mudancas && mudancas.placa !== undefined) { v.placa = formatarPlaca(v.placa); v.placaConferir = !placaValida(v.placa); }
        var falta = pendencias(v);
        if (falta.length) throw Erro('A correção deixaria o registro incompleto: ' + falta[0].mensagem);
        function texto(c, x) {
          if (c === 'turno') return ROTULO_TURNO[x] || '';
          if (['identificacaoRetirada', 'descarregadoCompleto', 'fechouPeso'].indexOf(c) >= 0) return ROTULO_RESPOSTA[x] || '';
          if (c === 'motivoDoCadastro') return null;
          return x || '';
        }
        var evs = [], campos = [];
        CAMPOS[v.tipo].forEach(function (c) {
          var a = texto(c, antes[c]), d = texto(c, v[c]);
          if (a === null || a === d) return;
          var nome = R[c] || (c === 'observacao' ? 'Observação' : c);
          campos.push(nome);
          evs.push(H().evento({ entidade: 'veiculo', entidadeId: v.id, rotulo: rotulo(v), acao: 'correcao', campo: nome, valorAnterior: a, valorNovo: d, motivo: motivo }));
        });
        if (!evs.length) return v;
        v.alertas = alertas(v);
        v.correcoes = (v.correcoes || []).concat([{ em: util.agora(), porId: adm.id, porNome: adm.nome, motivo: motivo, campos: campos }]);
        v.alteradoEm = util.agora();
        return repo().lote([{ colecao: 'veiculos', tipo: 'salvar', valor: v }].concat(H().operacoes(evs))).then(function () {
          CKL.eventos.emitir('veiculos:alterado', { id: v.id });
          return v;
        });
      });
    }
  };
})(window);
