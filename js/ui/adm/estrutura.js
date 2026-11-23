/* ==========================================================================
   Painel do administrador — estrutura (menu lateral, área de trabalho, rotas)
   ========================================================================== */
(function (global) {
  'use strict';
  const CKL = global.CKL;
  const { ui, util, config: cfg } = CKL;
  const { html, icone } = ui;

  const ROTAS = [
    { id: 'painel', rotulo: 'Acompanhamento', icone: 'painel' },
    { id: 'checklists', rotulo: 'Checklists e relatórios', icone: 'checklist' },
    { id: 'nc', rotulo: 'Não conformidades', icone: 'alerta' },
    { id: 'modelos', rotulo: 'Modelos de checklist', icone: 'planilha' },
    { id: 'usuarios', rotulo: 'Usuários', icone: 'usuarios' },
    { id: 'historico', rotulo: 'Histórico', icone: 'historico' }
  ];
  const rotaValida = (id) => ROTAS.some((r) => r.id === id);
  const rotaDoEndereco = () => (global.location.hash || '').replace(/^#/, '').split('?')[0];

  function abrirSincronizacao() {
    const m = ui.modal({ titulo: 'Dados e sincronização', largura: 'g', conteudo: html`<p class="texto-menor">Carregando…</p>` });
    const estimativa = global.navigator.storage && global.navigator.storage.estimate ? global.navigator.storage.estimate().catch(() => null) : Promise.resolve(null);
    Promise.all([CKL.sincronizacao.resumo(), CKL.sincronizacao.fila(), estimativa]).then((r) => {
      const res = r[0], fila = r[1].slice().reverse(), est = r[2];
      m.definirConteudo(html`
        ${CKL.nuvem && CKL.nuvem.ativa
          ? html`<div class="alerta alerta-ok">${icone('nuvemOk', 20)}<div><strong>Conectado ao servidor central (Supabase).</strong>
              <p>Os checklists feitos nos celulares chegam aqui automaticamente. Cada aparelho guarda uma cópia para funcionar sem internet
              e envia o que fez assim que a conexão volta.${CKL.nuvem.sincronia.ultima() ? ' Última atualização: ' + util.fmtDataHora(CKL.nuvem.sincronia.ultima(), true) + '.' : ''}</p></div></div>`
          : html`<div class="alerta alerta-info">${icone('banco', 20)}<div><strong>Os dados estão guardados somente neste aparelho.</strong>
              <p>O servidor central ainda não foi configurado (js/core/servidor.js). Checklists, fotos e não conformidades ficam no banco deste navegador e
              não são compartilhados com outros aparelhos. Nada é marcado como enviado sem um envio real. Para ligar o banco central, siga supabase/LEIA-ME.md.</p></div></div>`}
        <div class="resumo-linha">
          <div><span>Aguardando envio</span><strong>${util.fmtNum(res.aguardando, 0)}</strong></div>
          <div><span>Sincronizados</span><strong>${util.fmtNum(res.sincronizado, 0)}</strong></div>
          <div><span>Falha no envio</span><strong>${util.fmtNum(res.falha, 0)}</strong></div>
          <div><span>Espaço usado neste navegador</span><strong>${est && est.usage ? util.fmtBytes(est.usage) : '—'}</strong></div>
        </div>
        <h3 class="secao-titulo">Fila de envio deste aparelho</h3>
        ${fila.length ? html`
          <div class="tabela-rolagem">
            <table class="tabela tabela-compacta">
              <thead><tr><th>Checklist</th><th>Entrou na fila em</th><th>Situação</th><th class="num">Tentativas</th></tr></thead>
              <tbody>${fila.slice(0, 100).map((i) => html`
                <tr><td>${i.rotulo}</td><td>${util.fmtDataHora(i.criadoEm)}</td>
                <td>${ui.seloEnvio(i.situacao)}${i.erro ? html`<div class="texto-menor">${i.erro}</div>` : ''}</td><td class="num">${i.tentativas || 0}</td></tr>`)}</tbody>
            </table>
          </div>` : html`<p class="texto-menor">Nenhum item na fila deste aparelho.</p>`}`);
    }).catch(ui.erro);
  }

  CKL.telas.adm.estrutura = {
    montar(raiz, ctx) {
      const usuario = CKL.auth.usuario();
      let atual = null, desmontarTela = null;

      raiz.innerHTML = html`
        <div class="adm" id="adm">
          <aside class="adm-menu" id="adm-menu">
            <div class="adm-marca">
              <img src="${CKL.recursos.logo}" alt="Dois Marcos Sementes" width="${CKL.recursos.logoLargura}" height="${CKL.recursos.logoAltura}">
              <span>${cfg.NOME_SISTEMA}</span>
            </div>
            <nav class="adm-nav" aria-label="Menu principal">
              ${ROTAS.map((r) => html`<a href="#${r.id}" data-rota="${r.id}">${icone(r.icone, 20)}<span>${r.rotulo}</span></a>`)}
            </nav>
            <div class="adm-menu-rodape">
              <button type="button" class="adm-menu-botao" data-acao="sincronizacao">${icone('banco', 20)}
                <span><strong>${CKL.nuvem && CKL.nuvem.ativa ? 'Servidor central' : 'Dados neste aparelho'}</strong><small id="adm-fila">Carregando…</small></span></button>
              <button type="button" class="adm-menu-botao" data-acao="app-operador">${icone('celular', 20)}<span><strong>Aplicativo do celular</strong><small>Fazer um checklist</small></span></button>
              <div class="adm-usuario">
                <span class="avatar">${util.iniciais(usuario.nome)}</span>
                <span class="adm-usuario-nome"><strong>${usuario.nome}</strong><small>${cfg.ROTULO_PERFIL[usuario.perfil]}</small></span>
                <button type="button" class="btn-icone" data-acao="sair" aria-label="Sair do sistema" title="Sair">${icone('sair', 20)}</button>
              </div>
            </div>
          </aside>
          <div class="adm-fundo-menu" data-acao="fechar-menu"></div>
          <div class="adm-principal">
            <header class="adm-topo">
              <button type="button" class="btn-icone" data-acao="abrir-menu" aria-label="Abrir menu" aria-controls="adm-menu">${icone('menu', 24)}</button>
              <strong id="adm-topo-titulo"></strong>
              <img src="${CKL.recursos.logo}" alt="" width="${CKL.recursos.logoLargura}" height="${CKL.recursos.logoAltura}">
            </header>
            <main class="adm-conteudo" id="adm-conteudo" tabindex="-1"></main>
          </div>
        </div>`;

      const conteudo = raiz.querySelector('#adm-conteudo');
      const caixa = raiz.querySelector('#adm');

      function atualizarFila() {
        CKL.sincronizacao.resumo().then((r) => {
          const el = raiz.querySelector('#adm-fila');
          if (!el) return;
          el.textContent = CKL.sincronizacao.configurada()
            ? (r.aguardando || r.falha ? util.plural(r.aguardando + r.falha, 'checklist a enviar', 'checklists a enviar') : 'Tudo enviado')
            : 'Sem servidor central';
        }).catch(() => {});
      }

      function navegar(rota, parametros) {
        const id = rotaValida(rota) ? rota : 'painel';
        caixa.classList.remove('menu-aberto');
        if (id === atual && !parametros) return;
        if (desmontarTela) { try { desmontarTela(); } catch (e) { console.error(e); } desmontarTela = null; }
        ui.esconderDica();
        atual = id;
        raiz.querySelectorAll('.adm-nav a').forEach((a) => {
          const ativo = a.dataset.rota === id;
          a.classList.toggle('ativo', ativo);
          if (ativo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
        });
        raiz.querySelector('#adm-topo-titulo').textContent = ROTAS.filter((r) => r.id === id)[0].rotulo;
        try { if (rotaDoEndereco() !== id) global.location.hash = id; } catch (e) { /* endereço não disponível */ }
        conteudo.innerHTML = '';
        conteudo.scrollTop = 0;
        global.scrollTo(0, 0);
        const pagina = document.createElement('div');
        pagina.className = 'pagina';
        conteudo.appendChild(pagina);
        desmontarTela = CKL.telas.adm[id].montar(pagina, { navegar: navegar, parametros: parametros || null }) || null;
      }

      function aoClicar(ev) {
        const link = ev.target.closest('a[data-rota]');
        if (link && raiz.contains(link)) { ev.preventDefault(); navegar(link.dataset.rota); return; }
        const b = ev.target.closest('[data-acao]');
        if (!b || conteudo.contains(b)) return;
        const acao = b.dataset.acao;
        if (acao === 'sair') ctx.aoSair();
        else if (acao === 'app-operador') ctx.aoAbrirOperador();
        else if (acao === 'sincronizacao') abrirSincronizacao();
        else if (acao === 'abrir-menu') caixa.classList.add('menu-aberto');
        else if (acao === 'fechar-menu') caixa.classList.remove('menu-aberto');
      }
      function aoMudarEndereco() {
        const r = rotaDoEndereco();
        if (rotaValida(r) && r !== atual) navegar(r);
      }

      raiz.addEventListener('click', aoClicar);
      global.addEventListener('hashchange', aoMudarEndereco);
      const desligar = [CKL.eventos.ouvir('execucoes:alterado', atualizarFila)];
      atualizarFila();
      navegar(rotaDoEndereco());

      return function desmontar() {
        if (desmontarTela) { try { desmontarTela(); } catch (e) { console.error(e); } }
        raiz.removeEventListener('click', aoClicar);
        global.removeEventListener('hashchange', aoMudarEndereco);
        desligar.forEach((f) => f());
        ui.esconderDica();
        raiz.innerHTML = '';
      };
    }
  };
})(window);
