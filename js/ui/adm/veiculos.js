/* ==========================================================================
   Painel — limpeza de veículos: conferências de descarga e autorizações sem
   vistoria. Filtros, indicadores, registro (PDF, histórico, correção) e
   relatórios do período (PDF no formato da planilha e Excel).
   ========================================================================== */
(function (global) {
  'use strict';
  const CKL = global.CKL;
  const { ui, util, config: cfg } = CKL;
  const { html, icone } = ui;
  const adm = CKL.telas.adm;
  const ST = cfg.STATUS;
  const V = () => CKL.veiculos;
  const F = { de: '', ate: '', tipo: '', placa: '', origem: '', turno: '', responsavel: '', alerta: '' };
  let pagina = 1;

  function filtrar(lista) {
    const placa = util.limpar(F.placa).toUpperCase().replace(/[\s-]/g, '');
    return lista.filter((v) => {
      if (v.status !== ST.CONCLUIDO) return false;
      const dia = v.dataRegistro || util.dataLocal(new Date(v.dataHora));
      if (F.de && dia < F.de) return false;
      if (F.ate && dia > F.ate) return false;
      if (F.tipo && v.tipo !== F.tipo) return false;
      if (placa && String(v.placa || '').toUpperCase().replace(/[\s-]/g, '').indexOf(placa) < 0) return false;
      if (F.origem && v.origem !== F.origem) return false;
      if (F.turno && v.turno !== F.turno) return false;
      if (F.responsavel && v.responsavelNome !== F.responsavel) return false;
      if (F.alerta === 'sim' && !(v.alertas || V().alertas(v)).length) return false;
      if (F.alerta === 'placa' && !v.placaConferir) return false;
      return true;
    });
  }

  function descricaoPeriodo(n) {
    const per = F.de || F.ate ? 'Período: ' + (F.de ? util.fmtData(F.de) : 'início') + ' a ' + (F.ate ? util.fmtData(F.ate) : 'hoje') : 'Todos os registros';
    return per + ' · ' + util.plural(n, 'registro', 'registros');
  }

  function filtrosHtml(todos) {
    const conf = V().formulario('conferencia');
    const resp = util.unicos(todos.map((v) => v.responsavelNome).filter(Boolean)).sort();
    return html`
      <section class="filtros" aria-label="Filtros">
        <div class="campo"><label for="vf-de">De</label><input type="date" id="vf-de" data-f="de" value="${F.de}"></div>
        <div class="campo"><label for="vf-ate">Até</label><input type="date" id="vf-ate" data-f="ate" value="${F.ate}"></div>
        <div class="campo"><label for="vf-tipo">Formulário</label><select id="vf-tipo" data-f="tipo">${ui.opcoes([{ valor: 'conferencia', rotulo: 'Conferência de descarga' }, { valor: 'autorizacao', rotulo: 'Autorização sem vistoria' }], F.tipo, 'Todos')}</select></div>
        <div class="campo"><label for="vf-placa">Placa</label><input type="search" id="vf-placa" data-f="placa" value="${F.placa}" placeholder="Parte da placa" autocomplete="off"></div>
        <div class="campo"><label for="vf-origem">Origem</label><select id="vf-origem" data-f="origem">${ui.opcoes(conf.origens, F.origem, 'Todas')}</select></div>
        <div class="campo"><label for="vf-turno">Turno</label><select id="vf-turno" data-f="turno">${ui.opcoes(conf.turnos, F.turno, 'Todos')}</select></div>
        <div class="campo"><label for="vf-resp">Responsável</label><select id="vf-resp" data-f="responsavel">${ui.opcoes(resp, F.responsavel, 'Todos')}</select></div>
        <div class="campo"><label for="vf-alerta">Destaques</label><select id="vf-alerta" data-f="alerta">${ui.opcoes([{ valor: 'sim', rotulo: 'Só com resposta NÃO' }, { valor: 'placa', rotulo: 'Só placa a conferir' }], F.alerta, 'Todos')}</select></div>
      </section>`;
  }

  function indicadores(lista) {
    const conf = lista.filter((v) => v.tipo === 'conferencia'), aut = lista.filter((v) => v.tipo === 'autorizacao');
    const n = (f) => conf.filter(f).length;
    const pct = (x) => (conf.length ? Math.round((x / conf.length) * 100) + '%' : '—');
    const incompletas = n((v) => v.descarregadoCompleto === 'NAO'), semPeso = n((v) => v.fechouPeso === 'NAO'), semIdent = n((v) => v.identificacaoRetirada === 'NAO');
    const comPeso = n((v) => v.fechouPeso !== 'NA');   // Bunge não fecha peso (nota do documento)
    const card = (rotulo, valor, nota, classe) => html`<div class="indicador ${classe || ''}"><span class="indicador-rotulo">${rotulo}</span><strong class="indicador-valor">${valor}</strong>${nota ? html`<span class="indicador-nota">${nota}</span>` : ''}</div>`;
    return html`
      <div class="indicadores">
        ${card('Veículos conferidos', util.fmtNum(conf.length, 0), 'Conferências de descarga')}
        ${card('Liberados sem vistoria', util.fmtNum(aut.length, 0), 'Autorizações', aut.length ? 'indicador-alerta' : '')}
        ${card('Descarga incompleta', util.fmtNum(incompletas, 0), pct(incompletas) + ' das conferências', incompletas ? 'indicador-erro' : '')}
        ${card('Não fechou o peso', util.fmtNum(semPeso, 0), (comPeso ? Math.round((semPeso / comPeso) * 100) + '%' : '—') + ' das conferências (sem Bunge)', semPeso ? 'indicador-erro' : '')}
        ${card('Identificação não retirada', util.fmtNum(semIdent, 0), pct(semIdent) + ' das conferências', semIdent ? 'indicador-erro' : '')}
        ${card('Placa a conferir', util.fmtNum(lista.filter((v) => v.placaConferir).length, 0), 'Fora do formato antigo e do Mercosul')}
      </div>`;
  }

  /* ---------- registro: detalhes, histórico, PDF e correção ---------- */
  function abrirRegistro(id, aoMudar) {
    const m = ui.modal({ titulo: 'Registro de veículo', largura: 'g', conteudo: html`<p class="texto-menor">Carregando…</p>` });
    const urls = ui.GerenteUrls();
    function carregar() {
      return Promise.all([V().obter(id), V().fotosDe(id).catch(() => []), CKL.historico.daEntidade('veiculo', id)]).then(([v, fotos, ev]) => {
        if (!v) { m.fechar(); return; }
        const f = V().formulario(v.tipo), R = f.rotulos, RR = V().ROTULO_RESPOSTA, alertas = v.alertas || V().alertas(v);
        m.definirTitulo && m.definirTitulo(f.nome + ' · ' + (v.placa || ''));
        const pares = v.tipo === 'conferencia'
          ? [[R.dataHora, util.fmtDataHora(v.dataHora)], [R.turno, V().ROTULO_TURNO[v.turno]], [R.placa, v.placa], [R.origem, v.origem],
            [R.identificacaoRetirada, RR[v.identificacaoRetirada]], [R.descarregadoCompleto, RR[v.descarregadoCompleto]],
            [R.grupoPeso + ' — ' + R.fechouPeso, RR[v.fechouPeso]], [R.responsavel, v.responsavelNome], [R.observacao, v.observacao || '—'], ['Protocolo', v.protocolo]]
          : [[R.dataHora, util.fmtDataHora(v.dataHora)], [R.placa, v.placa], [R.motorista, v.motorista], [R.cultivarAnterior, v.cultivarAnterior],
            [R.motivo, v.motivo + (v.motivoDoCadastro ? ' (motivo do cadastro)' : '')], ['Responsável', v.responsavelNome], ['Protocolo', v.protocolo]];
        const usadas = (v.fotos || []).map((x) => fotos.filter((g) => g.id === x)[0]).filter(Boolean);
        m.definirConteudo(html`
          <div class="selos">${ui.seloStatus(v.status)}${ui.seloEnvio(v.situacaoEnvio)}${v.placaConferir ? ui.seloSimples('Placa a conferir', 'selo-pendente', 'alerta') : ''}</div>
          ${alertas.length ? html`<div class="alerta alerta-erro">${icone('alerta', 20)}<div><strong>Resposta NÃO</strong><ul class="vei-alertas">${alertas.map((a) => html`<li>${a}</li>`)}</ul></div></div>` : ''}
          <p class="texto-menor">${f.titulo} · ${(v.documento || f).identificacao}${(v.documento || {}).versaoDocumento ? ' · versão ' + v.documento.versaoDocumento : ''}</p>
          ${ui.dados(pares, 'dados-2col')}
          ${v.tipo === 'autorizacao' && v.assinatura ? html`<div class="campo"><span class="ck-rotulo">${R.assinatura} (${v.responsavelNome}, ${util.fmtDataHora(v.assinatura.em)})</span><img class="ck-assinatura-img" src="${v.assinatura.imagem}" alt="Assinatura"></div>` : ''}
          ${usadas.length ? html`<h3 class="secao-titulo">Fotografias</h3><div class="ck-fotos-lista">${usadas.map((g) => html`<a href="${urls.daFoto(g) || g.miniatura}" target="_blank" rel="noopener" class="ck-mini"><img src="${g.miniatura}" alt="Fotografia"></a>`)}</div>` : ''}
          <h3 class="secao-titulo">Histórico</h3>
          ${adm.eventosHtml(ev)}`);
        m.definirAcoes && m.definirAcoes([
          { rotulo: 'Fechar', classe: 'btn-secundario', acao: (mm) => mm.fechar() },
          { rotulo: 'Corrigir', classe: 'btn-secundario', icone: 'editar', acao: () => abrirCorrecao(v, () => { carregar(); aoMudar(); }) },
          { rotulo: 'Gerar PDF', classe: 'btn-primario', icone: 'pdf', acao: (mm, b) => ui.ocupar(b, () => CKL.pdfVeiculos.gerar(v.id).then((p) => CKL.arquivos.salvar(p.blob, p.nome))).catch(ui.erro) }
        ]);
      }).catch(ui.erro);
    }
    carregar();
  }

  function abrirCorrecao(v, aoSalvar) {
    Promise.all([CKL.cultivares.opcoes([v.cultivarAnterior])]).then(([cultivares]) => {
      const f = V().formulario(v.tipo), R = f.rotulos;
      const SN = [{ valor: 'SIM', rotulo: 'SIM' }, { valor: 'NAO', rotulo: 'NÃO' }];
      ui.modal({
        titulo: 'Corrigir registro: ' + (v.placa || ''), largura: 'm',
        conteudo: html`
          <form class="formulario" id="vc-form" novalidate onsubmit="return false">
            <p class="texto-menor">Altere só o que precisa ser corrigido. Cada campo alterado fica no histórico com o valor anterior, o novo, quem corrigiu e o motivo. A assinatura não é alterada.</p>
            <div class="formulario-linha">
              <div class="campo"><label for="vc-placa">${R.placa}</label><input id="vc-placa" data-c="placa" value="${v.placa || ''}" maxlength="12"></div>
              ${v.tipo === 'conferencia' ? html`
                <div class="campo"><label for="vc-turno">${R.turno}</label><select id="vc-turno" data-c="turno">${ui.opcoes(f.turnos, v.turno)}</select></div>
                <div class="campo"><label for="vc-origem">${R.origem}</label><select id="vc-origem" data-c="origem">${ui.opcoes(f.origens, v.origem)}</select></div>` : ''}
            </div>
            ${v.tipo === 'conferencia' ? html`
              <div class="formulario-linha">
                <div class="campo"><label for="vc-ident">${R.identificacaoRetirada}</label><select id="vc-ident" data-c="identificacaoRetirada">${ui.opcoes(SN, v.identificacaoRetirada)}</select></div>
                <div class="campo"><label for="vc-desc">${R.descarregadoCompleto}</label><select id="vc-desc" data-c="descarregadoCompleto">${ui.opcoes(SN, v.descarregadoCompleto)}</select></div>
                <div class="campo"><label for="vc-peso">${R.fechouPeso}</label><select id="vc-peso" data-c="fechouPeso">${ui.opcoes(SN, v.fechouPeso)}</select>
                  <p class="campo-ajuda">Origem BUNGE: fica "Não se aplica".</p></div>
              </div>
              <div class="campo"><label for="vc-obs">${R.observacao}</label><textarea id="vc-obs" data-c="observacao" rows="2">${v.observacao || ''}</textarea></div>`
            : html`
              <div class="campo"><label for="vc-mot">${R.motorista}</label><input id="vc-mot" data-c="motorista" value="${v.motorista || ''}" maxlength="120"></div>
              ${ui.campoCultivar('vc-cult', R.cultivarAnterior, v.cultivarAnterior, cultivares)}
              <div class="campo"><label for="vc-motivo">${R.motivo}</label><textarea id="vc-motivo" data-c="motivo" rows="3">${v.motivo || ''}</textarea></div>`}
            <div class="campo"><label for="vc-razao">Motivo da correção</label><textarea id="vc-razao" rows="2" maxlength="300" placeholder="Por que o registro está sendo corrigido"></textarea></div>
            <p class="form-erro" id="vc-erro" role="alert" hidden></p>
          </form>`,
        acoes: [
          { rotulo: 'Voltar', classe: 'btn-secundario', acao: (mm) => mm.fechar() },
          { rotulo: 'Salvar correção', classe: 'btn-primario', acao: (mm, b) => {
            const mud = {};
            mm.corpo.querySelectorAll('[data-c]').forEach((x) => { mud[x.dataset.c] = x.value; });
            const cult = mm.corpo.querySelector('#vc-cult');
            if (cult) mud.cultivarAnterior = cult.value;
            if (mud.motivo !== undefined && mud.motivo !== v.motivo) mud.motivoDoCadastro = false;
            ui.ocupar(b, () => V().corrigir(v.id, mud, mm.corpo.querySelector('#vc-razao').value).then(() => { mm.fechar(); ui.aviso('Registro corrigido. A alteração está no histórico.', 'ok'); aoSalvar(); }))
              .catch((er) => { const x = mm.corpo.querySelector('#vc-erro'); x.textContent = ui.mensagemDe(er); x.hidden = false; if (!er || !er.amigavel) console.error(er); });
          } }
        ]
      });
    }).catch(ui.erro);
  }

  CKL.telas.adm.veiculos = {
    montar(el) {
      let todos = [], montado = true;
      el.innerHTML = html`
        <header class="pagina-topo">
          <div><h1>Limpeza de veículos</h1><p>Conferências de descarga e autorizações de liberação sem vistoria de limpeza</p></div>
          <div class="pagina-acoes">
            <button type="button" class="btn btn-secundario" data-acao="pdf-periodo" data-tipo="conferencia">${icone('pdf', 18)}<span>PDF conferências</span></button>
            <button type="button" class="btn btn-secundario" data-acao="pdf-periodo" data-tipo="autorizacao">${icone('pdf', 18)}<span>PDF autorizações</span></button>
            <button type="button" class="btn btn-secundario" data-acao="excel">${icone('planilha', 18)}<span>Exportar Excel</span></button>
          </div>
        </header>
        <div id="vei-filtros"></div>
        <div id="vei-ind"></div>
        <div id="vei-lista"><p class="texto-menor">Carregando…</p></div>`;

      function carregar() {
        return V().listar().then((l) => {
          if (!montado) return;
          todos = l;
          el.querySelector('#vei-filtros').innerHTML = String(filtrosHtml(todos));
          desenhar();
        }).catch(ui.erro);
      }
      function desenhar() {
        const lista = filtrar(todos);
        el.querySelector('#vei-ind').innerHTML = String(indicadores(lista));
        const alvo = el.querySelector('#vei-lista');
        if (!todos.some((v) => v.status === ST.CONCLUIDO)) { alvo.innerHTML = String(ui.vazio('caminhao', 'Nenhum registro de veículo ainda', 'As conferências e autorizações enviadas pelo aplicativo do celular aparecem aqui.')); return; }
        if (!lista.length) { alvo.innerHTML = String(ui.vazio('filtro', 'Nenhum registro no filtro', 'Ajuste os filtros para ver outros registros.')); return; }
        const pg = ui.paginar(lista, pagina);
        pagina = pg.pagina;
        const RR = V().ROTULO_RESPOSTA;
        alvo.innerHTML = String(html`
          <div class="cartao cartao-tabela">
            <div class="tabela-rolagem">
              <table class="tabela tabela-compacta">
                <thead><tr><th>Data / Hora</th><th>Formulário</th><th>Placa</th><th>Turno</th><th>Origem</th><th>Identif. retirada</th><th>Descarga completa</th><th>Fechou o peso</th><th>Motorista / cultivar</th><th>Responsável</th><th>Envio</th><th></th></tr></thead>
                <tbody>${pg.itens.map((v) => { const al = (v.alertas || V().alertas(v)).length; const nao = (x) => (x === 'NAO' ? html`<strong class="texto-erro">NÃO</strong>` : (RR[x] || '—')); return html`
                  <tr class="linha-clicavel ${al ? 'linha-alerta' : ''}" tabindex="0" data-vei="${v.id}">
                    <td class="nowrap">${util.fmtDataHora(v.dataHora)}</td>
                    <td>${v.tipo === 'conferencia' ? 'Conferência' : ui.seloSimples('Sem vistoria', 'selo-pendente', 'assinatura')}</td>
                    <td class="nowrap"><strong>${v.placa}</strong>${v.placaConferir ? html` ${ui.seloSimples('conferir', 'selo-pendente', 'alerta')}` : ''}</td>
                    <td>${v.tipo === 'conferencia' ? V().ROTULO_TURNO[v.turno] : '—'}</td>
                    <td>${v.origem || '—'}</td>
                    <td>${v.tipo === 'conferencia' ? nao(v.identificacaoRetirada) : '—'}</td>
                    <td>${v.tipo === 'conferencia' ? nao(v.descarregadoCompleto) : '—'}</td>
                    <td>${v.tipo === 'conferencia' ? (v.fechouPeso === 'NA' ? 'Não se aplica' : nao(v.fechouPeso)) : '—'}</td>
                    <td>${v.tipo === 'autorizacao' ? html`${v.motorista}<div class="texto-menor">${v.cultivarAnterior}</div>` : '—'}</td>
                    <td>${v.responsavelNome}</td>
                    <td>${ui.seloEnvio(v.situacaoEnvio)}</td>
                    <td><button type="button" class="btn btn-secundario btn-p" data-acao="pdf" data-id="${v.id}">${icone('pdf', 16)}<span>PDF</span></button></td>
                  </tr>`; })}</tbody>
              </table>
            </div>
            ${ui.paginacao(pg, 'registros')}
          </div>`);
      }

      function aoFiltrar(ev) {
        const x = ev.target.closest('[data-f]');
        if (!x) return;
        F[x.dataset.f] = x.value; pagina = 1; desenhar();
      }
      el.addEventListener('input', aoFiltrar);
      el.addEventListener('change', aoFiltrar);
      el.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-acao]');
        if (b && b.dataset.acao === 'pdf') { ev.stopPropagation(); ui.ocupar(b, () => CKL.pdfVeiculos.gerar(b.dataset.id).then((p) => CKL.arquivos.salvar(p.blob, p.nome))).catch(ui.erro); return; }
        if (b && b.dataset.acao === 'pagina') { pagina = Number(b.dataset.pagina); desenhar(); return; }
        if (b && b.dataset.acao === 'excel') {
          ui.ocupar(b, () => CKL.excel.exportarVeiculos(filtrar(todos)).then((x) => CKL.arquivos.salvar(x.blob, x.nome)).then((r) => { if (r === 'salvo') ui.aviso('Planilha gerada.', 'ok'); })).catch(ui.erro);
          return;
        }
        if (b && b.dataset.acao === 'pdf-periodo') {
          const tipo = b.dataset.tipo, lista = filtrar(todos).filter((v) => v.tipo === tipo);
          if (!lista.length) { ui.aviso('Nenhum registro deste formulário no filtro.', 'alerta'); return; }
          ui.ocupar(b, () => CKL.pdfVeiculos.periodo(lista, tipo, descricaoPeriodo(lista.length)).then((p) => CKL.arquivos.salvar(p.blob, p.nome))).catch(ui.erro);
          return;
        }
        const tr = ev.target.closest('tr[data-vei]');
        if (tr) abrirRegistro(tr.dataset.vei, carregar);
      });
      el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { const tr = ev.target.closest('tr[data-vei]'); if (tr) abrirRegistro(tr.dataset.vei, carregar); } });
      const desligar = [CKL.eventos.ouvir('veiculos:alterado', carregar)];
      carregar();
      return function desmontar() { montado = false; desligar.forEach((d) => d && d()); };
    }
  };
})(window);
