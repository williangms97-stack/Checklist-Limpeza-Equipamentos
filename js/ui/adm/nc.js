/* ==========================================================================
   Não conformidades — acompanhamento dos planos de ação
   Só o administrador encerra uma NC (com comentário). Concluir o checklist ou
   liberar o equipamento na reavaliação NÃO encerra a não conformidade.
   ========================================================================== */
(function (global) {
  'use strict';
  const CKL = global.CKL;
  const { ui, util, config: cfg } = CKL;
  const { html, icone } = ui;
  const adm = CKL.telas.adm;
  const F = { situacao: 'aberta', area: '', modelo: '', de: '', ate: '', busca: '' };
  let pagina = 1;

  CKL.telas.adm.nc = {
    montar(el) {
      let modelos = [], ncs = [], montado = true;
      el.innerHTML = html`
        <header class="pagina-topo">
          <div><h1>Não conformidades</h1><p>Itens marcados NC nos checklists e seus planos de ação</p></div>
        </header>
        <div id="nc-filtros"></div>
        <div id="nc-lista"><p class="texto-menor">Carregando…</p></div>`;

      function filtrosHtml() {
        const areas = CKL.modelos.areas(modelos).map((a) => ({ valor: a.id, rotulo: a.rotulo }));
        const mods = modelos.filter((m) => !F.area || m.area === F.area).map((m) => ({ valor: m.id, rotulo: m.nome }));
        const cont = (s) => ncs.filter((n) => s === 'atrasada' ? CKL.naoConformidades.atrasada(n) : s ? n.situacao === s : true).length;
        return html`
          <div class="abas" role="tablist" aria-label="Situação">
            ${[['aberta', 'Abertas'], ['atrasada', 'Atrasadas'], ['encerrada', 'Encerradas'], ['', 'Todas']].map((s) => html`
              <button type="button" role="tab" class="${F.situacao === s[0] ? 'ativa' : ''}" aria-selected="${F.situacao === s[0]}" data-situacao="${s[0]}">${s[1]}<span>${cont(s[0])}</span></button>`)}
          </div>
          <section class="filtros" aria-label="Filtros">
            <div class="campo"><label for="nc-area">Área</label><select id="nc-area" data-f="area">${ui.opcoes(areas, F.area, 'Todas')}</select></div>
            <div class="campo"><label for="nc-modelo">UBS / secador</label><select id="nc-modelo" data-f="modelo">${ui.opcoes(mods, F.modelo, 'Todos')}</select></div>
            <div class="campo"><label for="nc-de">De</label><input type="date" id="nc-de" data-f="de" value="${F.de}"></div>
            <div class="campo"><label for="nc-ate">Até</label><input type="date" id="nc-ate" data-f="ate" value="${F.ate}"></div>
            <div class="campo campo-largo"><label for="nc-busca">Pesquisar</label><input type="search" id="nc-busca" data-f="busca" value="${F.busca}" placeholder="Equipamento, descrição ou responsável" autocomplete="off"></div>
          </section>`;
      }

      function carregar() {
        return Promise.all([CKL.modelos.listar(), CKL.naoConformidades.listar()]).then((r) => {
          if (!montado) return;
          [modelos, ncs] = r;
          el.querySelector('#nc-filtros').innerHTML = String(filtrosHtml());
          desenhar();
        }).catch(ui.erro);
      }

      function desenhar() {
        const alvo = el.querySelector('#nc-lista');
        const lista = ncs.filter((n) => {
          if (F.situacao === 'atrasada' ? !CKL.naoConformidades.atrasada(n) : F.situacao && n.situacao !== F.situacao) return false;
          if (F.area && n.area !== F.area) return false;
          if (F.modelo && n.modeloId !== F.modelo) return false;
          if (F.de && n.dataExecucao < F.de) return false;
          if (F.ate && n.dataExecucao > F.ate) return false;
          if (F.busca && !util.contem([n.itemTexto, n.descricao, n.observacao, n.registradaPorNome, n.plano && n.plano.quem, n.checklistNome].join(' '), F.busca)) return false;
          return true;
        });
        if (!ncs.length) { alvo.innerHTML = String(ui.vazio('checkCirculo', 'Nenhuma não conformidade registrada', 'Quando um item for marcado NC em um checklist enviado, ele aparece aqui com o plano de ação.')); return; }
        if (!lista.length) { alvo.innerHTML = String(ui.vazio('filtro', 'Nenhuma não conformidade no filtro', 'Ajuste os filtros para ver outras.')); return; }
        const pg = ui.paginar(lista, pagina);
        pagina = pg.pagina;
        alvo.innerHTML = String(html`
          <div class="cartao cartao-tabela">
            <div class="tabela-rolagem">
              <table class="tabela tabela-compacta">
                <thead><tr><th>Registrada</th><th>UBS / secador</th><th>Equipamento / item</th><th>Descrição da NC</th><th>Equipamento</th><th>Quem?</th><th>Prevista</th><th>Situação</th></tr></thead>
                <tbody>${pg.itens.map((n) => html`
                  <tr class="linha-clicavel" tabindex="0" data-nc="${n.id}">
                    <td class="nowrap">${util.fmtDataHora(n.registradaEm)}</td>
                    <td>${n.checklistNome}<div class="texto-menor">${n.identificacao}</div></td>
                    <td>Item ${n.itemOrdem} — ${n.itemTexto}</td>
                    <td>${n.descricao || '—'}</td>
                    <td>${n.liberadoNaRodada ? ui.seloSimples('Liberado na ' + n.liberadoNaRodada + 'ª', 'selo-registrada', 'check') : ui.seloSimples('Não liberado', 'selo-cancelada', 'x')}</td>
                    <td>${(n.plano && n.plano.quem) || '—'}</td>
                    <td class="nowrap">${n.plano && n.plano.dataPrevista ? util.fmtData(n.plano.dataPrevista) : '—'}</td>
                    <td><div class="selos">${ui.seloNc(n.situacao)}${CKL.naoConformidades.atrasada(n) ? ui.seloSimples('Atrasada', 'selo-pendente', 'relogio') : ''}</div></td>
                  </tr>`)}</tbody>
              </table>
            </div>
            ${ui.paginacao(pg, 'não conformidades')}
          </div>`);
      }

      el.addEventListener('click', (ev) => {
        const s = ev.target.closest('[data-situacao]');
        if (s) { F.situacao = s.dataset.situacao; pagina = 1; el.querySelector('#nc-filtros').innerHTML = String(filtrosHtml()); desenhar(); return; }
        const b = ev.target.closest('[data-acao=pagina]');
        if (b) { pagina = Number(b.dataset.pagina); desenhar(); return; }
        const linha = ev.target.closest('[data-nc]');
        if (linha) adm.abrirNc(linha.dataset.nc, carregar);
      });
      el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.matches('[data-nc]')) ev.target.click(); });
      const mudar = (ev) => {
        const k = ev.target.dataset && ev.target.dataset.f;
        if (!k) return;
        F[k] = ev.target.value; pagina = 1;
        if (k === 'area') { F.modelo = ''; el.querySelector('#nc-filtros').innerHTML = String(filtrosHtml()); }
        desenhar();
      };
      el.addEventListener('change', (ev) => { if (ev.target.type !== 'search') mudar(ev); });
      el.addEventListener('input', util.debounce((ev) => { if (ev.target.type === 'search') mudar(ev); }, 250));
      const desligar = ['nc:alterado', 'execucoes:alterado'].map((n) => CKL.eventos.ouvir(n, carregar));
      carregar();
      return () => { montado = false; desligar.forEach((f) => f()); };
    }
  };
})(window);
