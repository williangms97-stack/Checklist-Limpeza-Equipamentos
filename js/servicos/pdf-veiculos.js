/* ==========================================================================
   PDF da limpeza de veículos (decisão V10)
   --------------------------------------------------------------------------
   - gerar(id): um registro (A4 retrato), com cabeçalho do documento, campos,
     nota/orientação, assinatura, fotografias e correções.
   - periodo(lista, tipo, descricao): folha deitada no formato da planilha, um
     veículo por linha (Planilha2 da conferência / aba Registro da autorização).
   ========================================================================== */
(function (global) {
  'use strict';
  var CKL = global.CKL;
  var util = CKL.util, cfg = CKL.config;
  var Erro = function (m) { return CKL.auth.Erro(m); };
  var B = function () { return CKL.pdf.base; };
  var V = function () { return CKL.veiculos; };
  var M = 12;

  function medidas(doc) { var w = doc.internal.pageSize.getWidth(), h = doc.internal.pageSize.getHeight(); return { L: w, A: h, U: w - 2 * M }; }

  /** Cabeçalho do documento original (logo, título e quadro de identificação). */
  function cabecalho(doc, d, subtitulo) {
    var b = B(), t = b.t, COR = b.COR, md = medidas(doc), h = 30, y = M, caixa = 58;
    b.cor(doc, 'linha', COR.linha); doc.setLineWidth(0.3);
    doc.rect(M, y, md.U, h);
    var lw = 38, lh = lw * CKL.recursos.logoAltura / CKL.recursos.logoLargura;
    doc.addImage(CKL.recursos.logo, 'PNG', M + 3, y + (h - lh) / 2, lw, lh, 'logo', 'FAST');
    doc.line(M + 44, y, M + 44, y + h);
    doc.line(md.L - M - caixa, y, md.L - M - caixa, y + h);
    var cx = M + 44 + (md.U - 44 - caixa) / 2;
    b.fonte(doc, true, 9.5); b.cor(doc, 'texto', COR.tinta2);
    doc.text(t(d.cabecalho), cx, y + 8, { align: 'center' });
    b.fonte(doc, true, 12.5); b.cor(doc, 'texto', COR.tinta);
    doc.text(doc.splitTextToSize(t(d.titulo), md.U - 44 - caixa - 6), cx, y + 16, { align: 'center' });
    if (subtitulo) { b.fonte(doc, false, 8.5); b.cor(doc, 'texto', COR.tinta3); doc.text(t(subtitulo), cx, y + h - 3.5, { align: 'center' }); }
    var linhas = [['Identificação:', d.identificacao], ['Página:', d.pagina], ['Elaborado por:', d.elaboradoPor], ['Revisado por:', d.revisadoPor], ['Aprovado por:', d.aprovadoPor]];
    var x0 = md.L - M - caixa + 2.5, yy = y + 5.5;
    linhas.forEach(function (l) {
      b.fonte(doc, true, 7.8); b.cor(doc, 'texto', COR.tinta2); doc.text(t(l[0]), x0, yy);
      b.fonte(doc, false, 7.8); b.cor(doc, 'texto', COR.tinta); doc.text(t(l[1] || '—'), x0 + 21, yy);
      yy += 5.2;
    });
    return y + h + 5;
  }

  function rodapes(doc) {
    var b = B(), md = medidas(doc), n = doc.getNumberOfPages();
    for (var i = 1; i <= n; i++) {
      doc.setPage(i);
      b.fonte(doc, false, 7.5); b.cor(doc, 'texto', b.COR.tinta3);
      doc.text(b.t(cfg.EMPRESA + ' · ' + cfg.NOME_SISTEMA + ' · relatório gerado em ' + util.fmtDataHora(util.agora())), M, md.A - 7);
      doc.text(b.t('Página ' + i + ' de ' + n), md.L - M, md.A - 7, { align: 'right' });
    }
  }

  function textoParagrafo(doc, p, texto, tam, corTxt, negrito) {
    var b = B(), md = medidas(doc);
    b.fonte(doc, !!negrito, tam); b.cor(doc, 'texto', corTxt || b.COR.tinta);
    var linhas = doc.splitTextToSize(b.t(texto), md.U), lh = b.alturaLinha(tam);
    linhas.forEach(function (l) { p.espaco(lh + 1); doc.text(l, M, p.y + lh * 0.8); p.y += lh; });
    p.y += 1.5;
  }

  function Cursor(doc, d, sub) {
    var self = this;
    this.y = 0;
    this.nova = function () { if (self.y) doc.addPage(); self.y = cabecalho(doc, d, sub); };
    this.espaco = function (h) { if (self.y + h > medidas(doc).A - 14) { self.nova(); return true; } return false; };
  }

  function respostas(v) {
    var R = V().formulario(v.tipo).rotulos, RR = V().ROTULO_RESPOSTA;
    return v.tipo === 'conferencia'
      ? [[R.dataHora, util.fmtDataHora(v.dataHora)], [R.turno, V().ROTULO_TURNO[v.turno]], [R.placa, v.placa + (v.placaConferir ? ' (formato a conferir)' : '')],
        [R.origem, v.origem], [R.identificacaoRetirada, RR[v.identificacaoRetirada]], [R.descarregadoCompleto, RR[v.descarregadoCompleto]],
        [R.grupoPeso + ' — ' + R.fechouPeso, RR[v.fechouPeso]], [R.responsavel, v.responsavelNome], [R.observacao, v.observacao || '—']]
      : [[R.dataHora, util.fmtDataHora(v.dataHora)], [R.placa, v.placa + (v.placaConferir ? ' (formato a conferir)' : '')], [R.motorista, v.motorista],
        [R.cultivarAnterior, v.cultivarAnterior], [R.motivo, v.motivo], ['Responsável', v.responsavelNome]];
  }

  /* ---------- Registro individual ---------- */
  function montarRegistro(v, fotos) {
    var b = B(), t = b.t, COR = b.COR, doc = b.novoDocumento('portrait'), md = medidas(doc);
    var d = v.documento || V().formulario(v.tipo), F = V().formulario(v.tipo);
    var p = new Cursor(doc, d, 'Protocolo ' + v.protocolo);
    p.nova();
    if (v.tipo === 'conferencia') {
      textoParagrafo(doc, p, F.nota, 8.6, COR.tinta, true);
      textoParagrafo(doc, p, F.orientacao, 8, COR.tinta2);
      p.y += 2;
    }
    var alertas = v.alertas || V().alertas(v);
    if (alertas.length) {
      p.espaco(8 + alertas.length * 4.5);
      b.cor(doc, 'fundo', COR.ncFundo); doc.rect(M, p.y, md.U, 4 + alertas.length * 4.5, 'F');
      b.fonte(doc, true, 9); b.cor(doc, 'texto', COR.nc);
      alertas.forEach(function (a, i) { doc.text(t('NÃO: ' + a), M + 3, p.y + 4.6 + i * 4.5); });
      p.y += 7 + alertas.length * 4.5;
    }
    // campos: rótulo à esquerda, valor à direita
    var col = 78, lh = b.alturaLinha(9);
    respostas(v).forEach(function (par) {
      b.fonte(doc, false, 9);
      var val = doc.splitTextToSize(t(par[1] || '—'), md.U - col - 4);
      b.fonte(doc, true, 8.6);
      var rot = doc.splitTextToSize(t(par[0]), col - 4);
      var h = Math.max(val.length, rot.length) * lh + 3;
      p.espaco(h);
      b.cor(doc, 'linha', COR.linhaClara); doc.setLineWidth(0.2); doc.line(M, p.y + h, M + md.U, p.y + h);
      b.fonte(doc, true, 8.6); b.cor(doc, 'texto', COR.tinta2); rot.forEach(function (l, i) { doc.text(l, M + 1.5, p.y + lh * (i + 0.8) + 1.2); });
      var vermelho = /NÃO$/.test(par[1] || '') && par[1] !== 'NÃO se aplica';
      b.fonte(doc, false, 9); b.cor(doc, 'texto', vermelho ? COR.nc : COR.tinta); val.forEach(function (l, i) { doc.text(l, M + col, p.y + lh * (i + 0.8) + 1.2); });
      p.y += h;
    });
    p.y += 4;
    if (v.tipo === 'autorizacao') {
      p.espaco(34);
      b.fonte(doc, true, 8.6); b.cor(doc, 'texto', COR.tinta2); doc.text(t(F.rotulos.assinatura), M + 1.5, p.y + 3);
      b.cor(doc, 'linha', COR.linha); doc.rect(M, p.y + 5, 80, 24);
      if (v.assinatura && v.assinatura.imagem) { try { doc.addImage(v.assinatura.imagem, 'PNG', M + 2, p.y + 6, 76, 22, 'ass', 'FAST'); } catch (e) { /* imagem inválida */ } }
      b.fonte(doc, false, 8); b.cor(doc, 'texto', COR.tinta3);
      doc.text(t(v.responsavelNome + (v.assinatura ? ' · assinado na tela em ' + util.fmtDataHora(v.assinatura.em) : '')), M + 1.5, p.y + 33);
      p.y += 38;
    }
    if ((v.correcoes || []).length) {
      textoParagrafo(doc, p, 'Correções do administrador', 9.5, COR.verde, true);
      v.correcoes.forEach(function (c) { textoParagrafo(doc, p, util.fmtDataHora(c.em) + ' · ' + c.porNome + ': ' + c.campos.join(', ') + ' — motivo: ' + c.motivo, 8.4, COR.tinta2); });
    }
    // fotografias, duas por linha
    var usadas = (v.fotos || []).map(function (id) { return fotos.filter(function (f) { return f.id === id; })[0]; }).filter(Boolean);
    if (usadas.length) {
      p.espaco(20);
      textoParagrafo(doc, p, 'Fotografias (' + usadas.length + ')', 9.5, COR.verde, true);
      var largF = (md.U - 6) / 2, altMax = 74;
      for (var k = 0; k < usadas.length; k += 2) {
        p.espaco(altMax + 10);
        usadas.slice(k, k + 2).forEach(function (f, j) {
          var x = M + j * (largF + 6), w = largF, h = w * f.altura / f.largura;
          if (h > altMax) { h = altMax; w = h * f.largura / f.altura; }
          b.cor(doc, 'linha', COR.linha); doc.rect(x, p.y, largF, altMax);
          if (f.dados) doc.addImage(new Uint8Array(f.dados), 'JPEG', x + (largF - w) / 2, p.y + (altMax - h) / 2, w, h, 'foto-' + f.id, 'MEDIUM');
          else { b.fonte(doc, false, 8); b.cor(doc, 'texto', COR.tinta3); doc.text(t('Fotografia não disponível neste aparelho'), x + largF / 2, p.y + altMax / 2, { align: 'center' }); }
          b.fonte(doc, false, 7.6); b.cor(doc, 'texto', COR.tinta2); doc.text(t(util.fmtDataHora(f.capturadaEm)), x, p.y + altMax + 3.6);
        });
        p.y += altMax + 8;
      }
    }
    rodapes(doc);
    return doc;
  }

  /* ---------- Folha do período (como a planilha) ---------- */
  function colunas(tipo, U) {
    var F = V().formulario(tipo), R = F.rotulos, RR = V().ROTULO_RESPOSTA;
    if (tipo === 'conferencia') {
      return [
        { r: R.dataHora, w: 25, v: function (x) { return util.fmtDataHora(x.dataHora); } },
        { r: R.turno, w: 17, v: function (x) { return V().ROTULO_TURNO[x.turno]; } },
        { r: R.placa, w: 22, v: function (x) { return x.placa + (x.placaConferir ? ' (?)' : ''); } },
        { r: R.origem, w: 22, v: function (x) { return x.origem; } },
        { r: R.identificacaoRetirada, w: 29, v: function (x) { return RR[x.identificacaoRetirada]; }, nao: 'identificacaoRetirada' },
        { r: R.descarregadoCompleto, w: 29, v: function (x) { return RR[x.descarregadoCompleto]; }, nao: 'descarregadoCompleto' },
        { r: R.grupoPeso + ' — ' + R.fechouPeso, w: 31, v: function (x) { return RR[x.fechouPeso]; }, nao: 'fechouPeso' },
        { r: R.responsavel, w: 36, v: function (x) { return x.responsavelNome; } },
        { r: R.observacao, w: U - 211, v: function (x) { return x.observacao || ''; } }
      ];
    }
    return [
      { r: R.dataHora, w: 27, v: function (x) { return util.fmtDataHora(x.dataHora); } },
      { r: R.placa, w: 24, v: function (x) { return x.placa + (x.placaConferir ? ' (?)' : ''); } },
      { r: R.motorista, w: 48, v: function (x) { return x.motorista; } },
      { r: R.cultivarAnterior, w: 44, v: function (x) { return x.cultivarAnterior; } },
      { r: R.motivo, w: U - 27 - 24 - 48 - 44 - 52, v: function (x) { return x.motivo; } },
      { r: R.assinatura, w: 52, assinatura: true, v: function (x) { return x.responsavelNome; } }
    ];
  }

  function montarPeriodo(lista, tipo, descricao) {
    var b = B(), t = b.t, COR = b.COR, doc = b.novoDocumento('landscape'), md = medidas(doc);
    var F = V().formulario(tipo), p = new Cursor(doc, F, descricao), cols = colunas(tipo, md.U), lh = b.alturaLinha(8);
    p.nova();
    if (tipo === 'conferencia') {
      textoParagrafo(doc, p, F.nota, 8.2, COR.tinta, true);
      textoParagrafo(doc, p, F.orientacao, 7.8, COR.tinta2);
      p.y += 1;
    }
    function topoTabela() {
      b.fonte(doc, true, 7.6);
      var alturas = cols.map(function (c) { return doc.splitTextToSize(t(c.r), c.w - 2).length; });
      var h = Math.max.apply(null, alturas) * b.alturaLinha(7.6) + 3;
      p.espaco(h + 8);
      b.cor(doc, 'fundo', COR.verdeClaro); doc.rect(M, p.y, md.U, h, 'F');
      var x = M;
      cols.forEach(function (c) {
        b.cor(doc, 'texto', COR.tinta);
        doc.splitTextToSize(t(c.r), c.w - 2).forEach(function (l, i) { doc.text(l, x + 1, p.y + b.alturaLinha(7.6) * (i + 0.8) + 1.2); });
        b.cor(doc, 'linha', COR.linha); doc.line(x, p.y, x, p.y + h);
        x += c.w;
      });
      doc.line(M + md.U, p.y, M + md.U, p.y + h);
      doc.rect(M, p.y, md.U, h);
      p.y += h;
    }
    topoTabela();
    if (!lista.length) { textoParagrafo(doc, p, 'Nenhum registro no período.', 9, COR.tinta3); }
    lista.forEach(function (x) {
      b.fonte(doc, false, 8);
      var celulas = cols.map(function (c) { return doc.splitTextToSize(t(c.v(x) || ''), c.w - 2); });
      var h = Math.max.apply(null, celulas.map(function (l) { return l.length; })) * lh + 3;
      if (tipo === 'autorizacao') h = Math.max(h, 16);
      if (p.espaco(h)) topoTabela();
      var xx = M;
      cols.forEach(function (c, i) {
        b.cor(doc, 'linha', COR.linhaClara); doc.setLineWidth(0.2); doc.line(xx, p.y, xx, p.y + h);
        if (c.assinatura && x.assinatura && x.assinatura.imagem) {
          try { doc.addImage(x.assinatura.imagem, 'PNG', xx + 1, p.y + 0.8, c.w - 2, h - 6, 'ass-' + x.id, 'FAST'); } catch (e) { /* imagem inválida */ }
          b.fonte(doc, false, 6.8); b.cor(doc, 'texto', COR.tinta3); doc.text(t(x.responsavelNome), xx + 1, p.y + h - 1.4);
        } else {
          var nao = c.nao && x[c.nao] === 'NAO';
          b.fonte(doc, nao, 8); b.cor(doc, 'texto', nao ? COR.nc : COR.tinta);
          celulas[i].forEach(function (l, k) { doc.text(l, xx + 1, p.y + lh * (k + 0.8) + 1.2); });
        }
        xx += c.w;
      });
      b.cor(doc, 'linha', COR.linhaClara); doc.line(M + md.U, p.y, M + md.U, p.y + h); doc.line(M, p.y + h, M + md.U, p.y + h);
      p.y += h;
    });
    rodapes(doc);
    return doc;
  }

  CKL.pdfVeiculos = {
    gerar: function (id) {
      return CKL.pdf.carregar().then(function () {
        return Promise.all([V().obter(id), V().fotosDe(id).catch(function () { return []; })]);
      }).then(function (r) {
        var v = r[0];
        if (!v) throw Erro('Registro não encontrado.');
        var doc = montarRegistro(v, r[1] || []);
        var nome = util.nomeArquivoSeguro((v.tipo === 'conferencia' ? 'Conferencia veiculo ' : 'Autorizacao veiculo ') + (v.placa || '') + ' ' + v.dataRegistro + ' ' + v.protocolo) + '.pdf';
        return { blob: doc.output('blob'), nome: nome };
      });
    },
    /** lista: registros já filtrados (do mais antigo para o mais recente fica como na planilha). */
    periodo: function (lista, tipo, descricao) {
      return CKL.pdf.carregar().then(function () {
        var ordem = lista.slice().sort(function (a, b) { return a.dataHora < b.dataHora ? -1 : 1; });
        var doc = montarPeriodo(ordem, tipo, descricao);
        var nome = util.nomeArquivoSeguro((tipo === 'conferencia' ? 'Conferencias de veiculos ' : 'Autorizacoes sem vistoria ') + util.dataLocal()) + '.pdf';
        return { blob: doc.output('blob'), nome: nome };
      });
    }
  };
})(window);
