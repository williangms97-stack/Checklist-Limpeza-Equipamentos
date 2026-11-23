/* ==========================================================================
   Painel de acompanhamento
   - Indicadores: previstos (aguarda regra de frequência — D10), iniciados,
     concluídos, pendentes (em andamento), com NC e % de conclusão.
   - Situação por UBS / secador: identifica rapidamente onde há pendência.
   - Gráficos: checklists por dia e itens NC por equipamento.
   ========================================================================== */
(function (global) {
  'use strict';
  const CKL = global.CKL;
  const { ui, util, config: cfg } = CKL;
  const { html, icone } = ui;
  const adm = CKL.telas.adm;
  const ST = cfg.STATUS;
  const F = adm.filtrosPadrao();

  CKL.telas.adm.painel = {
    montar(el, ctx) {
      let modelos = [], execs = [], ncs = [], montado = true;

      el.innerHTML = html`
        <header class="pagina-topo">
          <div><h1>Acompanhamento</h1><p>Checklists de limpeza de equipamentos por UBS e secador</p></div>
          <div class="pagina-acoes">
            ${CKL.nuvem && CKL.nuvem.ativa ? html`<button type="button" class="btn btn-secundario" data-acao="atualizar">${icone('atualizar', 18)}<span>Atualizar</span></button>` : ''}
            <button type="button" class="btn btn-secundario" data-acao="excel">${icone('planilha', 18)}<span>Exportar Excel</span></button>
          </div>
        </header>
        <div id="pn-filtros"></div>
        <div id="pn-corpo"><p class="texto-menor">Carregando…</p></div>`;

      function carregar() {
        return Promise.all([CKL.modelos.listar(), CKL.execucoes.listar(), CKL.naoConformidades.listar()]).then((r) => {
          if (!montado) return;
          [modelos, execs, ncs] = r;
          el.querySelector('#pn-filtros').innerHTML = String(adm.filtrosHtml(F, modelos, execs, 'pn'));
          desenhar();
        }).catch(ui.erro);
      }

      function desenhar() {
        const corpo = el.querySelector('#pn-corpo');
        if (!modelos.length) {
          corpo.innerHTML = String(html`<div class="cartao">${ui.vazio('planilha', 'Nenhum modelo de checklist carregado',
            CKL.nuvem && CKL.nuvem.ativa ? 'O servidor ainda não tem os modelos. Carregue os 16 checklists originais (UBS e secadores) para começar.' : 'Os modelos ainda não foram criados.',
            CKL.nuvem && CKL.nuvem.ativa ? html`<button type="button" class="btn btn-primario" data-acao="carregar-modelos">${icone('upload', 18)}<span>Carregar os checklists originais</span></button>` : '')}</div>`);
          return;
        }
        const lista = adm.aplicarFiltros(execs, F);
        const iniciados = lista.length;
        const concluidos = lista.filter((e) => e.status === ST.CONCLUIDO || e.status === ST.CONCLUIDO_NC).length;
        const andamento = lista.filter((e) => e.status === ST.EM_ANDAMENTO).length;
        const comNc = lista.filter((e) => e.status === ST.CONCLUIDO_NC).length;
        const ids = new Set(lista.map((e) => e.id));
        const ncsFiltro = ncs.filter((n) => ids.has(n.execucaoId));
        const ncAbertas = ncsFiltro.filter((n) => n.situacao !== cfg.SITUACAO_NC.ENCERRADA);
        const pct = iniciados ? concluidos / iniciados : 0;

        // situação por checklist (modelos ativos dentro do filtro de área / UBS-secador)
        const modelosVisiveis = modelos.filter((m) => m.ativo !== false && (!F.area || m.area === F.area) && (!F.modelo || m.id === F.modelo));
        const linhas = modelosVisiveis.map((m) => {
          const doModelo = lista.filter((e) => e.modeloId === m.id);
          const ultimo = doModelo.filter((e) => e.status === ST.CONCLUIDO || e.status === ST.CONCLUIDO_NC)[0];
          const emAnd = doModelo.filter((e) => e.status === ST.EM_ANDAMENTO);
          const abertas = ncAbertas.filter((n) => n.modeloId === m.id);
          const atrasadas = abertas.filter((n) => CKL.naoConformidades.atrasada(n)).length;
          const pend = emAnd.length > 0 || abertas.length > 0;
          return { m, ultimo, emAnd, abertas, atrasadas, pend, total: doModelo.length };
        }).sort((a, b) => (b.pend - a.pend) || (b.abertas.length - a.abertas.length) || 0);
        const comPendencia = linhas.filter((l) => l.pend).length;

        corpo.innerHTML = String(html`
          <section class="indicadores ck-indicadores" aria-label="Indicadores">
            <div class="indicador indicador-destaque">
              <span class="indicador-rotulo">Percentual de conclusão</span>
              <span class="indicador-valor">${util.fmtPct(pct * 100)}</span>
              <span class="medidor" aria-hidden="true"><span style="--p:${pct.toFixed(4)}"></span></span>
              <span class="indicador-nota">${util.fmtNum(concluidos, 0)} concluídos de ${util.fmtNum(iniciados, 0)} iniciados no filtro</span>
            </div>
            <div class="indicador"><span class="indicador-rotulo">Previstos</span><span class="indicador-valor">—</span>
              <span class="indicador-nota">Sem regra de frequência definida. Cada checklist é aberto a cada troca de cultivar.</span></div>
            <div class="indicador"><span class="indicador-rotulo">Iniciados</span><span class="indicador-valor">${util.fmtNum(iniciados, 0)}</span><span class="indicador-nota">no período e filtros escolhidos</span></div>
            <div class="indicador"><span class="indicador-rotulo">Concluídos</span><span class="indicador-valor">${util.fmtNum(concluidos, 0)}</span><span class="indicador-nota">${util.fmtNum(concluidos - comNc, 0)} sem NC</span></div>
            <div class="indicador"><span class="indicador-rotulo">Pendentes (em andamento)</span><span class="indicador-valor">${util.fmtNum(andamento, 0)}</span><span class="indicador-nota">iniciados e ainda não enviados</span></div>
            <div class="indicador ${comNc ? 'ck-indicador-nc' : ''}"><span class="indicador-rotulo">Com não conformidades</span><span class="indicador-valor">${util.fmtNum(comNc, 0)}</span>
              <a class="indicador-nota" href="#nc" data-rota-nc>${util.plural(ncAbertas.length, 'NC aberta', 'NCs abertas')}</a></div>
          </section>

          <section class="cartao cartao-tabela">
            <div class="ck-cartao-topo">
              <h2>Situação por UBS e secador</h2>
              <span class="texto-menor">${comPendencia ? util.plural(comPendencia, 'local com pendência', 'locais com pendência') : 'Nenhum local com pendência'} · pendência = checklist em andamento ou NC aberta</span>
            </div>
            <div class="tabela-rolagem">
              <table class="tabela tabela-compacta">
                <thead><tr><th>Área</th><th>UBS / secador</th><th>Identificação</th><th>Último concluído</th><th>Responsável</th><th class="num">No filtro</th><th>Em andamento</th><th>NC abertas</th></tr></thead>
                <tbody>${linhas.map((l) => html`
                  <tr class="${l.pend ? 'ck-linha-pendente' : ''} ${l.ultimo ? 'linha-clicavel' : ''}" ${l.ultimo ? ui.bruto('tabindex="0" data-exec="' + util.esc(l.ultimo.id) + '"') : ''}>
                    <td>${l.m.area}</td><td><strong>${l.m.nome}</strong></td><td>${l.m.identificacao}</td>
                    <td>${l.ultimo ? html`${util.fmtData(l.ultimo.dataExecucao)} ${ui.seloStatus(l.ultimo.status)}` : html`<span class="texto-menor">Nenhum no filtro</span>`}</td>
                    <td>${l.ultimo ? l.ultimo.responsavelNome : '—'}</td>
                    <td class="num">${l.total}</td>
                    <td>${l.emAnd.length ? ui.seloSimples(util.plural(l.emAnd.length, 'em andamento', 'em andamento'), 'selo-pendente', 'relogio') : '—'}</td>
                    <td>${l.abertas.length ? html`${ui.seloSimples(util.plural(l.abertas.length, 'aberta', 'abertas'), 'selo-cancelada', 'alerta')}${l.atrasadas ? ui.seloSimples(l.atrasadas + ' atrasada(s)', 'selo-pendente', 'relogio') : ''}` : '—'}</td>
                  </tr>`)}</tbody>
              </table>
            </div>
          </section>

          <section class="graficos">
            <div class="cartao grafico grafico-grande"><header><h2>Checklists por dia</h2></header><div class="grafico-area" id="pn-dias"></div></div>
            <div class="cartao grafico"><header><h2>Itens NC por equipamento</h2></header><div class="grafico-area" id="pn-equip"></div></div>
            <div class="cartao grafico"><header><h2>Checklists por colaborador</h2></header><div class="grafico-area" id="pn-colab"></div></div>
          </section>

          ${F.equipamento ? blocoEquipamento(lista) : ''}`);

        // gráficos
        const porDia = util.agrupar(lista, (e) => e.dataExecucao);
        const dias = Array.from(porDia.keys()).sort();
        if (dias.length) {
          const serie = [], ini = new Date(dias[0] + 'T12:00:00'), fim = new Date(dias[dias.length - 1] + 'T12:00:00');
          for (let d = ini, n = 0; d <= fim && n < 400; d = new Date(d.getTime() + 86400000), n++) {
            const k = util.dataLocal(d);
            serie.push({ rotulo: k.slice(8, 10) + '/' + k.slice(5, 7), titulo: util.fmtData(k), valor: (porDia.get(k) || []).length });
          }
          ui.graficoColunas(corpo.querySelector('#pn-dias'), serie, { unidade: ['checklist', 'checklists'], descricao: 'Checklists por dia' });
        } else ui.graficoColunas(corpo.querySelector('#pn-dias'), [], { vazio: 'Nenhum checklist no filtro.' });
        const porEquip = new Map();
        lista.forEach((e) => CKL.execucoes.itens(e).forEach((i) => {
          const r = e.respostas[i.id];
          if (r && r.avaliacao === 'NC') { const k = e.nome + ' · ' + i.texto; porEquip.set(k, (porEquip.get(k) || 0) + 1); }
        }));
        ui.graficoBarras(corpo.querySelector('#pn-equip'), Array.from(porEquip, ([rotulo, valor]) => ({ rotulo, valor })), { unidade: ['NC', 'NCs'], vazio: 'Nenhum item NC no filtro.' });
        const porColab = util.agrupar(lista, (e) => e.responsavelNome);
        ui.graficoBarras(corpo.querySelector('#pn-colab'), Array.from(porColab, ([rotulo, l]) => ({ rotulo, valor: l.length })), { unidade: ['checklist', 'checklists'], vazio: 'Nenhum checklist no filtro.' });
      }

      /** Com filtro de equipamento: como esse equipamento foi avaliado em cada checklist. */
      function blocoEquipamento(lista) {
        const linhas = [];
        lista.forEach((e) => adm.itensDoEquipamento(e, F.equipamento).forEach((i) => linhas.push({ e, i, r: e.respostas[i.id] || {} })));
        return html`
          <section class="cartao cartao-tabela">
            <div class="ck-cartao-topo"><h2>Equipamento: “${F.equipamento}”</h2><span class="texto-menor">${util.plural(linhas.length, 'avaliação', 'avaliações')} no filtro</span></div>
            <div class="tabela-rolagem"><table class="tabela tabela-compacta">
              <thead><tr><th>Data</th><th>UBS / secador</th><th>Item</th><th>Avaliação</th><th>Situação final</th><th>Responsável</th></tr></thead>
              <tbody>${linhas.slice(0, 200).map((x) => html`<tr class="linha-clicavel" tabindex="0" data-exec="${x.e.id}">
                <td>${util.fmtData(x.e.dataExecucao)}</td><td>${x.e.nome}</td><td>Item ${x.i.ordem} — ${x.i.texto}</td>
                <td>${ui.seloAvaliacao(x.r.avaliacao, true)}</td><td>${ui.seloAvaliacao(CKL.execucoes.situacaoFinal(x.r), true)}</td><td>${x.e.responsavelNome}</td></tr>`)}</tbody>
            </table></div>
          </section>`;
      }

      adm.ligarFiltros(el, F, (k) => { if (k === 'area') el.querySelector('#pn-filtros').innerHTML = String(adm.filtrosHtml(F, modelos, execs, 'pn')); desenhar(); });
      el.addEventListener('click', (ev) => {
        const linha = ev.target.closest('[data-exec]');
        if (linha) { adm.abrirExecucao(linha.dataset.exec, { destacar: F.equipamento }); return; }
        if (ev.target.closest('[data-rota-nc]')) { ev.preventDefault(); ctx.navegar('nc'); return; }
        const b = ev.target.closest('[data-acao]');
        if (!b) return;
        if (b.dataset.acao === 'excel') {
          ui.ocupar(b, () => CKL.excel.exportar(adm.aplicarFiltros(execs, F), ncs).then((x) => CKL.arquivos.salvar(x.blob, x.nome)).then((r) => { if (r === 'salvo') ui.aviso('Planilha gerada.', 'ok'); })).catch(ui.erro);
        } else if (b.dataset.acao === 'atualizar') {
          ui.ocupar(b, () => CKL.nuvem.sincronia.puxar()).then(carregar).catch(ui.erro);
        } else if (b.dataset.acao === 'carregar-modelos') {
          ui.ocupar(b, () => CKL.modelos.carregarOriginais()).then(() => { ui.aviso('Os 16 checklists originais foram carregados.', 'ok'); carregar(); }).catch(ui.erro);
        }
      });
      el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.matches('[data-exec]')) ev.target.click(); });
      const desligar = ['execucoes:alterado', 'nc:alterado', 'modelos:alterado'].map((n) => CKL.eventos.ouvir(n, carregar));
      carregar();
      return () => { montado = false; desligar.forEach((f) => f()); };
    }
  };
})(window);
