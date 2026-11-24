/* ==========================================================================
   Aplicativo do celular — limpeza de veículos
   Telas: veiculos (escolha do formulário) → vei-form (preenchimento) → vei-ver.
   Usado por js/ui/operador.js, que cuida do topo, da barra e da navegação.
   ========================================================================== */
(function (global) {
  'use strict';
  const CKL = global.CKL;
  const { ui, util, config: cfg } = CKL;
  const { html, icone } = ui;
  const ST = cfg.STATUS;

  /** ctx: { elConteudo, topo, barra, ir, estado } */
  CKL.telas.veiculosApp = function (ctx) {
    const V = () => CKL.veiculos;
    const textos = new Map();          // campo -> { el, t } aguardando gravação
    let atual = null;                   // registro aberto
    let urls = ui.GerenteUrls();
    const el = () => ctx.elConteudo;

    /* ---------------- gravação dos textos ---------------- */
    function gravarTexto(campoEl) {
      if (!atual || atual.status !== ST.EM_ANDAMENTO) return Promise.resolve();
      const campo = campoEl.dataset.vcampo || campoEl.dataset.campo;
      const d = { [campo]: campoEl.value };
      if (campo === 'motivo') d.motivoDoCadastro = false;
      return V().definir(atual.id, d).then((v) => { atual = v; atualizarPendencias(); }).catch(ui.erro);
    }
    function agendar(campoEl) {
      const campo = campoEl.dataset.vcampo || campoEl.dataset.campo;
      clearTimeout((textos.get(campo) || {}).t);
      textos.set(campo, { el: campoEl, t: setTimeout(() => { textos.delete(campo); gravarTexto(campoEl); }, 600) });
    }
    function guardar() {
      const pend = Array.from(textos.values());
      textos.clear();
      return pend.reduce((c, x) => { clearTimeout(x.t); return c.then(() => gravarTexto(x.el)); }, Promise.resolve());
    }

    /* ---------------- partes de tela ---------------- */
    function itemLista(v, acao) {
      const f = V().formulario(v.tipo), alertas = v.alertas || V().alertas(v);
      return html`
        <button type="button" class="op-item ${alertas.length ? 'ck-item-alerta' : ''}" data-acao="${acao}" data-vei="${v.id}">
          <span class="op-item-semfoto">${icone('caminhao', 28)}</span>
          <span class="op-item-texto">
            <strong>${v.placa || 'Placa não informada'}</strong>
            <span>${f.nome} · ${util.fmtDataHora(v.dataHora)}</span>
            ${alertas.length ? html`<span>${alertas.join(' · ')}</span>` : ''}
            <span class="op-item-selo selos">${ui.seloStatus(v.status)}${v.status !== ST.EM_ANDAMENTO ? ui.seloEnvio(v.situacaoEnvio) : ''}</span>
          </span>
          <span class="op-item-seta">${icone('avancar', 22)}</span>
        </button>`;
    }

    function cabecalhoDocumento(v) {
      const d = v.documento || V().formulario(v.tipo);
      return html`
        <div class="cartao ck-doc">
          <span class="ck-doc-cabecalho">${d.cabecalho}</span>
          <h2>${d.titulo}</h2>
          ${ui.dados([['Identificação', d.identificacao]].concat(d.versaoDocumento ? [['Versão', d.versaoDocumento]] : [],
            [['Página', d.pagina], ['Elaborado por', d.elaboradoPor], ['Revisado por', d.revisadoPor], ['Aprovado por', d.aprovadoPor]],
            d.aprovadoEm ? [['Aprovado em', util.fmtData(d.aprovadoEm)]] : []), 'dados-2col')}
        </div>`;
    }

    function escolha(campo, opcoes, valor, classe) {
      return html`<div class="vei-escolha" role="group">${opcoes.map((o) => html`
        <button type="button" class="ck-opcao ${classe ? classe(o.valor) : ''} ${valor === o.valor ? 'marcada' : ''}" aria-pressed="${valor === o.valor}"
          data-acao="vei-set" data-campo="${campo}" data-valor="${o.valor}">${o.rotulo}</button>`)}</div>`;
    }
    const SIM_NAO = [{ valor: 'SIM', rotulo: 'SIM' }, { valor: 'NAO', rotulo: 'NÃO' }];
    const classeSimNao = (x) => (x === 'SIM' ? 'vei-sim' : 'vei-nao');

    function avisoPlaca(placa) {
      return placa && !V().placaValida(placa)
        ? html`<p class="vei-aviso">${icone('alerta', 16)}<span>Confira a placa: o formato é diferente do antigo (ABC-1234) e do Mercosul (ABC1D23). Pode estar incorreta.</span></p>` : '';
    }

    function pendenciasHtml(v) {
      const pend = V().pendencias(v);
      return pend.length ? html`
        <section class="cartao ck-pendencias">
          <h2>${icone('alerta', 20)} ${util.plural(pend.length, 'pendência', 'pendências')} antes de enviar</h2>
          <ul>${pend.map((p) => html`<li><button type="button" class="ck-pend" data-acao="vei-ir" data-campo="${p.campo}">${p.mensagem}${icone('avancar', 18)}</button></li>`)}</ul>
        </section>` : html`<div class="alerta alerta-ok">${icone('checkCirculo', 20)}<div><strong>Tudo preenchido.</strong><p>Confira os dados e envie.</p></div></div>`;
    }
    function atualizarPendencias() {
      const alvo = el().querySelector('#vei-pend');
      if (!alvo || !atual) return;
      alvo.innerHTML = String(pendenciasHtml(atual));
      const b = document.querySelector('[data-acao=vei-enviar]');
      if (b) { if (V().pendencias(atual).length) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled'); }
      const obs = el().querySelector('#vei-obs-rotulo');
      if (obs) obs.innerHTML = String(rotuloObservacao(atual));
    }
    function rotuloObservacao(v) {
      const R = V().formulario('conferencia').rotulos;
      return V().alertas(v).length ? html`${R.observacao} <small class="ck-obrig">(obrigatória: há resposta NÃO)</small>` : html`${R.observacao} <span class="opcional">(opcional)</span>`;
    }

    function fotosHtml(v, editavel) {
      return html`
        <div class="ck-fotos">
          ${(v.fotos || []).length ? html`<span class="ck-fotos-lista" id="vei-fotos"></span>` : ''}
          ${editavel ? html`
            <label class="btn btn-secundario btn-p ck-foto-botao">${icone('camera', 16)}<span>Fotografar</span>
              <input type="file" accept="image/*" capture="environment" data-vfoto="1" hidden></label>
            <label class="btn btn-secundario btn-p ck-foto-botao">${icone('imagem', 16)}<span>Galeria</span>
              <input type="file" accept="image/*" data-vfoto="1" hidden></label>` : ''}
          ${(v.fotos || []).length ? html`<small>${util.plural(v.fotos.length, 'foto', 'fotos')}</small>` : (editavel ? '' : html`<small>Sem fotos</small>`)}
        </div>`;
    }
    function preencherFotos(v) {
      const alvo = el().querySelector('#vei-fotos');
      if (!alvo) return;
      V().fotosDe(v.id).then((fotos) => {
        alvo.innerHTML = String(html`${(v.fotos || []).map((id) => fotos.filter((f) => f.id === id)[0]).filter(Boolean).map((f) =>
          html`<button type="button" class="ck-mini" data-acao="vei-ver-foto" data-foto-id="${f.id}" aria-label="Ver fotografia"><img src="${f.miniatura}" alt=""></button>`)}`);
      }).catch(() => {});
    }

    /* ---------------- telas ---------------- */
    function telaMenu() {
      atual = null;
      ctx.topo('Limpeza de veículo', 'Escolha o formulário', true);
      ctx.barra(null);
      return V().meus().then((meus) => {
        const rascunhos = meus.filter((v) => v.status === ST.EM_ANDAMENTO);
        const enviados = meus.filter((v) => v.status === ST.CONCLUIDO).slice(0, 15);
        const F = CKL.formulariosVeiculos;
        el().innerHTML = html`
          <div class="ck-areas">
            <button type="button" class="ck-area ck-area-veiculo" data-acao="vei-novo" data-tipo="conferencia">
              <span class="ck-area-icone">${icone('caminhao', 34)}</span>
              <span class="ck-area-texto"><strong>Conferência</strong><span>${F.conferencia.titulo}</span><small>${F.conferencia.identificacao}</small></span>
              ${icone('avancar', 24)}
            </button>
            <button type="button" class="ck-area ck-area-veiculo" data-acao="vei-novo" data-tipo="autorizacao">
              <span class="ck-area-icone">${icone('assinatura', 34)}</span>
              <span class="ck-area-texto"><strong>Autorização</strong><span>${F.autorizacao.titulo}</span><small>${F.autorizacao.identificacao}</small></span>
              ${icone('avancar', 24)}
            </button>
          </div>
          ${rascunhos.length ? html`<section class="op-secao"><div class="op-secao-topo"><h2>Não enviados</h2></div>
            <div class="op-lista">${rascunhos.map((v) => itemLista(v, 'vei-continuar'))}</div></section>` : ''}
          <section class="op-secao"><div class="op-secao-topo"><h2>Veículos enviados por mim</h2></div>
            ${enviados.length ? html`<div class="op-lista">${enviados.map((v) => itemLista(v, 'vei-abrir'))}</div>` : html`<p class="op-ajuda">Os registros que você enviar aparecem aqui.</p>`}
          </section>`;
      });
    }

    function formConferencia(v) {
      const F = V().formulario('conferencia'), R = F.rotulos;
      return html`
        <div class="alerta alerta-info">${icone('info', 20)}<div><p>${F.nota}</p></div></div>
        <details class="cartao ck-orientacao"><summary>Orientação</summary><p>${F.orientacao}</p></details>
        <form class="cartao formulario" novalidate onsubmit="return false">
          <div class="vei-auto">${ui.dados([[R.dataHora, util.fmtDataHora(v.dataHora)], [R.responsavel, v.responsavelNome]])}</div>
          <div class="vei-campo" id="vei-c-turno"><span class="vei-rotulo">${R.turno} <small>(sugerido pela hora; pode trocar)</small></span>
            ${escolha('turno', F.turnos, v.turno)}</div>
          <div class="campo" id="vei-c-placa"><label for="vei-placa">${R.placa}</label>
            <input id="vei-placa" class="vei-placa" data-vcampo="placa" value="${v.placa || ''}" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC-1234 ou ABC1D23">
            <div id="vei-placa-aviso">${avisoPlaca(v.placa)}</div></div>
          <div class="vei-campo" id="vei-c-origem"><span class="vei-rotulo">${R.origem}</span>${escolha('origem', F.origens, v.origem)}</div>
          <div class="vei-campo" id="vei-c-identificacaoRetirada"><span class="vei-rotulo">${R.identificacaoRetirada}</span>${escolha('identificacaoRetirada', SIM_NAO, v.identificacaoRetirada, classeSimNao)}</div>
          <div class="vei-campo" id="vei-c-descarregadoCompleto"><span class="vei-rotulo">${R.descarregadoCompleto}</span>${escolha('descarregadoCompleto', SIM_NAO, v.descarregadoCompleto, classeSimNao)}</div>
          <section class="vei-grupo" id="vei-c-fechouPeso"><h4>${R.grupoPeso}</h4>
            <div class="vei-campo"><span class="vei-rotulo">${R.fechouPeso}</span>
              ${v.origem === 'BUNGE' ? html`<p class="vei-na">${V().ROTULO_RESPOSTA.NA}</p>` : escolha('fechouPeso', SIM_NAO, v.fechouPeso, classeSimNao)}</div>
          </section>
          <div class="campo" id="vei-c-observacao"><label for="vei-obs" id="vei-obs-rotulo">${rotuloObservacao(v)}</label>
            <textarea id="vei-obs" rows="3" maxlength="${cfg.TEXTO_MAXIMO}" data-vcampo="observacao">${v.observacao || ''}</textarea></div>
          <div class="vei-campo"><span class="vei-rotulo">Fotos <small>(opcional)</small></span>${fotosHtml(v, true)}</div>
        </form>`;
    }

    function formAutorizacao(v, cultivares, motivos) {
      const R = V().formulario('autorizacao').rotulos;
      const motivoAtual = v.motivoDoCadastro ? v.motivo : '';
      return html`
        <form class="cartao formulario" novalidate onsubmit="return false">
          <div class="vei-auto">${ui.dados([[R.dataHora, util.fmtDataHora(v.dataHora)], ['Responsável', v.responsavelNome]])}</div>
          <div class="campo" id="vei-c-placa"><label for="vei-placa">${R.placa}</label>
            <input id="vei-placa" class="vei-placa" data-vcampo="placa" value="${v.placa || ''}" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC-1234 ou ABC1D23">
            <div id="vei-placa-aviso">${avisoPlaca(v.placa)}</div></div>
          <div class="campo" id="vei-c-motorista"><label for="vei-motorista">${R.motorista}</label>
            <input id="vei-motorista" data-vcampo="motorista" value="${v.motorista || ''}" maxlength="120" autocomplete="off"></div>
          <div id="vei-c-cultivarAnterior">${ui.campoCultivar('vei-cultivar', R.cultivarAnterior, v.cultivarAnterior, cultivares, 'cultivarAnterior')}</div>
          <div class="campo" id="vei-c-motivo"><label for="vei-motivo">${R.motivo}</label>
            ${motivos.length ? html`<select id="vei-motivo-cadastro" data-vmotivo="1" aria-label="Motivo do cadastro">${ui.opcoes(motivos, motivoAtual, 'Escolher um motivo do cadastro (opcional)')}</select>` : ''}
            <textarea id="vei-motivo" rows="3" maxlength="${cfg.TEXTO_MAXIMO}" data-vcampo="motivo" placeholder="${motivos.length ? 'Ou escreva o motivo' : 'Escreva o motivo'}">${v.motivo || ''}</textarea></div>
          <div class="vei-campo"><span class="vei-rotulo">Fotos <small>(opcional)</small></span>${fotosHtml(v, true)}</div>
          <div class="campo" id="vei-c-assinatura"><span class="ck-rotulo">${R.assinatura}: ${v.responsavelNome}</span><div id="vei-assinatura"></div></div>
        </form>`;
    }

    function telaForm() {
      return guardar().then(() => Promise.all([V().obter(ctx.estado.veiId), CKL.motivos.opcoes()])).then(([v, motivos]) => {
        if (!v) { ctx.ir('veiculos'); return; }
        if (v.status !== ST.EM_ANDAMENTO) { ctx.ir('vei-ver', { veiId: v.id }); return; }
        return CKL.cultivares.opcoes([v.cultivarAnterior]).then((cultivares) => {
          atual = v;
          const f = V().formulario(v.tipo);
          ctx.topo(v.tipo === 'conferencia' ? 'Conferência' : 'Autorização', f.identificacao, true);
          const rolagem = global.scrollY;
          urls.liberar(); urls = ui.GerenteUrls();
          el().innerHTML = html`
            ${cabecalhoDocumento(v)}
            ${v.tipo === 'conferencia' ? formConferencia(v) : formAutorizacao(v, cultivares, motivos)}
            <div id="vei-pend">${pendenciasHtml(v)}</div>
            <button type="button" class="btn btn-fantasma ck-descartar" data-acao="vei-descartar">${icone('lixeira', 18)}<span>Descartar este registro</span></button>`;
          ctx.barra(html`<button type="button" class="btn btn-acento btn-g btn-cresce" data-acao="vei-enviar" ${V().pendencias(v).length ? ui.bruto('aria-disabled="true"') : ''}>${icone('upload', 22)}<span>Enviar</span></button>`);
          if (v.tipo === 'autorizacao') {
            ui.assinatura(el().querySelector('#vei-assinatura'), {
              valor: v.assinatura && v.assinatura.imagem,
              aoMudar: (png) => V().assinar(v.id, png).then((x) => { atual = x; atualizarPendencias(); }).catch(ui.erro)
            });
          }
          preencherFotos(v);
          global.scrollTo(0, rolagem);
        });
      });
    }

    function telaVer() {
      return V().obter(ctx.estado.veiId).then((v) => {
        if (!v) { ctx.ir('veiculos'); return; }
        atual = v;
        const f = V().formulario(v.tipo), R = f.rotulos, RR = V().ROTULO_RESPOSTA, alertas = v.alertas || V().alertas(v);
        ctx.topo(v.placa || 'Registro', f.identificacao + ' · ' + v.protocolo, true);
        ctx.barra(html`
          <button type="button" class="btn btn-secundario btn-g btn-cresce" data-acao="vei-pdf">${icone('pdf', 20)}<span>PDF</span></button>
          ${CKL.arquivos.podeCompartilhar() ? html`<button type="button" class="btn btn-secundario btn-g btn-cresce" data-acao="vei-compartilhar">${icone('compartilhar', 20)}<span>Compartilhar</span></button>` : ''}`);
        const pares = v.tipo === 'conferencia'
          ? [[R.dataHora, util.fmtDataHora(v.dataHora)], [R.turno, V().ROTULO_TURNO[v.turno]], [R.placa, v.placa], [R.origem, v.origem],
            [R.identificacaoRetirada, RR[v.identificacaoRetirada]], [R.descarregadoCompleto, RR[v.descarregadoCompleto]],
            [R.grupoPeso + ' — ' + R.fechouPeso, RR[v.fechouPeso]], [R.responsavel, v.responsavelNome], [R.observacao, v.observacao || '—']]
          : [[R.dataHora, util.fmtDataHora(v.dataHora)], [R.placa, v.placa], [R.motorista, v.motorista], [R.cultivarAnterior, v.cultivarAnterior],
            [R.motivo, v.motivo], ['Responsável', v.responsavelNome]];
        el().innerHTML = html`
          ${ctx.estado.recemEnviado ? html`<div class="alerta alerta-ok">${icone('checkCirculo', 20)}<div><strong>Registro enviado.</strong>
            <p>${CKL.sincronizacao.configurada() ? 'Ele vai para o servidor central assim que houver internet.' : 'Guardado neste aparelho (servidor central não configurado).'} Não pode mais ser alterado pelo aplicativo.</p>
            <button type="button" class="btn btn-secundario" data-acao="vei-novo" data-tipo="${v.tipo}">${icone('mais', 18)}<span>Novo registro de ${v.tipo === 'conferencia' ? 'conferência' : 'autorização'}</span></button></div></div>` : ''}
          ${alertas.length ? html`<div class="alerta alerta-erro">${icone('alerta', 20)}<div><strong>Atenção</strong><ul class="vei-alertas">${alertas.map((a) => html`<li>${a}</li>`)}</ul></div></div>` : ''}
          ${v.placaConferir ? html`<div class="alerta alerta-alerta">${icone('alerta', 20)}<div><p>A placa está fora do formato antigo e do Mercosul. Confira.</p></div></div>` : ''}
          ${cabecalhoDocumento(v)}
          <div class="cartao">
            <div class="selos">${ui.seloStatus(v.status)}${ui.seloEnvio(v.situacaoEnvio)}</div>
            ${ui.dados(pares, 'dados-2col')}
            ${v.tipo === 'autorizacao' && v.assinatura ? html`<div class="campo"><span class="ck-rotulo">${R.assinatura}</span><img class="ck-assinatura-img" src="${v.assinatura.imagem}" alt="Assinatura de ${v.responsavelNome}"></div>` : ''}
            ${fotosHtml(v, false)}
          </div>
          ${(v.correcoes || []).length ? html`<div class="cartao"><h3>Correções do administrador</h3><ul>${v.correcoes.map((c) => html`<li>${util.fmtDataHora(c.em)} · ${c.porNome}: ${c.campos.join(', ')} — ${c.motivo}</li>`)}</ul></div>` : ''}`;
        preencherFotos(v);
      });
    }

    /* ---------------- ações ---------------- */
    function definir(d) {
      return guardar().then(() => V().definir(atual.id, d)).then((v) => { atual = v; return telaForm(); }).catch(ui.erro);
    }
    function receberFoto(input) {
      const arquivo = input.files && input.files[0];
      input.value = '';
      if (!arquivo || !atual) return;
      const fim = ui.carregando('Preparando a fotografia…');
      CKL.imagem.processar(arquivo).then((res) => {
        fim();
        if (!res.ok) { ui.aviso(res.erros.join(' '), 'erro'); return; }
        if (res.avisos.length) ui.aviso(res.avisos.join(' '), 'alerta');
        return guardar().then(() => V().adicionarFoto(atual.id, res.foto)).then((v) => { atual = v; ui.aviso('Fotografia anexada.', 'ok', 2500); return telaForm(); });
      }, (e) => { fim(); ui.erro(e); }).catch(ui.erro);
    }
    function verFoto(fotoId) {
      V().fotosDe(atual.id).then((fotos) => {
        const f = fotos.filter((x) => x.id === fotoId)[0];
        if (!f) return;
        const u = ui.GerenteUrls(), editavel = atual.status === ST.EM_ANDAMENTO;
        ui.modal({
          titulo: 'Fotografia', largura: 'g', aoFechar: () => u.liberar(),
          conteudo: html`<img class="op-foto-grande" src="${u.daFoto(f)}" alt="Fotografia do veículo"><p class="texto-menor">${util.fmtDataHora(f.capturadaEm)}</p>`,
          acoes: editavel ? [{ rotulo: 'Remover foto', classe: 'btn-perigo-suave', icone: 'lixeira', acao: (m) => {
            m.fechar();
            V().removerFoto(atual.id, fotoId).then((v) => { atual = v; return telaForm(); }).catch(ui.erro);
          } }, { rotulo: 'Fechar', classe: 'btn-primario', acao: (m) => m.fechar() }] : [{ rotulo: 'Fechar', classe: 'btn-primario', acao: (m) => m.fechar() }]
        });
      }).catch(ui.erro);
    }
    function enviar(botao) {
      guardar().then(() => V().obter(atual.id)).then((v) => {
        atual = v;
        const pend = V().pendencias(v);
        if (pend.length) { ui.aviso('Resolva as pendências antes de enviar (' + pend.length + ').', 'erro'); atualizarPendencias(); return; }
        const alertas = V().alertas(v);
        return ui.confirmar({
          titulo: 'Enviar o registro?',
          mensagem: 'Depois de enviado, não pode mais ser alterado pelo aplicativo. Correções só pelo administrador.',
          detalhe: 'Placa ' + V().formatarPlaca(v.placa) + (V().placaValida(v.placa) ? '' : ' (formato a conferir)') + (alertas.length ? ' · ' + alertas.join(' · ') : ''),
          rotuloConfirmar: 'Enviar'
        }).then((ok) => {
          if (!ok) return;
          return ui.ocupar(botao, () => V().finalizar(v.id)).then((x) => { atual = x; ctx.ir('vei-ver', { veiId: x.id, recemEnviado: true }); });
        });
      }).catch((er) => { ui.erro(er); atualizarPendencias(); });
    }
    function descartar() {
      ui.confirmar({ titulo: 'Descartar este registro?', mensagem: 'O registro ainda não foi enviado e será apagado deste aparelho, com as fotos.', rotuloConfirmar: 'Descartar', perigo: true })
        .then((ok) => { if (ok) return guardar().then(() => V().descartarRascunho(atual.id)).then(() => { ui.aviso('Registro descartado.', 'ok'); ctx.ir('veiculos'); }); })
        .catch(ui.erro);
    }
    function pdf(botao, compartilhar) {
      return ui.ocupar(botao, () => CKL.pdfVeiculos.gerar(atual.id).then((p) => compartilhar
        ? CKL.arquivos.compartilhar(p.blob, p.nome, 'Limpeza de veículo')
        : CKL.arquivos.salvar(p.blob, p.nome).then((r) => { if (r === 'salvo') ui.aviso('PDF gerado: ' + p.nome, 'ok'); }))).catch(ui.erro);
    }

    return {
      itemLista: itemLista,
      guardar: guardar,
      sair() { guardar(); urls.liberar(); },
      desenhar(tela) {
        if (tela === 'veiculos') return telaMenu();
        if (tela === 'vei-form') return telaForm();
        return telaVer();
      },
      voltar(tela) { guardar(); ctx.ir(tela === 'veiculos' ? 'inicio' : 'veiculos'); },
      aoClicar(b, a) {
        if (a === 'vei-novo') ui.ocupar(b, () => V().iniciar(b.dataset.tipo)).then((v) => { if (v) ctx.ir('vei-form', { veiId: v.id, recemEnviado: false }); }).catch(ui.erro);
        else if (a === 'vei-continuar') ctx.ir('vei-form', { veiId: b.dataset.vei, recemEnviado: false });
        else if (a === 'vei-abrir') ctx.ir('vei-ver', { veiId: b.dataset.vei, recemEnviado: false });
        else if (a === 'vei-set') definir({ [b.dataset.campo]: b.dataset.valor });
        else if (a === 'vei-ver-foto') verFoto(b.dataset.fotoId);
        else if (a === 'vei-enviar') enviar(b);
        else if (a === 'vei-descartar') descartar();
        else if (a === 'vei-pdf') pdf(b, false);
        else if (a === 'vei-compartilhar') pdf(b, true);
        else if (a === 'vei-ir') {
          const alvo = el().querySelector('#vei-c-' + b.dataset.campo);
          if (alvo) { alvo.scrollIntoView({ block: 'center' }); const f = alvo.querySelector('input, textarea, select, button'); if (f) f.focus({ preventScroll: true }); }
        }
      },
      aoDigitar(ev) {
        const x = ev.target;
        if (!atual || !(x.dataset.vcampo || (x.dataset.campo && x.tagName !== 'SELECT'))) return;
        if (x.dataset.vcampo === 'placa') {
          const aviso = el().querySelector('#vei-placa-aviso');
          if (aviso) aviso.innerHTML = String(avisoPlaca(x.value));
        }
        agendar(x);
      },
      aoMudar(ev) {
        const x = ev.target;
        if (x.matches('input[type=file][data-vfoto]')) { receberFoto(x); return; }
        if (!atual) return;
        if (x.dataset.vmotivo) {
          // motivo do cadastro: preenche o texto (que ainda pode ser ajustado)
          if (x.value) { guardar().then(() => V().definir(atual.id, { motivo: x.value, motivoDoCadastro: true })).then((v) => { atual = v; return telaForm(); }).catch(ui.erro); }
          return;
        }
        if (x.dataset.vcampo || x.dataset.campo) {
          const campo = x.dataset.vcampo || x.dataset.campo;
          clearTimeout((textos.get(campo) || {}).t); textos.delete(campo);
          gravarTexto(x);
        }
      }
    };
  };
})(window);
