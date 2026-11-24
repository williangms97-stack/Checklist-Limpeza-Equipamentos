/* ==========================================================================
   Peças compartilhadas do painel: filtros, linha do tempo, janela do checklist
   (com GERAR PDF) e correção pelo administrador
   ========================================================================== */
(function (global) {
  'use strict';
  const CKL = global.CKL;
  const { ui, util, config: cfg } = CKL;
  const { html, icone } = ui;
  const adm = CKL.telas.adm;
  const ST = cfg.STATUS;

  /**
   * Aviso "cadastros só neste computador": confere com o servidor e, se faltar algo
   * lá (modelos criados quando o sistema ainda não tinha servidor), oferece o envio.
   */
  adm.avisoCadastrosLocais = function (alvo) {
    const CL = CKL.nuvem && CKL.nuvem.ativa && CKL.nuvem.cadastrosLocais;
    if (!alvo || !CL) return;
    CL.conferir().then((faltam) => {
      const resumo = CL.resumo(faltam);
      if (!resumo || !alvo.isConnected) { alvo.innerHTML = ''; return; }
      alvo.innerHTML = String(html`
        <div class="alerta alerta-erro">${icone('alerta', 20)}<div>
          <strong>Há cadastros só neste computador: ${resumo}.</strong>
          <p>Eles foram criados quando o sistema ainda funcionava sem servidor e não chegaram ao banco central. Por isso os celulares não os recebem
            (por exemplo, os checklists de UBS e secador não aparecem no aplicativo). Envie para o servidor; nada é apagado.</p>
          <button type="button" class="btn btn-primario" data-acao-local="enviar">${icone('upload', 18)}<span>Enviar para o servidor</span></button>
        </div></div>`);
      alvo.querySelector('[data-acao-local="enviar"]').addEventListener('click', (ev) => {
        ui.ocupar(ev.currentTarget, () => CL.enviar(faltam)).then((n) => {
          ui.aviso(util.plural(n, 'registro enviado', 'registros enviados') + ' ao servidor. Os celulares recebem na próxima sincronização.', 'ok', 8000);
          adm.avisoCadastrosLocais(alvo);
        }).catch(ui.erro);
      });
    }).catch((e) => console.warn('[cadastros locais]', e && e.message));
  };

  /** Linha do tempo de eventos de auditoria. */
  adm.eventosHtml = function (eventos) {
    if (!eventos.length) return html`<p class="texto-menor">Nenhuma alteração registrada.</p>`;
    return html`
      <ol class="linha-tempo">
        ${eventos.map((e) => html`
          <li>
            <div class="lt-topo"><strong>${CKL.historico.ROTULO_ACAO[e.acao] || e.acao}</strong><span>${util.fmtDataHora(e.dataHora)} · ${e.usuarioNome}</span></div>
            ${e.campo ? html`<p>${e.campo}: ${e.valorAnterior !== null ? html`<s>${e.valorAnterior}</s> → ` : ''}<b>${e.valorNovo === null ? '—' : e.valorNovo}</b></p>` : ''}
            ${e.motivo ? html`<p class="texto-menor">Motivo: ${e.motivo}</p>` : ''}
          </li>`)}
      </ol>`;
  };

  /* ---------------- Filtros (painel e lista de checklists) ---------------- */
  adm.filtrosPadrao = () => ({ de: '', ate: '', area: '', modelo: '', equipamento: '', colaborador: '', status: '' });

  adm.filtrosHtml = function (F, modelos, execucoes, prefixo) {
    const areas = CKL.modelos.areas(modelos).map((a) => ({ valor: a.id, rotulo: a.rotulo }));
    const doFiltro = modelos.filter((m) => !F.area || m.area === F.area).map((m) => ({ valor: m.id, rotulo: m.nome + ' (' + m.identificacao + ')' }));
    const colaboradores = util.unicos(execucoes.map((e) => e.responsavelNome)).map((n) => ({ valor: n, rotulo: n }));
    const status = [ST.EM_ANDAMENTO, ST.CONCLUIDO, ST.CONCLUIDO_NC, ST.DESCARTADO].map((s) => ({ valor: s, rotulo: cfg.ROTULO_STATUS[s] }));
    const p = prefixo;
    return html`
      <section class="filtros" aria-label="Filtros">
        <div class="campo"><label for="${p}-de">De</label><input type="date" id="${p}-de" data-filtro="de" value="${F.de}"></div>
        <div class="campo"><label for="${p}-ate">Até</label><input type="date" id="${p}-ate" data-filtro="ate" value="${F.ate}"></div>
        <div class="campo"><label for="${p}-area">Área</label><select id="${p}-area" data-filtro="area">${ui.opcoes(areas, F.area, 'Todas')}</select></div>
        <div class="campo"><label for="${p}-modelo">UBS / secador</label><select id="${p}-modelo" data-filtro="modelo">${ui.opcoes(doFiltro, F.modelo, 'Todos')}</select></div>
        <div class="campo campo-largo"><label for="${p}-equip">Equipamento</label><input type="search" id="${p}-equip" data-filtro="equipamento" value="${F.equipamento}" placeholder="Ex.: Elevador PMS, Moega, Silo 1" autocomplete="off"></div>
        <div class="campo"><label for="${p}-colab">Colaborador</label><select id="${p}-colab" data-filtro="colaborador">${ui.opcoes(colaboradores, F.colaborador, 'Todos')}</select></div>
        <div class="campo"><label for="${p}-status">Status</label><select id="${p}-status" data-filtro="status">${ui.opcoes(status, F.status, 'Todos (sem descartados)')}</select></div>
      </section>`;
  };

  /** Liga os campos de filtro: aoMudar() é chamado depois de cada alteração. */
  adm.ligarFiltros = function (el, F, aoMudar) {
    const mudar = (ev) => {
      const k = ev.target.dataset && ev.target.dataset.filtro;
      if (!k) return;
      F[k] = ev.target.value;
      if (k === 'area') F.modelo = '';
      aoMudar(k);
    };
    el.addEventListener('change', (ev) => { if (ev.target.type !== 'search') mudar(ev); });
    el.addEventListener('input', util.debounce((ev) => { if (ev.target.type === 'search') mudar(ev); }, 250));
  };

  /** Itens do checklist cujo texto combina com o filtro de equipamento. */
  adm.itensDoEquipamento = (e, termo) => CKL.execucoes.itens(e).filter((i) => util.contem(i.texto, termo));

  adm.aplicarFiltros = function (lista, F) {
    return lista.filter((e) => {
      if (F.status ? e.status !== F.status : e.status === ST.DESCARTADO) return false;
      if (F.de && e.dataExecucao < F.de) return false;
      if (F.ate && e.dataExecucao > F.ate) return false;
      if (F.area && e.area !== F.area) return false;
      if (F.modelo && e.modeloId !== F.modelo) return false;
      if (F.colaborador && e.responsavelNome !== F.colaborador) return false;
      if (F.equipamento && !adm.itensDoEquipamento(e, F.equipamento).length) return false;
      return true;
    });
  };

  /* ---------------- Janela do checklist ---------------- */
  function linhaItem(e, i, fotosPorId, termo) {
    const r = e.respostas[i.id] || {}, fin = CKL.execucoes.situacaoFinal(r), rod = CKL.execucoes.rodadaLiberacao(r);
    const fotos = (r.fotos || []).map((id) => fotosPorId[id]).filter(Boolean);
    const destaque = termo && util.contem(i.texto, termo);
    return html`
      <tr class="${r.avaliacao === 'NC' ? 'ck-linha-nc' : ''} ${destaque ? 'ck-linha-destaque' : ''}">
        <td class="num">${i.ordem}</td>
        <td>${i.secao ? html`<small class="texto-menor">${i.secao}</small><br>` : ''}${i.texto}
          ${r.descricao ? html`<div class="texto-menor"><strong>NC:</strong> ${r.descricao}</div>` : ''}
          ${r.observacao ? html`<div class="texto-menor"><strong>Obs.:</strong> ${r.observacao}</div>` : ''}
          ${fotos.length ? html`<div class="ck-fotos-lista">${fotos.map((f) => html`<button type="button" class="ck-mini" data-acao="foto" data-foto-id="${f.id}" aria-label="Ver fotografia do item ${i.ordem}"><img src="${f.miniatura}" alt=""></button>`)}</div>` : ''}</td>
        <td>${ui.seloAvaliacao(r.avaliacao, true)}</td>
        <td class="nowrap">${r.em ? util.fmtDataHora(r.em) : '—'}</td>
        <td>${(r.reavaliacoes || []).length ? (r.reavaliacoes || []).map((x) => html`<div class="nowrap">${x.rodada}ª: <strong>${x.resultado}</strong> · ${util.fmtDataHora(x.em)}</div>`) : '—'}</td>
        <td>${fin === 'NC' ? ui.seloSimples('Não liberado', 'selo-cancelada', 'x') : rod ? ui.seloSimples('Liberado na ' + rod + 'ª', 'selo-registrada', 'check') : ui.seloAvaliacao(fin, true)}</td>
      </tr>`;
  }

  adm.abrirExecucao = function (id, op) {
    op = op || {};
    const urls = ui.GerenteUrls();
    const m = ui.modal({ titulo: 'Checklist', largura: 'xg', conteudo: html`<p class="texto-menor">Carregando…</p>`, aoFechar: () => urls.liberar() });
    let fotos = [];

    function carregar() {
      return Promise.all([CKL.execucoes.obter(id), CKL.execucoes.fotosDe(id).catch(() => []), CKL.historico.daEntidade('execucao', id), CKL.naoConformidades.daExecucao(id)]).then((r) => {
        const e = r[0], ev = r[2], ncs = r[3];
        fotos = r[1] || [];
        if (!e) { m.definirConteudo(html`<p>Checklist não encontrado.</p>`); return; }
        m.el.querySelector('.modal-topo h2').textContent = e.nome + ' · ' + util.fmtData(e.dataExecucao);
        const res = e.resultado || CKL.execucoes.resultado(e), mod = e.modelo;
        const porId = {};
        fotos.forEach((f) => { porId[f.id] = f; });
        let secao = null;
        m.definirConteudo(html`
          <div class="ck-detalhe">
            <div class="registro-topo">
              <div><span class="texto-menor">${e.area} · ${e.identificacao} · protocolo ${e.protocolo}</span><strong>${e.nome}</strong></div>
              <div class="registro-selos">
                ${ui.seloStatus(e.status)}${ui.seloEnvio(e.situacaoEnvio)}
                ${e.correcoes && e.correcoes.length ? ui.seloSimples('Corrigido pelo administrador', 'selo-info', 'editar') : ''}
              </div>
            </div>
            ${e.descarte ? html`<div class="alerta alerta-neutro">${icone('anular', 20)}<div><strong>Checklist descartado</strong><p>${util.fmtDataHora(e.descarte.em)} · ${e.descarte.porNome} · ${e.descarte.motivo}</p></div></div>` : ''}
            <div class="resumo-linha">
              <div><span>Itens avaliados</span><strong>${res.avaliados} / ${res.total}</strong></div>
              <div><span>Conformes (C)</span><strong>${res.conformes}</strong></div>
              <div class="${res.naoConformes ? 'ck-tem-nc' : ''}"><span>Não conformes (NC)</span><strong>${res.naoConformes}</strong></div>
              <div><span>Não solicitados</span><strong>${res.naoSolicitados}</strong></div>
              <div><span>${mod.temTermo ? 'Termo de conclusão' : 'Equipamentos não liberados'}</span><strong>${mod.temTermo ? (cfg.ROTULO_TERMO[e.termo] || '—') : res.naoLiberados}</strong></div>
            </div>
            ${ui.dados([
              ['Data', util.fmtData(e.dataExecucao)], ['Início', util.fmtDataHora(e.iniciadoEm)], ['Conclusão', e.concluidoEm ? util.fmtDataHora(e.concluidoEm) : 'Em andamento'],
              ['Responsável pela vistoria', e.responsavelNome], ['Operador do ponto', e.operadorLocal && e.operadorLocal.nome],
              ['Cultivar anterior', e.cultivarAnterior], ['Próxima cultivar', e.proximaCultivar],
              ['Versão do documento / modelo', (mod.versaoDocumento || '—') + ' / ' + (e.versaoModelo || 1)],
              ['Reavaliação', res.rodadaLiberacao ? 'Liberado na ' + res.rodadaLiberacao + 'ª reavaliação' : res.naoConformes ? '—' : 'Não houve NC'],
              e.observacoes ? { rotulo: 'Observações', valor: e.observacoes, largo: true } : null
            ], 'dados-3col')}
            ${e.operadorLocal && e.operadorLocal.assinatura ? html`<figure class="ck-assinatura-vista"><img src="${e.operadorLocal.assinatura}" alt="Assinatura do operador do ponto"><figcaption>Assinatura de ${e.operadorLocal.nome}${e.operadorLocal.assinadoEm ? ' · ' + util.fmtDataHora(e.operadorLocal.assinadoEm) : ''}</figcaption></figure>` : ''}
            <div class="registro-acoes">
              <button type="button" class="btn btn-primario" data-acao="pdf">${icone('pdf', 18)}<span>GERAR PDF</span></button>
              ${CKL.auth.ehAdm() && (e.status === ST.CONCLUIDO || e.status === ST.CONCLUIDO_NC) ? html`<button type="button" class="btn btn-secundario" data-acao="corrigir">${icone('editar', 18)}<span>Corrigir</span></button>` : ''}
            </div>
            <h3 class="secao-titulo">Avaliação dos itens</h3>
            <div class="tabela-rolagem cartao cartao-tabela">
              <table class="tabela tabela-compacta ck-tabela-itens">
                <thead><tr><th class="num">Nº</th><th>Item</th><th>Avaliação</th><th>Data/Hora</th><th>Reavaliação</th><th>Situação final</th></tr></thead>
                <tbody>${CKL.execucoes.itens(e).map((i) => {
                  const cab = i.secao && i.secao !== secao ? html`<tr class="ck-linha-secao"><td></td><td colspan="5">${i.secao}</td></tr>` : '';
                  secao = i.secao || secao;
                  return html`${cab}${linhaItem(e, i, porId, op.destacar)}`;
                })}</tbody>
              </table>
            </div>
            ${ncs.length ? html`
              <h3 class="secao-titulo">Não conformidades e planos de ação</h3>
              <div class="ck-ncs">${ncs.sort((a, b) => a.itemOrdem - b.itemOrdem).map((n) => html`
                <button type="button" class="ck-nc-cartao ${n.situacao === 'encerrada' ? 'encerrada' : ''}" data-acao="nc" data-nc="${n.id}">
                  <span class="selos">${ui.seloNc(n.situacao)}${CKL.naoConformidades.atrasada(n) ? ui.seloSimples('Atrasada', 'selo-pendente', 'relogio') : ''}</span>
                  <strong>Item ${n.itemOrdem} — ${n.itemTexto}</strong>
                  <span>${n.descricao || 'Sem descrição'}</span>
                  <small>Quem: ${(n.plano && n.plano.quem) || '—'} · Prevista: ${n.plano && n.plano.dataPrevista ? util.fmtData(n.plano.dataPrevista) : '—'}</small>
                </button>`)}</div>` : ''}
            ${e.correcoes && e.correcoes.length ? html`<h3 class="secao-titulo">Correções</h3>
              <ul class="linha-tempo">${e.correcoes.map((c) => html`<li><div class="lt-topo"><strong>${c.campos.join('; ')}</strong><span>${util.fmtDataHora(c.em)} · ${c.porNome}</span></div><p class="texto-menor">Motivo: ${c.motivo}</p></li>`)}</ul>` : ''}
            <h3 class="secao-titulo">Histórico</h3>
            ${adm.eventosHtml(ev)}
          </div>`);
        m.corpo.onclick = (evt) => {
          const b = evt.target.closest('[data-acao]');
          if (!b) return;
          if (b.dataset.acao === 'pdf') ui.gerarPdf(e.id, b);
          else if (b.dataset.acao === 'corrigir') abrirCorrecao(e, carregar);
          else if (b.dataset.acao === 'nc') adm.abrirNc(b.dataset.nc, carregar);
          else if (b.dataset.acao === 'foto') {
            const f = fotos.filter((x) => x.id === b.dataset.fotoId)[0];
            if (f) ui.modal({ titulo: 'Item ' + f.itemOrdem + ' — ' + f.itemTexto, largura: 'g',
              conteudo: html`<img class="registro-foto" src="${urls.daFoto(f)}" alt="Fotografia do equipamento"><p class="texto-menor">${f.contexto === 'reavaliacao' ? 'Reavaliação' : 'Avaliação'} · ${util.fmtDataHora(f.capturadaEm)} · ${f.largura}×${f.altura} px</p>` });
          }
        };
      }).catch(ui.erro);
    }
    carregar();
    return m;
  };

  /** Correção do checklist pelo administrador (motivo obrigatório; tudo vai para o histórico). */
  function abrirCorrecao(e, aoSalvar) {
    return CKL.cultivares.opcoes([e.cultivarAnterior, e.proximaCultivar]).then((cultivares) => formularioCorrecao(e, cultivares, aoSalvar)).catch(ui.erro);
  }
  function formularioCorrecao(e, cultivares, aoSalvar) {
    const opcoes = cfg.AVALIACOES.map((a) => ({ valor: a, rotulo: cfg.ROTULO_AVALIACAO[a] }));
    const m = ui.modal({
      titulo: 'Corrigir checklist: ' + e.nome, largura: 'g',
      conteudo: html`
        <form id="form-correcao" class="formulario" novalidate>
          <p class="texto-menor">Altere só o que precisa ser corrigido. Cada campo alterado fica no histórico com o valor anterior, o novo, quem corrigiu e o motivo.
          Se um item deixar de ser NC, a não conformidade dele é encerrada automaticamente com o motivo da correção; se passar a NC, uma nova é aberta.</p>
          <div class="formulario-linha">
            ${ui.campoCultivar('co-ant', 'Cultivar anterior', e.cultivarAnterior, cultivares)}
            ${ui.campoCultivar('co-prox', 'Próxima cultivar', e.proximaCultivar, cultivares)}
            <div class="campo"><label for="co-oper">Operador do ponto</label><input id="co-oper" value="${(e.operadorLocal && e.operadorLocal.nome) || ''}" maxlength="120"></div>
            ${e.modelo.temTermo ? html`<div class="campo"><label for="co-termo">Termo de conclusão</label><select id="co-termo">${ui.opcoes([{ valor: 'liberada', rotulo: 'Liberada' }, { valor: 'nao_liberada', rotulo: 'Não Liberada' }], e.termo)}</select></div>` : ''}
          </div>
          <div class="campo"><label for="co-obs">Observações</label><textarea id="co-obs" rows="2">${e.observacoes || ''}</textarea></div>
          <div class="tabela-rolagem"><table class="tabela tabela-compacta">
            <thead><tr><th class="num">Nº</th><th>Item</th><th>Avaliação</th><th>Descrição da NC</th><th>Observação</th></tr></thead>
            <tbody>${CKL.execucoes.itens(e).map((i) => { const r = e.respostas[i.id] || {}; return html`
              <tr data-item="${i.id}"><td class="num">${i.ordem}</td><td>${i.texto}</td>
                <td><select data-c="avaliacao" aria-label="Avaliação do item ${i.ordem}">${ui.opcoes(opcoes, r.avaliacao)}</select></td>
                <td><textarea data-c="descricao" rows="1" aria-label="Descrição da NC do item ${i.ordem}">${r.descricao || ''}</textarea></td>
                <td><textarea data-c="observacao" rows="1" aria-label="Observação do item ${i.ordem}">${r.observacao || ''}</textarea></td></tr>`; })}</tbody>
          </table></div>
          <div class="campo"><label for="co-motivo">Motivo da correção</label><textarea id="co-motivo" rows="2" maxlength="300" placeholder="Por que o checklist está sendo corrigido"></textarea></div>
          <p class="form-erro" id="co-erro" role="alert" hidden></p>
        </form>`,
      acoes: [
        { rotulo: 'Voltar', classe: 'btn-secundario', acao: (mm) => mm.fechar() },
        { rotulo: 'Salvar correção', classe: 'btn-primario', acao: (mm, botao) => {
          const q = (s) => mm.corpo.querySelector(s);
          const itens = {};
          mm.corpo.querySelectorAll('tr[data-item]').forEach((tr) => {
            const r = e.respostas[tr.dataset.item] || {}, d = {};
            const av = tr.querySelector('[data-c=avaliacao]').value, de = tr.querySelector('[data-c=descricao]').value, ob = tr.querySelector('[data-c=observacao]').value;
            if (av !== r.avaliacao) d.avaliacao = av;
            if (util.limpar(de) !== util.limpar(r.descricao)) d.descricao = de;
            if (util.limpar(ob) !== util.limpar(r.observacao)) d.observacao = ob;
            if (Object.keys(d).length) itens[tr.dataset.item] = d;
          });
          const mud = { cultivarAnterior: q('#co-ant').value, proximaCultivar: q('#co-prox').value, operadorNome: q('#co-oper').value, observacoes: q('#co-obs').value, itens: itens };
          if (q('#co-termo')) mud.termo = q('#co-termo').value;
          ui.ocupar(botao, () => CKL.execucoes.corrigir(e.id, mud, q('#co-motivo').value).then(() => { mm.fechar(); ui.aviso('Checklist corrigido. A alteração está no histórico.', 'ok'); aoSalvar(); }))
            .catch((er) => { const x = q('#co-erro'); x.textContent = ui.mensagemDe(er); x.hidden = false; if (!er || !er.amigavel) console.error(er); });
        } }
      ]
    });
    return m;
  }

  /* ---------------- Janela da não conformidade ---------------- */
  adm.abrirNc = function (id, aoMudar) {
    const urls = ui.GerenteUrls();
    const m = ui.modal({ titulo: 'Não conformidade', largura: 'g', conteudo: html`<p class="texto-menor">Carregando…</p>`, aoFechar: () => urls.liberar() });
    function carregar() {
      return Promise.all([CKL.naoConformidades.obter(id), CKL.historico.daEntidade('nc', id)]).then(([n, ev]) => {
        if (!n) { m.definirConteudo(html`<p>Não conformidade não encontrada.</p>`); return; }
        return CKL.execucoes.fotosDe(n.execucaoId).catch(() => []).then((fotos) => {
          const minhas = fotos.filter((f) => f.itemId === n.itemId);
          const aberta = n.situacao !== cfg.SITUACAO_NC.ENCERRADA, pl = n.plano || {};
          m.definirConteudo(html`
            <div class="ck-detalhe">
              <div class="registro-topo">
                <div><span class="texto-menor">${n.area} · ${n.checklistNome} (${n.identificacao}) · ${util.fmtData(n.dataExecucao)}</span><strong class="ck-nc-titulo">Item ${n.itemOrdem} — ${n.itemTexto}</strong></div>
                <div class="registro-selos">${ui.seloNc(n.situacao)}${CKL.naoConformidades.atrasada(n) ? ui.seloSimples('Atrasada', 'selo-pendente', 'relogio') : ''}</div>
              </div>
              ${ui.dados([
                { rotulo: 'Descrição da NC', valor: n.descricao, largo: true },
                n.observacao ? { rotulo: 'Observação do colaborador', valor: n.observacao, largo: true } : null,
                ['Registrada em', util.fmtDataHora(n.registradaEm)], ['Responsável pelo registro', n.registradaPorNome],
                ['Reavaliações', (n.reavaliacoes || []).map((x) => x.rodada + 'ª ' + x.resultado + ' (' + util.fmtDataHora(x.em) + ')').join(' · ') || 'Nenhuma'],
                ['Situação do equipamento', n.liberadoNaRodada ? 'Liberado na ' + n.liberadoNaRodada + 'ª reavaliação' : 'Não liberado no checklist'],
                n.encerramento ? { rotulo: 'Encerramento', valor: util.fmtDataHora(n.encerramento.em) + ' · ' + n.encerramento.porNome + ' · ' + n.encerramento.comentario, largo: true } : null
              ], 'dados-2col')}
              ${minhas.length ? html`<div class="registro-miniaturas">${minhas.map((f) => html`<a href="${urls.daFoto(f)}" target="_blank" rel="noopener"><img src="${f.miniatura}" alt="Fotografia do item" width="68" height="68"></a>`)}</div>` : ''}
              <form class="cartao formulario" id="form-plano" novalidate>
                <span class="op-rotulo-g">Plano de ação</span>
                <div class="campo"><label for="pl-oque">O que será feito?</label><textarea id="pl-oque" rows="2" ${aberta ? '' : ui.bruto('disabled')}>${pl.oQue || ''}</textarea></div>
                <div class="campo"><label for="pl-como">Como?</label><textarea id="pl-como" rows="2" ${aberta ? '' : ui.bruto('disabled')}>${pl.como || ''}</textarea></div>
                <div class="formulario-linha">
                  <div class="campo"><label for="pl-quem">Quem?</label><input id="pl-quem" value="${pl.quem || ''}" ${aberta ? '' : ui.bruto('disabled')}></div>
                  <div class="campo"><label for="pl-data">Data prevista de conclusão</label><input id="pl-data" type="date" value="${pl.dataPrevista || ''}" ${aberta ? '' : ui.bruto('disabled')}></div>
                </div>
                ${aberta && CKL.auth.ehAdm() ? html`<div><button type="button" class="btn btn-secundario" data-acao="salvar-plano">${icone('check', 18)}<span>Salvar plano de ação</span></button></div>` : ''}
              </form>
              <div class="registro-acoes">
                <button type="button" class="btn btn-secundario" data-acao="checklist">${icone('checklist', 18)}<span>Abrir o checklist</span></button>
                ${CKL.auth.ehAdm() ? (aberta
                  ? html`<button type="button" class="btn btn-primario" data-acao="encerrar">${icone('checkCirculo', 18)}<span>Encerrar não conformidade</span></button>`
                  : html`<button type="button" class="btn btn-secundario" data-acao="reabrir">${icone('desfazer', 18)}<span>Reabrir</span></button>`) : ''}
              </div>
              <h3 class="secao-titulo">Histórico</h3>
              ${adm.eventosHtml(ev)}
            </div>`);
          m.corpo.onclick = (evt) => {
            const b = evt.target.closest('[data-acao]');
            if (!b) return;
            const q = (s) => m.corpo.querySelector(s);
            const depois = () => { carregar(); if (aoMudar) aoMudar(); };
            if (b.dataset.acao === 'salvar-plano') {
              ui.ocupar(b, () => CKL.naoConformidades.atualizarPlano(n.id, { oQue: q('#pl-oque').value, como: q('#pl-como').value, quem: q('#pl-quem').value, dataPrevista: q('#pl-data').value }))
                .then(() => { ui.aviso('Plano de ação salvo.', 'ok'); depois(); }).catch(ui.erro);
            } else if (b.dataset.acao === 'encerrar') {
              ui.confirmar({ titulo: 'Encerrar a não conformidade?', mensagem: 'Informe como ela foi resolvida. O encerramento fica no histórico e pode ser revertido (reabrir).',
                rotuloConfirmar: 'Encerrar', motivo: { rotulo: 'Como foi resolvida', obrigatorio: true, dica: 'Ex.: equipamento limpo e reavaliado pela Qualidade em 25/11' } })
                .then((r) => r && CKL.naoConformidades.encerrar(n.id, r.motivo).then(() => { ui.aviso('Não conformidade encerrada.', 'ok'); depois(); })).catch(ui.erro);
            } else if (b.dataset.acao === 'reabrir') {
              ui.confirmar({ titulo: 'Reabrir a não conformidade?', rotuloConfirmar: 'Reabrir', motivo: { rotulo: 'Motivo da reabertura', obrigatorio: true } })
                .then((r) => r && CKL.naoConformidades.reabrir(n.id, r.motivo).then(() => { ui.aviso('Não conformidade reaberta.', 'ok'); depois(); })).catch(ui.erro);
            } else if (b.dataset.acao === 'checklist') adm.abrirExecucao(n.execucaoId);
          };
        });
      }).catch(ui.erro);
    }
    carregar();
    return m;
  };
})(window);
