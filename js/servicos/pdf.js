/* ==========================================================================
   Relatório individual do checklist (PDF, A4 retrato, jsPDF)
   --------------------------------------------------------------------------
   Segue o documento original: cabeçalho (identificação, versão, elaborado/revisado/
   aprovado), orientação, informações relevantes, avaliação e reavaliação de cada
   item, termo de conclusão (UBS), assinaturas, observações e plano de ação.
   Depois: não conformidades em destaque, fotografias por item e correções.
   ========================================================================== */
(function (global) {
  'use strict';
  var CKL = global.CKL;
  var util = CKL.util, cfg = CKL.config;
  var Erro = function (m) { return CKL.auth.Erro(m); };

  var LARG = 210, ALT = 297, M = 12, UTIL = LARG - 2 * M;
  var COR = {
    tinta: [33, 41, 37], tinta2: [78, 90, 84], tinta3: [120, 130, 124], linha: [190, 200, 194], linhaClara: [222, 228, 224],
    verde: [2, 101, 72], verdeClaro: [226, 241, 233], amarelo: [246, 216, 42],
    nc: [180, 35, 24], ncFundo: [253, 236, 234], ns: [96, 108, 102], nsFundo: [236, 239, 237], okFundo: [232, 244, 237], alertaFundo: [255, 246, 214]
  };

  /** Mantém apenas caracteres presentes nas fontes embutidas (Latin-1). */
  function t(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—−]/g, '-')
      .replace(/…/g, '...').replace(/•/g, '-').replace(/[  ]/g, ' ')
      .replace(/[^\n -ÿ]/g, '?');
  }
  function cor(doc, tipo, c) {
    if (tipo === 'texto') doc.setTextColor(c[0], c[1], c[2]);
    else if (tipo === 'fundo') doc.setFillColor(c[0], c[1], c[2]);
    else doc.setDrawColor(c[0], c[1], c[2]);
  }
  function fonte(doc, negrito, tam) { doc.setFont('BarlowCondensed', negrito ? 'bold' : 'normal'); doc.setFontSize(tam); }
  function alturaLinha(tam) { return tam * 0.3528 * 1.18; }

  function novoDocumento() {
    if (!global.jspdf || !global.jspdf.jsPDF) throw Erro('Biblioteca de PDF não carregada.');
    var doc = new global.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    doc.addFileToVFS('BarlowCondensed-Bold.ttf', CKL.fontesPdf.negrito);
    doc.addFont('BarlowCondensed-Bold.ttf', 'BarlowCondensed', 'bold');
    doc.addFileToVFS('BarlowCondensed-Medium.ttf', CKL.fontesPdf.medio);
    doc.addFont('BarlowCondensed-Medium.ttf', 'BarlowCondensed', 'normal');
    return doc;
  }

  /* ---------- Página: cabeçalho e cursor vertical ---------- */
  function Pagina(doc, e) {
    var self = this;
    this.doc = doc; this.e = e; this.y = 0;
    this.nova = function () {
      if (self.y) doc.addPage();
      cabecalho(doc, e);
      self.y = 44;
    };
    /** Garante espaço; se não couber, abre outra página. */
    this.espaco = function (h) { if (self.y + h > ALT - 14) { self.nova(); return true; } return false; };
  }

  function cabecalho(doc, e) {
    var m = e.modelo, h = 34, y = M;
    cor(doc, 'linha', COR.linha); doc.setLineWidth(0.3);
    doc.rect(M, y, UTIL, h);
    // logomarca (arquivo original, proporção preservada)
    var lw = 40, lh = lw * CKL.recursos.logoAltura / CKL.recursos.logoLargura;
    doc.addImage(CKL.recursos.logo, 'PNG', M + 3, y + (h - lh) / 2, lw, lh, 'logo', 'FAST');
    doc.line(M + 46, y, M + 46, y + h);
    doc.line(LARG - M - 56, y, LARG - M - 56, y + h);
    // título
    var cx = M + 46 + (UTIL - 46 - 56) / 2;
    fonte(doc, true, 9.5); cor(doc, 'texto', COR.tinta2);
    doc.text(t(m.cabecalho || 'CHECK LIST / SISTEMA DE GESTÃO DA QUALIDADE'), cx, y + 9, { align: 'center' });
    fonte(doc, true, 13); cor(doc, 'texto', COR.tinta);
    var tit = doc.splitTextToSize(t(m.titulo || ('LIMPEZA DE EQUIPAMENTOS - ' + e.nome)), UTIL - 46 - 56 - 6);
    doc.text(tit, cx, y + 19, { align: 'center' });
    fonte(doc, false, 8.5); cor(doc, 'texto', COR.tinta3);
    doc.text(t('Protocolo ' + e.protocolo), cx, y + h - 4, { align: 'center' });
    // quadro de identificação do documento
    var linhas = [['Identificação:', m.identificacao], ['Versão:', m.versaoDocumento], ['Elaborado por:', m.elaboradoPor],
      ['Revisado por:', m.revisadoPor], ['Aprovado por:', m.aprovadoPor], ['Aprovado em:', util.fmtData(m.aprovadoEm)], ['Versão do modelo:', String(e.versaoModelo || 1)]];
    var x0 = LARG - M - 55, yy = y + 4.6;
    linhas.forEach(function (l) {
      fonte(doc, true, 7.6); cor(doc, 'texto', COR.tinta2); doc.text(t(l[0]), x0, yy);
      fonte(doc, false, 7.6); cor(doc, 'texto', COR.tinta); doc.text(t(l[1] || '—'), x0 + 22, yy);
      yy += 4.25;
    });
  }

  function rodapes(doc) {
    var n = doc.getNumberOfPages();
    for (var i = 1; i <= n; i++) {
      doc.setPage(i);
      fonte(doc, false, 7.5); cor(doc, 'texto', COR.tinta3);
      doc.text(t(cfg.EMPRESA + ' · ' + cfg.NOME_SISTEMA + ' · relatório gerado em ' + util.fmtDataHora(util.agora())), M, ALT - 7);
      doc.text(t('Página ' + i + ' de ' + n), LARG - M, ALT - 7, { align: 'right' });
    }
  }

  /* ---------- Blocos ---------- */
  function tituloSecao(p, texto) {
    p.espaco(12);
    var doc = p.doc;
    cor(doc, 'fundo', COR.verde); doc.rect(M, p.y, UTIL, 6.2, 'F');
    fonte(doc, true, 9.5); cor(doc, 'texto', [255, 255, 255]);
    doc.text(t(texto.toUpperCase()), M + 2.5, p.y + 4.3);
    p.y += 8.4;
  }

  function paragrafo(p, texto, op) {
    op = op || {};
    var doc = p.doc, tam = op.tam || 8.6, larg = op.largura || UTIL, x = op.x || M;
    fonte(doc, !!op.negrito, tam); cor(doc, 'texto', op.cor || COR.tinta);
    var linhas = doc.splitTextToSize(t(texto), larg), lh = alturaLinha(tam);
    linhas.forEach(function (l) { p.espaco(lh + 1); doc.text(l, x, p.y + lh * 0.8); p.y += lh; });
    p.y += op.depois === undefined ? 1.5 : op.depois;
  }

  /** Grade de pares "rótulo: valor" em colunas. */
  function grade(p, pares, colunas) {
    var doc = p.doc, larg = UTIL / colunas, lh = alturaLinha(8.4);
    for (var i = 0; i < pares.length; i += colunas) {
      var grupo = pares.slice(i, i + colunas), altura = 0;
      var blocos = grupo.map(function (par) {
        fonte(doc, false, 8.4);
        var v = doc.splitTextToSize(t(par[1] || '—'), larg - 3);
        altura = Math.max(altura, 3.4 + v.length * lh);
        return v;
      });
      p.espaco(altura + 2);
      grupo.forEach(function (par, k) {
        var x = M + k * larg;
        fonte(doc, true, 7.2); cor(doc, 'texto', COR.tinta3); doc.text(t(par[0].toUpperCase()), x, p.y + 2.6);
        fonte(doc, false, 8.4); cor(doc, 'texto', par[2] || COR.tinta);
        blocos[k].forEach(function (l, j) { doc.text(l, x, p.y + 3.4 + lh * (j + 0.8)); });
      });
      p.y += altura + 2;
    }
  }

  function textoAvaliacao(a) { return a ? (a === 'NS' ? 'Não solicitado' : a) : '—'; }

  /* ---------- Tabela de avaliação dos itens ---------- */
  function tabelaItens(p, e) {
    var doc = p.doc;
    var col = [{ r: 'Nº', w: 8 }, { r: 'Itens a serem avaliados', w: 62 }, { r: 'Avaliação', w: 19 }, { r: 'Data/Hora', w: 22 },
      { r: 'Reavaliação (em caso de NC no item)', w: 49 }, { r: 'Situação final', w: UTIL - 160 }];
    function topo() {
      cor(doc, 'fundo', COR.verdeClaro); doc.rect(M, p.y, UTIL, 7, 'F');
      fonte(doc, true, 7.6); cor(doc, 'texto', COR.tinta);
      var x = M;
      col.forEach(function (c) { doc.text(t(c.r), x + 1.5, p.y + 4.6); x += c.w; });
      p.y += 7;
    }
    topo();
    var secaoAtual = null;
    CKL.execucoes.itens(e).forEach(function (i) {
      var r = e.respostas[i.id] || {}, fin = CKL.execucoes.situacaoFinal(r);
      if (i.secao && i.secao !== secaoAtual) {
        secaoAtual = i.secao;
        if (p.espaco(14)) topo();
        fonte(doc, true, 8.2); cor(doc, 'texto', COR.verde);
        doc.text(t(i.secao), M + 1.5, p.y + 4.4); p.y += 6;
      }
      fonte(doc, false, 8.2);
      var nome = doc.splitTextToSize(t(i.texto), col[1].w - 3);
      var reav = (r.reavaliacoes || []).map(function (x) { return x.rodada + 'ª: ' + x.resultado + ' · ' + util.fmtDataHora(x.em); });
      var extras = [];
      if (r.avaliacao === 'NC' && r.descricao) extras.push('Descrição da NC: ' + r.descricao);
      if (r.observacao) extras.push('Observação: ' + r.observacao);
      var fotos = (r.fotos || []).length;
      if (fotos) extras.push(util.plural(fotos, 'fotografia anexada', 'fotografias anexadas') + ' (ver Fotografias)');
      fonte(doc, false, 7.6);
      var extrasL = extras.length ? doc.splitTextToSize(t(extras.join('  ·  ')), UTIL - col[0].w - 4) : [];
      var lh = alturaLinha(8.2), lhx = alturaLinha(7.6);
      var h = Math.max(nome.length, reav.length || 1) * lh + 2.6 + (extrasL.length ? extrasL.length * lhx + 1.2 : 0);
      if (p.espaco(h)) topo();
      var fundoLinha = r.avaliacao === 'NC' ? COR.ncFundo : r.avaliacao === 'NS' ? COR.nsFundo : null;
      if (fundoLinha) { cor(doc, 'fundo', fundoLinha); doc.rect(M, p.y, UTIL, h, 'F'); }
      cor(doc, 'linha', COR.linhaClara); doc.setLineWidth(0.2); doc.line(M, p.y + h, M + UTIL, p.y + h);
      var y0 = p.y + lh * 0.8 + 1, x = M;
      fonte(doc, true, 8.2); cor(doc, 'texto', COR.tinta); doc.text(String(i.ordem), x + 1.5, y0); x += col[0].w;
      fonte(doc, false, 8.2); nome.forEach(function (l, k) { doc.text(l, x + 1.5, y0 + k * lh); }); x += col[1].w;
      fonte(doc, true, 8.2); cor(doc, 'texto', r.avaliacao === 'NC' ? COR.nc : r.avaliacao === 'NS' ? COR.ns : COR.tinta);
      doc.text(t(textoAvaliacao(r.avaliacao)), x + 1.5, y0); x += col[2].w;
      fonte(doc, false, 8); cor(doc, 'texto', COR.tinta2); doc.text(t(r.em ? util.fmtDataHora(r.em) : '—'), x + 1.5, y0); x += col[3].w;
      cor(doc, 'texto', COR.tinta);
      (reav.length ? reav : [r.avaliacao === 'NC' ? 'Sem reavaliação' : '—']).forEach(function (l, k) { doc.text(t(l), x + 1.5, y0 + k * lh); }); x += col[4].w;
      fonte(doc, true, 8.2); cor(doc, 'texto', fin === 'NC' ? COR.nc : COR.tinta);
      var rod = CKL.execucoes.rodadaLiberacao(r);
      doc.text(t(fin === 'NC' ? 'NC - não liberado' : rod ? 'Liberado na ' + rod + 'ª' : textoAvaliacao(fin)), x + 1.5, y0);
      if (extrasL.length) {
        fonte(doc, false, 7.6); cor(doc, 'texto', COR.tinta2);
        var ye = p.y + Math.max(nome.length, reav.length || 1) * lh + 2.2;
        extrasL.forEach(function (l, k) { doc.text(l, M + col[0].w + 1.5, ye + lhx * (k + 0.8)); });
      }
      p.y += h;
    });
    p.y += 3;
  }

  /* ---------- Fotografias ---------- */
  function fotografias(p, e, fotos) {
    if (!fotos.length) return;
    var doc = p.doc;
    p.nova();
    tituloSecao(p, 'Fotografias anexadas (' + fotos.length + ')');
    var ordem = {};
    CKL.execucoes.itens(e).forEach(function (i) { ordem[i.id] = i.ordem; });
    fotos.sort(function (a, b) { return (ordem[a.itemId] || 0) - (ordem[b.itemId] || 0) || (a.capturadaEm < b.capturadaEm ? -1 : 1); });
    var largF = (UTIL - 6) / 2, altMax = 74;
    for (var k = 0; k < fotos.length; k += 2) {
      var par = fotos.slice(k, k + 2);
      p.espaco(altMax + 14);
      var alturaLinhaFotos = 0;
      par.forEach(function (f, j) {
        var x = M + j * (largF + 6);
        var w = largF, h = w * f.altura / f.largura;
        if (h > altMax) { h = altMax; w = h * f.largura / f.altura; }
        cor(doc, 'linha', COR.linha); doc.setLineWidth(0.2); doc.rect(x, p.y, largF, altMax + 0.01);
        if (f.dados) doc.addImage(new Uint8Array(f.dados), 'JPEG', x + (largF - w) / 2, p.y + (altMax - h) / 2, w, h, 'foto-' + f.id, 'MEDIUM');
        else { fonte(doc, false, 8); cor(doc, 'texto', COR.tinta3); doc.text(t('Fotografia não disponível neste aparelho'), x + largF / 2, p.y + altMax / 2, { align: 'center' }); }
        var item = CKL.execucoes.itens(e).filter(function (i) { return i.id === f.itemId; })[0];
        var leg = 'Item ' + (item ? item.ordem + ' — ' + item.texto : (f.itemTexto || '')) + ' · ' +
          (f.contexto === 'reavaliacao' ? 'reavaliação' : 'avaliação') + ' · ' + util.fmtDataHora(f.capturadaEm);
        fonte(doc, false, 7.6); cor(doc, 'texto', COR.tinta2);
        var l = doc.splitTextToSize(t(leg), largF);
        doc.text(l, x, p.y + altMax + 3.6);
        alturaLinhaFotos = Math.max(alturaLinhaFotos, altMax + 3.6 + l.length * alturaLinha(7.6));
      });
      p.y += alturaLinhaFotos + 5;
    }
  }

  /* ---------- Documento ---------- */
  function montar(e, fotos, ncs) {
    var doc = novoDocumento(), p = new Pagina(doc, e), m = e.modelo, res = e.resultado || CKL.execucoes.resultado(e);
    p.nova();

    tituloSecao(p, 'Identificação do checklist');
    var final = m.temTermo ? (e.termo ? 'UBS ' + cfg.ROTULO_TERMO[e.termo] : '—')
      : res.naoLiberados ? res.naoLiberados + ' equipamento(s) não liberado(s)' : (res.avaliados === res.total ? 'Todos os equipamentos liberados' : '—');
    grade(p, [
      ['Empresa', cfg.EMPRESA], ['Área', e.area], ['Checklist', e.nome + ' (' + e.identificacao + ')'],
      ['Data da execução', util.fmtData(e.dataExecucao)], ['Horário de início', util.fmtDataHora(e.iniciadoEm)], ['Horário de conclusão', e.concluidoEm ? util.fmtDataHora(e.concluidoEm) : 'Não concluído'],
      ['Responsável pela vistoria', e.responsavelNome], ['Operador do local', e.operadorLocal && e.operadorLocal.nome], ['Status', cfg.ROTULO_STATUS[e.status]],
      ['Resultado final', final, res.naoLiberados || e.termo === cfg.TERMO.NAO_LIBERADA ? COR.nc : COR.tinta],
      ['Itens avaliados', res.avaliados + ' de ' + res.total], ['C / NC / Não solicitado', res.conformes + ' / ' + res.naoConformes + ' / ' + res.naoSolicitados]
    ], 3);

    tituloSecao(p, 'Orientação');
    (m.orientacao || []).forEach(function (o) { paragrafo(p, o, { tam: 8, cor: COR.tinta2, depois: 0.6 }); });
    p.y += 1.5;

    tituloSecao(p, 'Informações relevantes');
    grade(p, [['Cultivar anterior', e.cultivarAnterior], ['Próxima cultivar', e.proximaCultivar]], 2);

    tituloSecao(p, 'Avaliação');
    tabelaItens(p, e);
    if (m.notaReavaliacao) paragrafo(p, m.notaReavaliacao, { tam: 7.8, cor: COR.tinta3 });
    paragrafo(p, 'Reavaliação: ' + (res.rodadaLiberacao ? 'liberado na ' + res.rodadaLiberacao + 'ª reavaliação' : res.naoConformes ? (res.naoLiberados ? 'equipamento(s) não liberado(s) após as reavaliações' : '—') : 'não houve item NC'), { tam: 8.6, negrito: true });

    if (m.temTermo) {
      tituloSecao(p, 'Termo de conclusão da inspeção');
      var termo = (m.termoConclusao || '').replace('( ) Liberada', '(' + (e.termo === cfg.TERMO.LIBERADA ? 'X' : '  ') + ') Liberada')
        .replace('( ) Não Liberada', '(' + (e.termo === cfg.TERMO.NAO_LIBERADA ? 'X' : '  ') + ') Não Liberada');
      paragrafo(p, termo, { tam: 9 });
    }

    tituloSecao(p, 'Assinaturas');
    p.espaco(30);
    var doc2 = doc, meio = M + UTIL / 2, ya = p.y;
    var ass = e.operadorLocal && e.operadorLocal.assinatura;
    if (ass) { try { doc2.addImage(ass, 'PNG', meio + 6, ya, 60, 20, 'assinatura', 'FAST'); } catch (er) { /* imagem inválida */ } }
    cor(doc2, 'linha', COR.linha); doc2.setLineWidth(0.3);
    doc2.line(M + 4, ya + 21, meio - 8, ya + 21); doc2.line(meio + 4, ya + 21, M + UTIL - 4, ya + 21);
    fonte(doc2, false, 9); cor(doc2, 'texto', COR.tinta);
    doc2.text(t(e.responsavelNome + ' (usuário ' + (e.responsavelUsuario || '—') + ')'), M + 4, ya + 18);
    fonte(doc2, true, 7.6); cor(doc2, 'texto', COR.tinta3);
    doc2.text(t('RESPONSÁVEL PELA VISTORIA · identificado pelo acesso ao sistema'), M + 4, ya + 25);
    doc2.text(t('OPERADOR DO PONTO: ' + ((e.operadorLocal && e.operadorLocal.nome) || '—') + (ass ? ' · assinado na tela' + (e.operadorLocal.assinadoEm ? ' em ' + util.fmtDataHora(e.operadorLocal.assinadoEm) : '') : ' · sem assinatura')), meio + 4, ya + 25);
    p.y = ya + 30;

    tituloSecao(p, (m.rotuloObservacoes || 'Observações').replace(/:$/, ''));
    paragrafo(p, e.observacoes || 'Sem observações.', { cor: e.observacoes ? COR.tinta : COR.tinta3 });

    // não conformidades e plano de ação (um por item NC)
    var listaNc = CKL.execucoes.itens(e).filter(function (i) { var r = e.respostas[i.id]; return r && r.avaliacao === 'NC'; });
    tituloSecao(p, 'Plano de ação em caso de não conformidade' + (listaNc.length ? ' (' + listaNc.length + ')' : ''));
    if (!listaNc.length) paragrafo(p, 'Nenhuma não conformidade registrada neste checklist.', { cor: COR.tinta3 });
    var porItem = {};
    (ncs || []).forEach(function (n) { porItem[n.itemId] = n; });
    listaNc.forEach(function (i) {
      var r = e.respostas[i.id], n = porItem[i.id], pl = (n && n.plano) || r.plano || {};
      p.espaco(30);
      cor(doc, 'fundo', COR.ncFundo); doc.rect(M, p.y, UTIL, 6, 'F');
      fonte(doc, true, 8.8); cor(doc, 'texto', COR.nc);
      doc.text(t('Item ' + i.ordem + ' — ' + i.texto), M + 2, p.y + 4.2);
      var sit = n ? (n.situacao === cfg.SITUACAO_NC.ENCERRADA ? 'NC encerrada' : 'NC aberta') : 'NC';
      doc.text(t(sit), M + UTIL - 2, p.y + 4.2, { align: 'right' });
      p.y += 7.5;
      var rod = CKL.execucoes.rodadaLiberacao(r);
      grade(p, [
        ['Data de aplicação do Check List', util.fmtData(e.dataExecucao)], ['Registrada em', util.fmtDataHora(r.em)], ['Responsável pelo registro', e.responsavelNome],
        ['Descrição da NC', r.descricao], ['Reavaliações', (r.reavaliacoes || []).map(function (x) { return x.rodada + 'ª ' + x.resultado; }).join(', ') || 'Nenhuma'],
        ['Situação do equipamento', rod ? 'Liberado na ' + rod + 'ª reavaliação' : 'Não liberado'],
        ['O que será feito?', pl.oQue], ['Como?', pl.como], ['Quem?', pl.quem],
        ['Data prevista de conclusão', pl.dataPrevista ? util.fmtData(pl.dataPrevista) : ''],
        n && n.encerramento ? ['Encerramento', util.fmtDataHora(n.encerramento.em) + ' · ' + n.encerramento.porNome + ' · ' + n.encerramento.comentario] : null
      ].filter(Boolean), 3);
      p.y += 1;
    });

    if (e.correcoes && e.correcoes.length) {
      tituloSecao(p, 'Correções feitas pelo administrador');
      e.correcoes.forEach(function (c) {
        paragrafo(p, util.fmtDataHora(c.em) + ' · ' + c.porNome + ' · ' + c.campos.join('; ') + ' · Motivo: ' + c.motivo, { tam: 8.2 });
      });
    }
    if (e.descarte) {
      tituloSecao(p, 'Checklist descartado');
      paragrafo(p, util.fmtDataHora(e.descarte.em) + ' · ' + e.descarte.porNome + ' · Motivo: ' + e.descarte.motivo);
    }

    fotografias(p, e, fotos);
    rodapes(doc);
    return doc;
  }

  CKL.pdf = {
    gerar: function (execucaoId) {
      return CKL.util.exigirBiblioteca('pdf', function () { return !!(global.jspdf && CKL.fontesPdf); }).then(function () {
        return Promise.all([CKL.execucoes.obter(execucaoId), CKL.execucoes.fotosDe(execucaoId).catch(function () { return []; }), CKL.naoConformidades.daExecucao(execucaoId)]);
      }).then(function (r) {
        var e = r[0];
        if (!e) throw Erro('Checklist não encontrado.');
        var doc = montar(e, r[1] || [], r[2] || []);
        var nome = util.nomeArquivoSeguro('Checklist ' + e.nome + ' ' + e.dataExecucao + ' ' + e.protocolo) + '.pdf';
        return { blob: doc.output('blob'), nome: nome };
      });
    }
  };
})(window);
