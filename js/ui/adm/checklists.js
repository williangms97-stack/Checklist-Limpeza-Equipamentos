/* ==========================================================================
   Checklists e relatórios — consulta dos registros, PDF individual e Excel
   ========================================================================== */
(function (global) {
  'use strict';
  const CKL = global.CKL;
  const { ui, util, config: cfg } = CKL;
  const { html, icone } = ui;
  const adm = CKL.telas.adm;
  const F = adm.filtrosPadrao();
  let pagina = 1;

  CKL.telas.adm.checklists = {
    montar(el) {
      let modelos = [], execs = [], ncs = [], montado = true;
      el.innerHTML = html`
        <header class="pagina-topo">
          <div><h1>Checklists e relatórios</h1><p>Consulte os checklists anteriores, gere o relatório PDF de cada um ou exporte para Excel</p></div>
          <div class="pagina-acoes"><button type="button" class="btn btn-secundario" data-acao="excel">${icone('planilha', 18)}<span>Exportar Excel</span></button></div>
        </header>
        <div id="ck-filtros"></div>
        <div id="ck-lista"><p class="texto-menor">Carregando…</p></div>`;

      function carregar() {
        return Promise.all([CKL.modelos.listar(), CKL.execucoes.listar(), CKL.naoConformidades.listar()]).then((r) => {
          if (!montado) return;
          [modelos, execs, ncs] = r;
          el.querySelector('#ck-filtros').innerHTML = String(adm.filtrosHtml(F, modelos, execs, 'ck'));
          desenhar();
        }).catch(ui.erro);
      }

      function desenhar() {
        const alvo = el.querySelector('#ck-lista');
        const lista = adm.aplicarFiltros(execs, F);
        if (!execs.length) { alvo.innerHTML = String(ui.vazio('checklist', 'Nenhum checklist ainda', 'Os checklists feitos no aplicativo do celular aparecem aqui.')); return; }
        if (!lista.length) { alvo.innerHTML = String(ui.vazio('filtro', 'Nenhum checklist no filtro', 'Ajuste os filtros para ver outros checklists.')); return; }
        const abertasPor = {};
        ncs.forEach((n) => { if (n.situacao !== cfg.SITUACAO_NC.ENCERRADA) abertasPor[n.execucaoId] = (abertasPor[n.execucaoId] || 0) + 1; });
        const pg = ui.paginar(lista, pagina);
        pagina = pg.pagina;
        alvo.innerHTML = String(html`
          <div class="cartao cartao-tabela">
            <div class="tabela-rolagem">
              <table class="tabela tabela-compacta">
                <thead><tr><th>Data</th><th>Início / conclusão</th><th>Área</th><th>UBS / secador</th><th>Responsável</th><th>Status</th><th class="num">C</th><th class="num">NC</th><th class="num">Não solic.</th><th>NC abertas</th><th>Envio</th><th></th></tr></thead>
                <tbody>${pg.itens.map((e) => { const r = e.resultado || CKL.execucoes.resultado(e); return html`
                  <tr class="linha-clicavel ${e.status === 'descartado' ? 'linha-apagada' : ''}" tabindex="0" data-exec="${e.id}">
                    <td class="nowrap">${util.fmtData(e.dataExecucao)}</td>
                    <td class="nowrap">${util.fmtHora(e.iniciadoEm).slice(0, 5)} – ${e.concluidoEm ? util.fmtHora(e.concluidoEm).slice(0, 5) : '…'}</td>
                    <td>${e.area}</td><td><strong>${e.nome}</strong><div class="texto-menor">${e.identificacao} · ${e.protocolo}</div></td>
                    <td>${e.responsavelNome}</td><td>${ui.seloStatus(e.status)}</td>
                    <td class="num">${r.conformes}</td><td class="num">${r.naoConformes}</td><td class="num">${r.naoSolicitados}</td>
                    <td>${abertasPor[e.id] ? ui.seloSimples(String(abertasPor[e.id]), 'selo-cancelada', 'alerta') : '—'}</td>
                    <td>${ui.seloEnvio(e.situacaoEnvio)}</td>
                    <td><button type="button" class="btn btn-secundario btn-p" data-acao="pdf" data-id="${e.id}">${icone('pdf', 16)}<span>PDF</span></button></td>
                  </tr>`; })}</tbody>
              </table>
            </div>
            ${ui.paginacao(pg, 'checklists')}
          </div>`);
      }

      adm.ligarFiltros(el, F, (k) => { pagina = 1; if (k === 'area') el.querySelector('#ck-filtros').innerHTML = String(adm.filtrosHtml(F, modelos, execs, 'ck')); desenhar(); });
      el.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-acao]');
        if (b && b.dataset.acao === 'pdf') { ev.stopPropagation(); ui.gerarPdf(b.dataset.id, b); return; }
        if (b && b.dataset.acao === 'pagina') { pagina = Number(b.dataset.pagina); desenhar(); return; }
        if (b && b.dataset.acao === 'excel') {
          ui.ocupar(b, () => CKL.excel.exportar(adm.aplicarFiltros(execs, F), ncs).then((x) => CKL.arquivos.salvar(x.blob, x.nome)).then((r) => { if (r === 'salvo') ui.aviso('Planilha gerada.', 'ok'); })).catch(ui.erro);
          return;
        }
        const linha = ev.target.closest('[data-exec]');
        if (linha) adm.abrirExecucao(linha.dataset.exec, { destacar: F.equipamento });
      });
      el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.matches('[data-exec]')) ev.target.click(); });
      const desligar = ['execucoes:alterado', 'nc:alterado'].map((n) => CKL.eventos.ouvir(n, carregar));
      carregar();
      return () => { montado = false; desligar.forEach((f) => f()); };
    }
  };
})(window);
