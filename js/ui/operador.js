/* ==========================================================================
   Aplicativo do celular — quem faz a vistoria
   Fluxo: início (UBS / Secador / Limpeza de veículo) → checklist → cultivares →
          itens (C / NC / Não solicitado) → revisão (pendências, termo, operador e assinatura) → envio
   ========================================================================== */
(function (global) {
  'use strict';
  const CKL = global.CKL;
  const { ui, util, config: cfg } = CKL;
  const { html, icone } = ui;
  const ST = cfg.STATUS;

  CKL.telas.operador = {
    montar(raiz, ctx) {
      const usuario = CKL.auth.usuario();
      const estado = { tela: 'inicio', area: null, modeloId: null, execId: null, filtro: 'todos', rolarPara: null };
      let exec = null;                 // checklist aberto (cópia em memória)
      const salvando = new Map();      // textos aguardando gravação: chave -> timer
      let montado = true;

      raiz.innerHTML = html`
        <div class="op ck-op">
          <header class="op-topo">
            <div class="op-topo-linha" id="op-topo"></div>
            <div class="ck-progresso" id="op-progresso" hidden><span id="op-progresso-barra"></span></div>
          </header>
          <main class="op-conteudo" id="op-conteudo" tabindex="-1"></main>
          <p class="op-versao">${cfg.NOME_CURTO} · Versão ${cfg.VERSAO}</p>
          <footer class="op-barra" id="op-barra" hidden></footer>
        </div>`;
      const elTopo = raiz.querySelector('#op-topo'), elConteudo = raiz.querySelector('#op-conteudo'), elBarra = raiz.querySelector('#op-barra');
      const elProgresso = raiz.querySelector('#op-progresso'), elBarraProgresso = raiz.querySelector('#op-progresso-barra');

      /* ---------------- Estrutura comum ---------------- */
      function topo(titulo, sub, voltar) {
        elTopo.innerHTML = html`
          ${voltar ? html`<button type="button" class="btn-icone op-topo-botao" data-acao="voltar" aria-label="Voltar">${icone('voltar', 24)}</button>`
            : html`<img class="op-logo ck-logo" src="${CKL.recursos.logo}" alt="Dois Marcos Sementes" width="${CKL.recursos.logoLargura}" height="${CKL.recursos.logoAltura}">`}
          <div class="op-topo-titulo"><span>${sub || cfg.NOME_CURTO}</span><strong>${titulo}</strong></div>
          ${CKL.sincronizacao.online() ? '' : html`<span class="op-offline">${icone('semRede', 14)}Sem internet</span>`}
          <button type="button" class="op-topo-usuario" data-acao="menu" aria-label="Menu do usuário ${usuario.nome}"><span class="avatar">${util.iniciais(usuario.nome)}</span></button>`;
      }
      function barra(conteudo) { elBarra.hidden = !conteudo; elBarra.innerHTML = conteudo ? html`<div class="op-barra-interna">${conteudo}</div>` : ''; }
      function progresso(e) {
        if (!e) { elProgresso.hidden = true; return; }
        const r = CKL.execucoes.resultado(e);
        elProgresso.hidden = false;
        elBarraProgresso.style.width = (r.total ? (r.avaliados / r.total) * 100 : 0).toFixed(1) + '%';
      }
      // limpeza de veículos (js/ui/veiculos-app.js)
      const vei = CKL.telas.veiculosApp({ elConteudo: elConteudo, topo: topo, barra: barra, ir: ir, estado: estado });
      const telaVeiculo = (t) => t === 'veiculos' || t.indexOf('vei-') === 0;

      function ir(tela, extra) {
        if (!montado) return;
        guardarTextos();
        vei.guardar();
        Object.assign(estado, { tela: tela }, extra || {});
        global.scrollTo(0, 0);
        desenhar();
      }
      function desenhar() {
        const t = estado.tela;
        progresso(null);
        const p = telaVeiculo(t) ? vei.desenhar(t) : t === 'inicio' ? telaInicio() : t === 'area' ? telaAreas() : t === 'lista' ? telaLista() : t === 'abrir' ? telaAbrir()
          : t === 'execucao' ? telaExecucao() : t === 'revisao' ? telaRevisao() : t === 'enviado' ? telaEnviado() : t === 'ver' ? telaVer() : telaInicio();
        Promise.resolve(p).catch(ui.erro);
      }
      function voltar() {
        const t = estado.tela;
        if (telaVeiculo(t)) vei.voltar(t);
        else if (t === 'area') ir('inicio');
        else if (t === 'lista') ir('inicio');
        else if (t === 'abrir') ir('lista');
        else if (t === 'execucao') ir('inicio');
        else if (t === 'revisao') ir('execucao');
        else ir('inicio');
      }

      function abrirMenu() {
        const m = ui.modal({
          titulo: usuario.nome, largura: 'p',
          conteudo: html`
            <p class="texto-menor">${cfg.ROTULO_PERFIL[usuario.perfil]} · usuário ${usuario.usuario}</p>
            <div class="op-menu">
              ${CKL.auth.ehAdm() ? html`<button type="button" class="btn btn-secundario btn-g btn-bloco" data-m="painel">${icone('painel', 20)}<span>Abrir o painel do administrador</span></button>` : ''}
              <button type="button" class="btn btn-secundario btn-g btn-bloco" data-m="sinc">${icone('nuvem', 20)}<span>Dados e envio</span></button>
              <button type="button" class="btn btn-perigo-suave btn-g btn-bloco" data-m="sair">${icone('sair', 20)}<span>Sair</span></button>
            </div>
            <p class="texto-menor">Versão ${cfg.VERSAO}</p>`
        });
        m.corpo.addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-m]');
          if (!b) return;
          m.fechar();
          if (b.dataset.m === 'painel') ctx.aoIrParaPainel();
          else if (b.dataset.m === 'sair') sairComCuidado();
          else abrirSincronizacao();
        });
      }
      function sairComCuidado() {
        guardarTextos();
        CKL.sincronizacao.resumo().then((r) => {
          if (!CKL.sincronizacao.configurada() || !r.aguardando && !r.falha) { ctx.aoSair(); return; }
          ui.confirmar({ titulo: 'Sair do aplicativo?', mensagem: util.plural(r.aguardando + r.falha, 'checklist ainda não foi enviado', 'checklists ainda não foram enviados') + ' ao servidor. Eles continuam guardados neste aparelho e serão enviados quando você entrar de novo com internet.', rotuloConfirmar: 'Sair mesmo assim' })
            .then((ok) => { if (ok) ctx.aoSair(); });
        });
      }
      function abrirSincronizacao() {
        CKL.sincronizacao.fila().then((fila) => {
          const conf = CKL.sincronizacao.configurada();
          ui.modal({
            titulo: 'Dados e envio', largura: 'm',
            conteudo: html`
              ${conf ? html`<div class="alerta alerta-ok">${icone('nuvemOk', 20)}<div><strong>Ligado ao servidor central.</strong><p>Os checklists são enviados sozinhos quando há internet. Sem internet, ficam guardados neste aparelho.</p></div></div>`
                : html`<div class="alerta alerta-info">${icone('celular', 20)}<div><strong>Dados guardados só neste aparelho.</strong><p>O servidor central ainda não foi configurado. Os checklists ficam guardados aqui e não são enviados para outro lugar.</p></div></div>`}
              ${fila.length ? html`<ul class="ck-fila">${fila.slice().reverse().slice(0, 30).map((i) => html`<li><span>${i.rotulo}</span>${ui.seloEnvio(i.situacao)}${i.erro ? html`<small>${i.erro}</small>` : ''}</li>`)}</ul>`
                : html`<p class="texto-menor">Nenhum checklist neste aparelho.</p>`}`,
            acoes: conf ? [{ rotulo: 'Enviar agora', classe: 'btn-primario', icone: 'atualizar', acao: (m, b) => ui.ocupar(b, () => (CKL.nuvem && CKL.nuvem.sincronia ? CKL.nuvem.sincronia.ciclo() : CKL.sincronizacao.processar())).then(() => { m.fechar(); ui.aviso('Envio concluído.', 'ok'); }).catch(ui.erro) }] : []
          });
        }).catch(ui.erro);
      }

      /* Sem modelos no aparelho: diz se está baixando ou qual foi o erro, com "Tentar de novo". */
      function avisoSemModelos() {
        const sinc = CKL.nuvem && CKL.nuvem.ativa ? CKL.nuvem.sincronia : null;
        if (!sinc) return html`<div class="alerta alerta-alerta" data-sem-modelos="1">${icone('alerta', 20)}<div><strong>Checklists de UBS e secador indisponíveis.</strong><p>Os modelos ainda não foram carregados.</p></div></div>`;
        if (sinc.rodando()) return html`<div class="alerta alerta-info" data-sem-modelos="1">${icone('atualizar', 20)}<div><strong>Baixando os checklists do servidor…</strong><p>Na primeira vez pode levar alguns segundos.</p></div></div>`;
        const f = sinc.falha();
        return html`<div class="alerta alerta-alerta" data-sem-modelos="1">${icone('alerta', 20)}<div><strong>Checklists de UBS e secador indisponíveis.</strong>
          <p>${f ? 'Não foi possível baixar do servidor: ' + f.mensagem : 'Os modelos ainda não foram baixados do servidor. Confira a internet ou peça ao administrador para carregar os checklists no painel.'}</p>
          <button type="button" class="btn btn-secundario" data-acao="baixar-modelos">${icone('atualizar', 18)}<span>Tentar de novo</span></button></div></div>`;
      }

      /* ---------------- Início ---------------- */
      function telaInicio() {
        exec = null;
        topo('Olá, ' + usuario.nome.split(' ')[0], cfg.NOME_CURTO, false);
        barra(null);
        elConteudo.innerHTML = html`<p class="texto-menor">Carregando…</p>`;
        return Promise.all([CKL.execucoes.meus(), CKL.modelos.ativos(), CKL.veiculos.meus()]).then(([meus, modelos, veics]) => {
          const andamento = meus.filter((e) => e.status === ST.EM_ANDAMENTO);
          const veiAndamento = veics.filter((v) => v.status === ST.EM_ANDAMENTO);
          // checklists e veículos enviados, do mais recente para o mais antigo
          const enviados = meus.filter((e) => e.status === ST.CONCLUIDO || e.status === ST.CONCLUIDO_NC).map((e) => ({ quando: e.concluidoEm || e.iniciadoEm, html: itemExecucao(e, 'ver') }))
            .concat(veics.filter((v) => v.status === ST.CONCLUIDO).map((v) => ({ quando: v.concluidoEm || v.dataHora, html: vei.itemLista(v, 'vei-abrir') })))
            .sort((a, b) => (a.quando < b.quando ? 1 : -1)).slice(0, 15);
          const aguardando = meus.concat(veics).filter((e) => e.situacaoEnvio !== cfg.SITUACAO_ENVIO.SINCRONIZADO && e.status !== ST.EM_ANDAMENTO && e.status !== 'descartado').length;
          const areas = CKL.modelos.areas(modelos).filter((a) => modelos.some((m) => m.area === a.id));
          elConteudo.innerHTML = html`
            <section class="op-secao">
              <div class="op-secao-topo"><h2>O que você vai fazer?</h2></div>
              <div class="ck-areas">
                ${areas.map((a) => html`
                  <button type="button" class="ck-area" data-acao="area" data-area="${a.id}">
                    <span class="ck-area-icone">${icone(a.icone, 34)}</span>
                    <span class="ck-area-texto"><strong>${a.rotulo}</strong><span>${a.descricao}</span>
                      <small>${util.plural(modelos.filter((m) => m.area === a.id).length, 'checklist', 'checklists')}</small></span>
                    ${icone('avancar', 24)}
                  </button>`)}
                <button type="button" class="ck-area ck-area-veiculo" data-acao="veiculos">
                  <span class="ck-area-icone">${icone('caminhao', 34)}</span>
                  <span class="ck-area-texto"><strong>Limpeza de veículo</strong><span>Conferência de descarga e autorização sem vistoria</span>
                    <small>2 formulários</small></span>
                  ${icone('avancar', 24)}
                </button>
              </div>
            </section>
            ${!modelos.length ? avisoSemModelos() : ''}
            ${andamento.length || veiAndamento.length ? html`
              <section class="op-secao">
                <div class="op-secao-topo"><h2>Em andamento</h2></div>
                <div class="op-lista">${andamento.map((e) => itemExecucao(e, 'continuar'))}${veiAndamento.map((v) => vei.itemLista(v, 'vei-continuar'))}</div>
              </section>` : ''}
            <section class="op-secao">
              <div class="op-secao-topo"><h2>Enviados por mim</h2>${aguardando && CKL.sincronizacao.configurada() ? ui.seloSimples(util.plural(aguardando, 'aguardando envio', 'aguardando envio'), 'selo-pendente', 'relogio') : ''}</div>
              ${enviados.length ? html`<div class="op-lista">${enviados.map((x) => x.html)}</div>`
                : html`<p class="op-ajuda">Os checklists e registros de veículo que você enviar aparecem aqui.</p>`}
            </section>
            <p class="op-nota">${icone(CKL.sincronizacao.configurada() ? 'nuvem' : 'celular', 16)}<span>${CKL.sincronizacao.configurada() ? 'Os checklists são enviados ao servidor sozinhos quando há internet.' : 'Dados guardados só neste aparelho (servidor central ainda não configurado).'}</span></p>`;
        });
      }
      function itemExecucao(e, acao) {
        const r = CKL.execucoes.resultado(e);
        return html`
          <button type="button" class="op-item" data-acao="${acao}" data-exec="${e.id}">
            <span class="op-item-semfoto">${icone(e.area === 'UBS' ? 'fabrica' : 'secador', 28)}</span>
            <span class="op-item-texto">
              <strong>${e.nome}</strong>
              <span>${e.identificacao} · ${util.fmtDataHora(e.iniciadoEm)}</span>
              <span>${e.status === ST.EM_ANDAMENTO ? r.avaliados + ' de ' + r.total + ' itens avaliados' : (r.naoConformes ? util.plural(r.naoConformes, 'item NC', 'itens NC') : 'Todos conformes ou não solicitados')}</span>
              <span class="op-item-selo selos">${ui.seloStatus(e.status)}${e.status !== ST.EM_ANDAMENTO ? ui.seloEnvio(e.situacaoEnvio) : ''}</span>
            </span>
            <span class="op-item-seta">${icone('avancar', 22)}</span>
          </button>`;
      }

      /* ---------------- 1. Área ---------------- */
      function telaAreas() {
        topo('Escolha a área', 'Novo checklist · passo 1 de 3', true);
        barra(null);
        return CKL.modelos.ativos().then((modelos) => {
          const areas = CKL.modelos.areas(modelos).filter((a) => modelos.some((m) => m.area === a.id));
          elConteudo.innerHTML = html`
            <p class="op-ajuda">Onde será feita a vistoria de limpeza?</p>
            <div class="ck-areas">
              ${areas.map((a) => html`
                <button type="button" class="ck-area" data-acao="area" data-area="${a.id}">
                  <span class="ck-area-icone">${icone(a.icone, 34)}</span>
                  <span class="ck-area-texto"><strong>${a.rotulo}</strong><span>${a.descricao}</span>
                    <small>${util.plural(modelos.filter((m) => m.area === a.id).length, 'checklist', 'checklists')}</small></span>
                  ${icone('avancar', 24)}
                </button>`)}
            </div>
            ${!areas.length ? ui.vazio('checklist', 'Nenhum checklist disponível', 'Peça ao administrador para carregar ou ativar os checklists.') : ''}`;
        });
      }

      /* ---------------- 2. Checklist da área ---------------- */
      function telaLista() {
        topo(estado.area, 'Novo checklist · passo 1 de 2', true);
        barra(null);
        return Promise.all([CKL.modelos.ativos(), CKL.execucoes.listar()]).then(([modelos, todas]) => {
          const lista = modelos.filter((m) => m.area === estado.area);
          elConteudo.innerHTML = html`
            <p class="op-ajuda">Escolha o checklist. Cada um tem os equipamentos do próprio documento.</p>
            <div class="op-lista">
              ${lista.map((m) => {
                const doModelo = todas.filter((e) => e.modeloId === m.id && e.status !== 'descartado');
                const ult = doModelo.filter((e) => e.status !== ST.EM_ANDAMENTO)[0];
                const andamento = doModelo.filter((e) => e.status === ST.EM_ANDAMENTO);
                return html`
                  <button type="button" class="op-item" data-acao="modelo" data-modelo="${m.id}">
                    <span class="op-item-semfoto ck-ident">${m.identificacao.replace('CKL ', 'CKL ')}</span>
                    <span class="op-item-texto">
                      <strong>${m.nome}</strong>
                      <span>${util.plural(CKL.modelos.itensAtivos(m).length, 'item', 'itens')} · versão ${m.versaoDocumento || '—'}</span>
                      <span>${ult ? 'Último: ' + util.fmtData(ult.dataExecucao) + ' · ' + cfg.ROTULO_STATUS[ult.status] : 'Nenhum checklist enviado neste aparelho'}</span>
                      ${andamento.length ? html`<span class="op-item-selo">${ui.seloStatus(ST.EM_ANDAMENTO)}</span>` : ''}
                    </span>
                    <span class="op-item-seta">${icone('avancar', 22)}</span>
                  </button>`;
              })}
            </div>`;
        });
      }

      /* ---------------- 3. Dados iniciais ---------------- */
      function telaAbrir() {
        topo('Informações iniciais', 'Novo checklist · passo 2 de 2', true);
        return Promise.all([CKL.modelos.obter(estado.modeloId), CKL.execucoes.meus(), CKL.cultivares.opcoes()]).then(([m, meus, cultivares]) => {
          if (!m) { ir('lista'); return; }
          const aberto = meus.filter((e) => e.modeloId === m.id && e.status === ST.EM_ANDAMENTO)[0];
          elConteudo.innerHTML = html`
            <div class="cartao ck-doc">
              <span class="ck-doc-cabecalho">${m.cabecalho}</span>
              <h2>${m.titulo}</h2>
              ${ui.dados(ui.paresDoDocumento(m), 'dados-2col')}
            </div>
            ${aberto ? html`<div class="alerta alerta-alerta">${icone('alerta', 20)}<div><strong>Você já tem este checklist em andamento.</strong>
              <p>Iniciado em ${util.fmtDataHora(aberto.iniciadoEm)}. Continue o que já começou ou inicie um novo.</p>
              <button type="button" class="btn btn-secundario" data-acao="continuar" data-exec="${aberto.id}">Continuar o checklist em andamento</button></div></div>` : ''}
            <form class="cartao formulario" id="form-inicio" novalidate>
              <span class="op-rotulo-g">Informações relevantes</span>
              ${ui.campoCultivar('ini-anterior', 'Cultivar anterior', '', cultivares)}
              ${ui.campoCultivar('ini-proxima', 'Próxima cultivar', '', cultivares)}
              <p class="campo-ajuda">Você pode completar esses campos depois, antes de enviar.</p>
            </form>
            <details class="cartao ck-orientacao"><summary>Orientação do checklist</summary>${(m.orientacao || []).map((o) => html`<p>${o}</p>`)}</details>`;
          barra(html`<button type="button" class="btn btn-primario btn-g btn-bloco" data-acao="iniciar">${icone('checklist', 22)}<span>Iniciar a vistoria</span></button>`);
        });
      }
      function iniciar(botao) {
        const q = (s) => elConteudo.querySelector(s);
        ui.ocupar(botao, () => CKL.execucoes.iniciar(estado.modeloId, { cultivarAnterior: q('#ini-anterior').value, proximaCultivar: q('#ini-proxima').value }))
          .then((e) => { if (e) ir('execucao', { execId: e.id, filtro: 'todos' }); }).catch(ui.erro);
      }

      /* ---------------- Preenchimento dos itens ---------------- */
      function carregarExec() {
        return CKL.execucoes.obter(estado.execId).then((e) => { exec = e; return e; });
      }
      function filtrar(e, i) {
        const r = e.respostas[i.id];
        if (estado.filtro === 'faltam') return !r || !r.avaliacao || pendenteItem(e, i);
        if (estado.filtro === 'nc') return r && r.avaliacao === 'NC';
        return true;
      }
      function pendenteItem(e, i) { return CKL.execucoes.pendencias(e).some((p) => p.itemId === i.id); }

      function telaExecucao() {
        return carregarExec().then((e) => {
          if (!e) { ir('inicio'); return; }
          if (e.status !== ST.EM_ANDAMENTO) { ir('ver', { execId: e.id }); return; }
          topo(e.nome, e.identificacao + ' · ' + e.area, true);
          progresso(e);
          desenharExecucao();
          if (estado.rolarPara) {
            const alvo = elConteudo.querySelector('#item-' + CSS.escape(estado.rolarPara));
            estado.rolarPara = null;
            if (alvo) setTimeout(() => { alvo.scrollIntoView({ block: 'center' }); alvo.classList.add('ck-destaque'); const c = alvo.querySelector('textarea, input'); if (c) c.focus({ preventScroll: true }); }, 60);
          }
        });
      }
      function contagem(e) {
        const r = CKL.execucoes.resultado(e);
        const faltam = CKL.execucoes.itens(e).filter((i) => { const x = e.respostas[i.id]; return !x || !x.avaliacao || pendenteItem(e, i); }).length;
        return { r, faltam };
      }
      function desenharExecucao() {
        const e = exec, c = contagem(e), itens = CKL.execucoes.itens(e).filter((i) => filtrar(e, i));
        let secao = null;
        elConteudo.innerHTML = html`
          <div class="ck-resumo-exec">
            <div><strong>${c.r.avaliados}</strong><span>de ${c.r.total} avaliados</span></div>
            <div class="${c.r.naoConformes ? 'ck-tem-nc' : ''}"><strong>${c.r.naoConformes}</strong><span>NC</span></div>
            <div><strong>${c.faltam}</strong><span>com pendência</span></div>
          </div>
          <div class="abas ck-filtros" role="tablist" aria-label="Filtrar itens">
            ${[['todos', 'Todos', c.r.total], ['faltam', 'Pendentes', c.faltam], ['nc', 'NC', c.r.naoConformes]].map((f) => html`
              <button type="button" role="tab" class="${estado.filtro === f[0] ? 'ativa' : ''}" aria-selected="${estado.filtro === f[0]}" data-acao="filtro" data-filtro="${f[0]}">${f[1]}<span>${f[2]}</span></button>`)}
          </div>
          <div class="ck-itens" id="ck-itens">
            ${itens.map((i) => {
              const cab = i.secao && i.secao !== secao ? html`<h3 class="ck-secao">${i.secao}</h3>` : '';
              secao = i.secao || secao;
              return html`${cab}${cartaoItem(e, i)}`;
            })}
            ${!itens.length ? ui.vazio('checkCirculo', estado.filtro === 'nc' ? 'Nenhum item não conforme' : 'Nenhuma pendência nos itens', 'Toque em "Todos" para ver todos os itens.') : ''}
          </div>`;
        barra(html`
          <button type="button" class="btn btn-primario btn-g btn-cresce" data-acao="revisar">${icone('checkCirculo', 22)}<span>Revisar e enviar</span></button>`);
      }

      function cartaoItem(e, i) {
        const r = e.respostas[i.id] || {}, a = r.avaliacao, fin = CKL.execucoes.situacaoFinal(r);
        const reav = r.reavaliacoes || [], ult = reav[reav.length - 1];
        const podeReavaliar = a === 'NC' && !(ult && ult.resultado === 'C') && reav.length < cfg.MAX_REAVALIACOES;
        const pl = r.plano || {};
        const exigePlano = a === 'NC' && fin === 'NC';
        const fotos = r.fotos || [];
        const botao = (v, rot, ic) => html`<button type="button" class="ck-opcao ck-opcao-${v.toLowerCase()} ${a === v ? 'marcada' : ''}" aria-pressed="${a === v}" data-acao="avaliar" data-item="${i.id}" data-valor="${v}">${icone(ic, 22)}<span>${rot}</span></button>`;
        return html`
          <article class="ck-item ${a ? 'ck-item-' + a.toLowerCase() : 'ck-item-vazio'} ${pendenteItem(e, i) && a ? 'ck-item-pendente' : ''}" id="item-${i.id}" data-item="${i.id}">
            <header class="ck-item-topo">
              <span class="ck-item-num" aria-hidden="true">${i.ordem}</span>
              <h3><span class="so-leitor">Item ${i.ordem}: </span>${i.texto}</h3>
            </header>
            <div class="ck-escolha" role="group" aria-label="Avaliação do item ${i.ordem}">
              ${botao('C', 'C', 'check')}${botao('NC', 'NC', 'x')}${botao('NS', 'Não solicitado', 'menos')}
            </div>
            ${a ? html`<p class="ck-hora">${icone('relogio', 14)}${cfg.ROTULO_AVALIACAO[a]} · ${util.fmtDataHora(r.em)}${fin === 'C' && a === 'NC' ? html` · <strong>liberado na ${ult.rodada}ª reavaliação</strong>` : ''}</p>` : ''}
            ${a === 'NC' ? html`
              <div class="campo">
                <label for="d-${i.id}">Descrição da não conformidade</label>
                <textarea id="d-${i.id}" rows="2" maxlength="${cfg.TEXTO_MAXIMO}" data-campo="descricao" data-item="${i.id}" placeholder="O que foi encontrado (ex.: resto de sementes no fundo)">${r.descricao || ''}</textarea>
              </div>
              <section class="ck-bloco">
                <h4>Reavaliação <small>(até ${cfg.MAX_REAVALIACOES})</small></h4>
                <p class="campo-ajuda">Solicite a limpeza e reavalie. Quando ficar conforme, o equipamento está liberado.</p>
                ${reav.length ? html`<ol class="ck-reav-lista">${reav.map((x) => html`<li class="${x.resultado === 'C' ? 'ok' : 'nc'}">${icone(x.resultado === 'C' ? 'checkCirculo' : 'x', 16)}<span><strong>${x.rodada}ª reavaliação: ${x.resultado === 'C' ? 'C — liberado' : 'NC'}</strong> · ${util.fmtDataHora(x.em)}</span></li>`)}</ol>` : ''}
                ${podeReavaliar ? html`
                  <div class="ck-reav-botoes">
                    <span>${reav.length + 1}ª reavaliação:</span>
                    <button type="button" class="btn btn-secundario ck-reav-c" data-acao="reavaliar" data-item="${i.id}" data-valor="C">${icone('check', 18)}<span>C — liberado</span></button>
                    <button type="button" class="btn btn-secundario ck-reav-nc" data-acao="reavaliar" data-item="${i.id}" data-valor="NC">${icone('x', 18)}<span>Ainda NC</span></button>
                  </div>` : ''}
                ${reav.length ? html`<button type="button" class="btn btn-fantasma btn-p" data-acao="desfazer-reav" data-item="${i.id}">${icone('desfazer', 16)}<span>Desfazer a última reavaliação</span></button>` : ''}
              </section>
              <section class="ck-bloco">
                <h4>Plano de ação ${exigePlano ? html`<small class="ck-obrig">obrigatório enquanto não for liberado</small>` : html`<small>(opcional)</small>`}</h4>
                <div class="campo"><label for="po-${i.id}">O que será feito?</label><textarea id="po-${i.id}" rows="2" maxlength="${cfg.TEXTO_MAXIMO}" data-campo="plano.oQue" data-item="${i.id}">${pl.oQue || ''}</textarea></div>
                <div class="campo"><label for="pc-${i.id}">Como? <span class="opcional">(opcional)</span></label><textarea id="pc-${i.id}" rows="2" maxlength="${cfg.TEXTO_MAXIMO}" data-campo="plano.como" data-item="${i.id}">${pl.como || ''}</textarea></div>
                <div class="formulario-linha">
                  <div class="campo"><label for="pq-${i.id}">Quem?</label><input id="pq-${i.id}" maxlength="120" autocomplete="off" data-campo="plano.quem" data-item="${i.id}" value="${pl.quem || ''}"></div>
                  <div class="campo"><label for="pd-${i.id}">Data prevista de conclusão</label><input id="pd-${i.id}" type="date" data-campo="plano.dataPrevista" data-item="${i.id}" value="${pl.dataPrevista || ''}" min="${util.dataLocal()}"></div>
                </div>
              </section>` : ''}
            <div class="ck-fotos">
              ${fotos.length ? html`<span class="ck-fotos-lista" data-fotos="${i.id}"></span>` : ''}
              <label class="btn btn-secundario btn-p ck-foto-botao">${icone('camera', 16)}<span>Fotografar</span>
                <input type="file" accept="image/*" capture="environment" data-foto="${i.id}" hidden></label>
              <label class="btn btn-secundario btn-p ck-foto-botao">${icone('imagem', 16)}<span>Galeria</span>
                <input type="file" accept="image/*" data-foto="${i.id}" hidden></label>
              ${fotos.length ? html`<small>${util.plural(fotos.length, 'foto', 'fotos')}</small>` : ''}
            </div>
            <details class="ck-obs" ${r.observacao ? ui.bruto('open') : ''}>
              <summary>Observação <span class="opcional">(opcional)</span></summary>
              <textarea rows="2" maxlength="${cfg.TEXTO_MAXIMO}" aria-label="Observação do item ${i.ordem}" data-campo="observacao" data-item="${i.id}" placeholder="Dificuldade na limpeza ou outra informação relevante">${r.observacao || ''}</textarea>
            </details>
          </article>`;
      }

      /** Miniaturas das fotos do item (lidas do banco do aparelho). */
      function preencherFotos(raizItens) {
        const alvos = Array.from((raizItens || elConteudo).querySelectorAll('[data-fotos]'));
        if (!alvos.length || !exec) return;
        CKL.execucoes.fotosDe(exec.id).then((fotos) => {
          alvos.forEach((el) => {
            const ids = (exec.respostas[el.dataset.fotos] || {}).fotos || [];
            el.innerHTML = html`${ids.map((id) => fotos.filter((f) => f.id === id)[0]).filter(Boolean).map((f) =>
              html`<button type="button" class="ck-mini" data-acao="ver-foto" data-item="${el.dataset.fotos}" data-foto-id="${f.id}" aria-label="Ver fotografia"><img src="${f.miniatura}" alt=""></button>`)}`;
          });
        }).catch(() => {});
      }

      /** Redesenha só o cartão do item (sem perder a rolagem da tela). */
      function atualizarItem(itemId) {
        const el = elConteudo.querySelector('#item-' + CSS.escape(itemId));
        const item = CKL.execucoes.itens(exec).filter((i) => i.id === itemId)[0];
        if (!el || !item) { desenharExecucao(); preencherFotos(); return; }
        const tmp = document.createElement('div');
        tmp.innerHTML = String(cartaoItem(exec, item));
        const novo = tmp.firstElementChild;
        el.replaceWith(novo);
        preencherFotos(novo);
        progresso(exec);
        const c = contagem(exec), res = elConteudo.querySelector('.ck-resumo-exec');
        if (res) res.outerHTML = String(html`
          <div class="ck-resumo-exec">
            <div><strong>${c.r.avaliados}</strong><span>de ${c.r.total} avaliados</span></div>
            <div class="${c.r.naoConformes ? 'ck-tem-nc' : ''}"><strong>${c.r.naoConformes}</strong><span>NC</span></div>
            <div><strong>${c.faltam}</strong><span>com pendência</span></div>
          </div>`);
        const abas = elConteudo.querySelectorAll('.ck-filtros button span');
        if (abas.length === 3) { abas[0].textContent = c.r.total; abas[1].textContent = c.faltam; abas[2].textContent = c.r.naoConformes; }
        return novo;
      }

      /** Grava os textos pendentes, executa a ação e redesenha o cartão do item. */
      function aplicar(acao, itemId, depois) {
        return guardarTextos().then(acao).then((e) => { exec = e; const novo = atualizarItem(itemId); if (depois) depois(novo); }).catch(ui.erro);
      }

      /* textos: grava 700 ms depois de parar de digitar, e na saída do campo */
      function gravarTexto(el) {
        const itemId = el.dataset.item, campo = el.dataset.campo, valor = el.value;
        const d = {};
        if (campo.indexOf('plano.') === 0) d.plano = { [campo.slice(6)]: valor }; else d[campo] = valor;
        const p = itemId ? CKL.execucoes.definirTextos(exec.id, itemId, d) : CKL.execucoes.definirGerais(exec.id, d);
        return p.then((e) => { exec = e; atualizarPendencias(); }).catch(ui.erro);
      }
      function agendarTexto(el) {
        const chave = (el.dataset.item || 'geral') + '|' + el.dataset.campo;
        clearTimeout((salvando.get(chave) || {}).t);
        salvando.set(chave, { el: el, t: setTimeout(() => { salvando.delete(chave); gravarTexto(el); }, 700) });
      }
      function guardarTextos() {
        const pend = Array.from(salvando.values());
        salvando.clear();
        return pend.reduce((c, x) => { clearTimeout(x.t); return c.then(() => gravarTexto(x.el)); }, Promise.resolve());
      }

      function receberFoto(input) {
        const arquivo = input.files && input.files[0], itemId = input.dataset.foto;
        input.value = '';
        if (!arquivo || !exec) return;
        const r = exec.respostas[itemId] || {};
        const contexto = r.avaliacao === 'NC' && (r.reavaliacoes || []).length ? 'reavaliacao' : 'avaliacao';
        const fim = ui.carregando('Preparando a fotografia…');
        CKL.imagem.processar(arquivo).then((res) => {
          fim();
          if (!res.ok) { ui.aviso(res.erros.join(' '), 'erro'); return; }
          if (res.avisos.length) ui.aviso(res.avisos.join(' '), 'alerta');
          return aplicar(() => CKL.execucoes.adicionarFoto(exec.id, itemId, res.foto, contexto), itemId, () => ui.aviso('Fotografia anexada ao item.', 'ok', 2500));
        }, (e) => { fim(); ui.erro(e); });
      }

      function verFoto(itemId, fotoId) {
        CKL.execucoes.fotosDe(exec ? exec.id : estado.execId).then((fotos) => {
          const f = fotos.filter((x) => x.id === fotoId)[0];
          if (!f) return;
          const urls = ui.GerenteUrls();
          const editavel = exec && exec.status === ST.EM_ANDAMENTO;
          ui.modal({
            titulo: 'Fotografia', largura: 'g', aoFechar: () => urls.liberar(),
            conteudo: html`<img class="op-foto-grande" src="${urls.daFoto(f)}" alt="Fotografia do item ${f.itemOrdem}">
              <p class="texto-menor">Item ${f.itemOrdem} — ${f.itemTexto} · ${f.contexto === 'reavaliacao' ? 'reavaliação' : 'avaliação'} · ${util.fmtDataHora(f.capturadaEm)}</p>`,
            acoes: editavel ? [{ rotulo: 'Remover foto', classe: 'btn-perigo-suave', icone: 'lixeira', acao: (m) => {
              m.fechar();
              aplicar(() => CKL.execucoes.removerFoto(exec.id, itemId, fotoId), itemId);
            } }, { rotulo: 'Fechar', classe: 'btn-primario', acao: (m) => m.fechar() }] : [{ rotulo: 'Fechar', classe: 'btn-primario', acao: (m) => m.fechar() }]
          });
        }).catch(ui.erro);
      }

      /* ---------------- Revisão e envio ---------------- */
      function pendenciasHtml(pend) {
        return pend.length ? html`
          <section class="cartao ck-pendencias">
            <h2>${icone('alerta', 20)} ${util.plural(pend.length, 'pendência', 'pendências')} antes de enviar</h2>
            <ul>${pend.map((p) => html`<li><button type="button" class="ck-pend" data-acao="ir-pendencia" data-item="${p.itemId || ''}" data-campo="${p.campo}">${p.mensagem}${icone('avancar', 18)}</button></li>`)}</ul>
          </section>` : html`<div class="alerta alerta-ok">${icone('checkCirculo', 20)}<div><strong>Tudo preenchido.</strong><p>Confira os dados abaixo e envie.</p></div></div>`;
      }
      /** Atualiza a lista de pendências da revisão depois de cada campo preenchido. */
      function atualizarPendencias() {
        if (estado.tela !== 'revisao' || !exec) return;
        const alvo = elConteudo.querySelector('#rv-pend');
        const pend = CKL.execucoes.pendencias(exec);
        if (alvo) alvo.innerHTML = String(pendenciasHtml(pend));
        const b = elBarra.querySelector('[data-acao=enviar]');
        if (b) { if (pend.length) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled'); }
      }
      function telaRevisao() {
        return guardarTextos().then(carregarExec).then((e) => (e ? CKL.cultivares.opcoes([e.cultivarAnterior, e.proximaCultivar]) : []).then((cultivares) => {
          if (!e) { ir('inicio'); return; }
          if (e.status !== ST.EM_ANDAMENTO) { ir('ver', { execId: e.id }); return; }
          topo('Revisar e enviar', e.nome + ' · ' + e.identificacao, true);
          progresso(e);
          const r = CKL.execucoes.resultado(e), pend = CKL.execucoes.pendencias(e), m = e.modelo;
          const ncFinal = r.naoLiberados > 0;
          elConteudo.innerHTML = html`
            <div class="resumo-linha ck-resumo-final">
              <div><span>Itens avaliados</span><strong>${r.avaliados} / ${r.total}</strong></div>
              <div><span>Conformes (C)</span><strong>${r.conformes}</strong></div>
              <div class="${r.naoConformes ? 'ck-tem-nc' : ''}"><span>Não conformes (NC)</span><strong>${r.naoConformes}</strong></div>
              <div><span>Não solicitados</span><strong>${r.naoSolicitados}</strong></div>
            </div>
            ${r.naoConformes ? html`<div class="alerta ${ncFinal ? 'alerta-erro' : 'alerta-alerta'}">${icone('alerta', 20)}<div>
              <strong>${util.plural(r.naoConformes, 'item não conforme', 'itens não conformes')}</strong>
              <p>${r.liberadosReavaliacao ? util.plural(r.liberadosReavaliacao, 'liberado', 'liberados') + ' na reavaliação' + (r.rodadaLiberacao ? ' (até a ' + r.rodadaLiberacao + 'ª)' : '') + '. ' : ''}${r.naoLiberados ? util.plural(r.naoLiberados, 'continua não liberado', 'continuam não liberados') + '.' : ''}
              As não conformidades ficam registradas e só são encerradas pelo administrador.</p></div></div>` : ''}
            <div id="rv-pend">${pendenciasHtml(pend)}</div>
            <form class="cartao formulario" id="form-revisao" novalidate>
              <span class="op-rotulo-g">Informações relevantes</span>
              <div class="formulario-linha">
                ${ui.campoCultivar('rv-anterior', 'Cultivar anterior', e.cultivarAnterior, cultivares, 'cultivarAnterior')}
                ${ui.campoCultivar('rv-proxima', 'Próxima cultivar', e.proximaCultivar, cultivares, 'proximaCultivar')}
              </div>
              <div class="campo"><label for="rv-obs">${(m.rotuloObservacoes || 'Observações').replace(/:$/, '')} <span class="opcional">(opcional)</span></label>
                <textarea id="rv-obs" rows="3" maxlength="${cfg.TEXTO_MAXIMO * 2}" data-campo="observacoes">${e.observacoes || ''}</textarea></div>
            </form>
            ${m.temTermo ? html`
              <fieldset class="cartao ck-termo" id="rv-termo">
                <legend class="op-rotulo-g">Termo de conclusão da inspeção</legend>
                <p>${m.termoConclusao}</p>
                <div class="ck-termo-opcoes">
                  <label class="opcao"><input type="radio" name="termo" value="${cfg.TERMO.LIBERADA}" ${e.termo === cfg.TERMO.LIBERADA ? ui.bruto('checked') : ''} ${ncFinal ? ui.bruto('disabled') : ''}><span>${icone('checkCirculo', 20)}Liberada</span></label>
                  <label class="opcao"><input type="radio" name="termo" value="${cfg.TERMO.NAO_LIBERADA}" ${e.termo === cfg.TERMO.NAO_LIBERADA ? ui.bruto('checked') : ''}><span>${icone('x', 20)}Não Liberada</span></label>
                </div>
                ${ncFinal ? html`<p class="campo-ajuda">Há equipamento não liberado: a UBS não pode ser marcada como Liberada.</p>` : ''}
              </fieldset>` : ''}
            <section class="cartao formulario" id="rv-assinaturas">
              <span class="op-rotulo-g">Assinaturas</span>
              ${ui.dados([['Responsável pela vistoria', e.responsavelNome + ' (você)']])}
              <div class="campo"><label for="rv-operador">Nome do operador do ponto</label><input id="rv-operador" maxlength="120" autocomplete="off" data-campo="operadorNome" value="${(e.operadorLocal && e.operadorLocal.nome) || ''}"></div>
              <div class="campo"><span class="ck-rotulo">Assinatura do operador do ponto <span class="opcional">(opcional)</span></span><div id="rv-assinatura"></div></div>
            </section>
            <button type="button" class="btn btn-fantasma ck-descartar" data-acao="descartar">${icone('lixeira', 18)}<span>Descartar este checklist</span></button>`;
          ui.assinatura(elConteudo.querySelector('#rv-assinatura'), {
            valor: e.operadorLocal && e.operadorLocal.assinatura,
            aoMudar: (png) => CKL.execucoes.definirGerais(e.id, { assinatura: png }).then((x) => { exec = x; atualizarPendencias(); }).catch(ui.erro)
          });
          barra(html`<button type="button" class="btn btn-acento btn-g btn-cresce" data-acao="enviar" ${pend.length ? ui.bruto('aria-disabled="true"') : ''}>${icone('upload', 22)}<span>Enviar checklist</span></button>`);
        }));
      }
      function enviar(botao) {
        guardarTextos().then(carregarExec).then((e) => {
          const pend = CKL.execucoes.pendencias(e);
          if (pend.length) { ui.aviso('Resolva as pendências antes de enviar (' + pend.length + ').', 'erro'); telaRevisao(); return; }
          const r = CKL.execucoes.resultado(e);
          return ui.confirmar({
            titulo: 'Enviar o checklist?',
            mensagem: 'Depois de enviado, o checklist não pode mais ser alterado pelo aplicativo. Correções só pelo administrador.',
            detalhe: r.total + ' itens · ' + r.conformes + ' C · ' + r.naoConformes + ' NC · ' + r.naoSolicitados + ' não solicitados' + (e.modelo.temTermo ? ' · UBS ' + cfg.ROTULO_TERMO[e.termo] : ''),
            rotuloConfirmar: 'Enviar'
          }).then((ok) => {
            if (!ok) return;
            return ui.ocupar(botao, () => CKL.execucoes.finalizar(e.id)).then((x) => { exec = x; ir('enviado', { execId: x.id }); });
          });
        }).catch((er) => { ui.erro(er); if (er && er.pendencias) telaRevisao(); });
      }
      function descartar() {
        ui.confirmar({
          titulo: 'Descartar este checklist?',
          mensagem: 'Use quando o checklist foi iniciado por engano. Ele fica registrado como descartado e deixa de aparecer em andamento.',
          rotuloConfirmar: 'Descartar', perigo: true, motivo: { rotulo: 'Motivo', obrigatorio: true, dica: 'Ex.: escolhi o secador errado' }
        }).then((resp) => {
          if (!resp) return;
          return CKL.execucoes.descartar(exec.id, resp.motivo).then(() => { ui.aviso('Checklist descartado.', 'ok'); ir('inicio'); });
        }).catch(ui.erro);
      }

      /* ---------------- Enviado / consulta ---------------- */
      function telaEnviado() {
        return carregarExec().then((e) => {
          topo('Checklist enviado', e.nome, false);
          const r = e.resultado || CKL.execucoes.resultado(e);
          elConteudo.innerHTML = html`
            <div class="op-sucesso">
              <span class="op-sucesso-icone">${icone('checkCirculo', 44)}</span>
              <h1>Checklist concluído</h1>
              <div class="op-sucesso-envio">${ui.seloStatus(e.status)}${ui.seloEnvio(e.situacaoEnvio)}</div>
              <div class="op-protocolo"><span>Protocolo</span><strong>${e.protocolo}</strong></div>
              ${ui.dados([['Checklist', e.nome + ' · ' + e.identificacao], ['Data', util.fmtData(e.dataExecucao)],
                ['Conclusão', util.fmtDataHora(e.concluidoEm)], ['Resultado', r.conformes + ' C · ' + r.naoConformes + ' NC · ' + r.naoSolicitados + ' não solicitados'],
                e.modelo.temTermo ? ['Termo', 'UBS ' + cfg.ROTULO_TERMO[e.termo]] : null], 'dados-2col')}
              <div class="op-sucesso-acoes">
                <button type="button" class="btn btn-secundario btn-g btn-bloco" data-acao="pdf">${icone('pdf', 20)}<span>Gerar relatório PDF</span></button>
                ${CKL.arquivos.podeCompartilhar() ? html`<button type="button" class="btn btn-secundario btn-g btn-bloco" data-acao="compartilhar">${icone('compartilhar', 20)}<span>Compartilhar PDF</span></button>` : ''}
              </div>
            </div>`;
          barra(html`<button type="button" class="btn btn-primario btn-g btn-bloco" data-acao="inicio">${icone('voltar', 22)}<span>Voltar ao início</span></button>`);
        });
      }
      function telaVer() {
        return carregarExec().then((e) => {
          if (!e) { ir('inicio'); return; }
          topo(e.nome, e.identificacao + ' · ' + util.fmtData(e.dataExecucao), true);
          const r = e.resultado || CKL.execucoes.resultado(e);
          elConteudo.innerHTML = html`
            <div class="cartao">
              <div class="selos">${ui.seloStatus(e.status)}${ui.seloEnvio(e.situacaoEnvio)}${e.correcoes && e.correcoes.length ? ui.seloSimples('Corrigido pelo administrador', 'selo-info', 'editar') : ''}</div>
              ${e.erroEnvio ? html`<div class="alerta alerta-erro">${icone('nuvemErro', 20)}<span>${e.erroEnvio}</span></div>` : ''}
              ${ui.dados([['Protocolo', e.protocolo], ['Início', util.fmtDataHora(e.iniciadoEm)], ['Conclusão', util.fmtDataHora(e.concluidoEm)],
                ['Cultivar anterior', e.cultivarAnterior], ['Próxima cultivar', e.proximaCultivar], ['Operador do ponto', e.operadorLocal && e.operadorLocal.nome],
                ['Resultado', r.conformes + ' C · ' + r.naoConformes + ' NC · ' + r.naoSolicitados + ' não solicitados'],
                e.modelo.temTermo ? ['Termo', 'UBS ' + (cfg.ROTULO_TERMO[e.termo] || '—')] : null,
                e.observacoes ? { rotulo: 'Observações', valor: e.observacoes, largo: true } : null], 'dados-2col')}
            </div>
            <ol class="ck-lista-leitura">
              ${CKL.execucoes.itens(e).map((i) => {
                const x = e.respostas[i.id] || {};
                return html`<li class="${x.avaliacao === 'NC' ? 'nc' : ''}">
                  <span class="ck-item-num">${i.ordem}</span>
                  <div><strong>${i.texto}</strong>
                    <div class="selos">${ui.seloAvaliacao(x.avaliacao)}${(x.reavaliacoes || []).map((rv) => ui.seloSimples(rv.rodada + 'ª reav.: ' + rv.resultado, rv.resultado === 'C' ? 'selo-registrada' : 'selo-cancelada'))}</div>
                    ${x.descricao ? html`<p>${x.descricao}</p>` : ''}${x.observacao ? html`<p class="texto-menor">${x.observacao}</p>` : ''}
                    ${(x.fotos || []).length ? html`<span class="ck-fotos-lista" data-fotos="${i.id}"></span>` : ''}
                  </div></li>`;
              })}
            </ol>`;
          barra(html`<button type="button" class="btn btn-secundario btn-g btn-cresce" data-acao="pdf">${icone('pdf', 20)}<span>Relatório PDF</span></button>`);
          preencherFotos();
        });
      }

      /* ---------------- Eventos ---------------- */
      function aoClicar(ev) {
        const b = ev.target.closest('[data-acao]');
        if (!b || !raiz.contains(b)) return;
        const a = b.dataset.acao;
        if (a === 'voltar') voltar();
        else if (a === 'menu') abrirMenu();
        else if (a === 'novo') ir('inicio');
        else if (a === 'veiculos') ir('veiculos');
        else if (a === 'baixar-modelos') {
          ui.ocupar(b, () => CKL.nuvem.sincronia.ciclo()).then(() => desenhar()).catch(ui.erro);
        }
        else if (a.indexOf('vei-') === 0) vei.aoClicar(b, a);
        else if (a === 'area') ir('lista', { area: b.dataset.area });
        else if (a === 'modelo') ir('abrir', { modeloId: b.dataset.modelo });
        else if (a === 'iniciar') iniciar(b);
        else if (a === 'continuar') ir('execucao', { execId: b.dataset.exec, filtro: 'todos' });
        else if (a === 'ver') ir('ver', { execId: b.dataset.exec });
        else if (a === 'inicio') ir('inicio');
        else if (a === 'filtro') { estado.filtro = b.dataset.filtro; guardarTextos().then(() => { desenharExecucao(); preencherFotos(); }); }
        else if (a === 'avaliar') {
          const itemId = b.dataset.item, v = b.dataset.valor, atual = (exec.respostas[itemId] || {}).avaliacao;
          const trocar = () => aplicar(() => CKL.execucoes.avaliar(exec.id, itemId, v), itemId, (novo) => {
            if (v === 'NC' && novo) { const d = novo.querySelector('textarea[data-campo="descricao"]'); if (d && !d.value) d.focus(); }
          });
          if (atual === 'NC' && v !== 'NC' && (exec.respostas[itemId].reavaliacoes || []).length) {
            ui.confirmar({ titulo: 'Trocar a avaliação?', mensagem: 'As reavaliações registradas neste item serão apagadas.', rotuloConfirmar: 'Trocar' }).then((ok) => { if (ok) trocar(); });
          } else trocar();
        }
        else if (a === 'reavaliar') aplicar(() => CKL.execucoes.reavaliar(exec.id, b.dataset.item, b.dataset.valor), b.dataset.item);
        else if (a === 'desfazer-reav') aplicar(() => CKL.execucoes.desfazerReavaliacao(exec.id, b.dataset.item), b.dataset.item);
        else if (a === 'ver-foto') verFoto(b.dataset.item, b.dataset.fotoId);
        else if (a === 'revisar') ir('revisao');
        else if (a === 'ir-pendencia') {
          if (b.dataset.item) ir('execucao', { filtro: 'todos', rolarPara: b.dataset.item });
          else {
            const alvo = { cultivarAnterior: '#rv-anterior', proximaCultivar: '#rv-proxima', termo: '#rv-termo', operadorLocal: '#rv-operador' }[b.dataset.campo];
            const el = alvo && elConteudo.querySelector(alvo);
            if (el) { el.scrollIntoView({ block: 'center' }); if (el.focus) el.focus({ preventScroll: true }); }
          }
        }
        else if (a === 'enviar') enviar(b);
        else if (a === 'descartar') descartar();
        else if (a === 'pdf') ui.gerarPdf(estado.execId, b);
        else if (a === 'compartilhar') ui.compartilharPdf(estado.execId, b);
      }
      function aoDigitar(ev) {
        if (telaVeiculo(estado.tela)) { vei.aoDigitar(ev); return; }
        const el = ev.target;
        if (el.dataset && el.dataset.campo && exec) agendarTexto(el);
      }
      function aoMudar(ev) {
        if (telaVeiculo(estado.tela)) { vei.aoMudar(ev); return; }
        const el = ev.target;
        if (el.matches('input[type=file][data-foto]')) { receberFoto(el); return; }
        if (el.name === 'termo' && exec) { CKL.execucoes.definirGerais(exec.id, { termo: el.value }).then((e) => { exec = e; atualizarPendencias(); }).catch(ui.erro); return; }
        if (el.dataset && el.dataset.campo && exec) {
          const chave = (el.dataset.item || 'geral') + '|' + el.dataset.campo;
          clearTimeout((salvando.get(chave) || {}).t); salvando.delete(chave);
          gravarTexto(el).then(() => {
            // o plano e a descrição mudam as pendências do item
            if (el.dataset.item && estado.tela === 'execucao') {
              const art = el.closest('.ck-item');
              if (art) art.classList.toggle('ck-item-pendente', pendenteItem(exec, { id: el.dataset.item }));
            }
          });
        }
      }
      const aoConexao = () => { if (montado && ['inicio', 'area', 'lista'].indexOf(estado.tela) >= 0) desenhar(); else if (montado) { const t = elTopo.querySelector('.op-topo-titulo strong'); if (t) topo(t.textContent, (elTopo.querySelector('.op-topo-titulo span') || {}).textContent, estado.tela !== 'inicio' && estado.tela !== 'enviado'); } };
      const aoMudarDados = (d) => {
        if (!montado || (d && d.origem !== 'servidor' && d.origem !== 'fila')) return;
        if (estado.tela === 'inicio' || estado.tela === 'lista' || estado.tela === 'veiculos') desenhar();
      };
      raiz.addEventListener('click', aoClicar);
      raiz.addEventListener('input', aoDigitar);
      raiz.addEventListener('change', aoMudar);
      const desligar = [
        CKL.eventos.ouvir('conexao:alterada', aoConexao),
        CKL.eventos.ouvir('execucoes:alterado', aoMudarDados),
        CKL.eventos.ouvir('veiculos:alterado', aoMudarDados),
        CKL.eventos.ouvir('modelos:alterado', () => { if (montado && ['inicio', 'area', 'lista'].indexOf(estado.tela) >= 0) desenhar(); }),
        // início sem modelos: mostra "baixando…", o erro ou os checklists que chegaram
        ...['sincronia:inicio', 'sincronia:falha', 'sincronia:concluida'].map((ev) => CKL.eventos.ouvir(ev, () => {
          if (montado && estado.tela === 'inicio' && elConteudo.querySelector('[data-sem-modelos]')) desenhar();
        }))
      ];
      const antesDeSair = () => { guardarTextos(); vei.guardar(); };
      global.addEventListener('pagehide', antesDeSair);

      // retoma o checklist em andamento mais recente? Não: o início mostra a lista, com um toque para continuar.
      desenhar();
      const observarFotos = new MutationObserver(() => { if (elConteudo.querySelector('[data-fotos]:empty')) preencherFotos(); });
      observarFotos.observe(elConteudo, { childList: true });

      return function desmontar() {
        montado = false;
        guardarTextos();
        vei.sair();
        observarFotos.disconnect();
        raiz.removeEventListener('click', aoClicar);
        raiz.removeEventListener('input', aoDigitar);
        raiz.removeEventListener('change', aoMudar);
        global.removeEventListener('pagehide', antesDeSair);
        desligar.forEach((f) => f());
        raiz.innerHTML = '';
      };
    }
  };
})(window);
