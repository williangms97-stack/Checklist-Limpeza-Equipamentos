/* ==========================================================================
   Cadastro de cultivares (exclusivo do ADM)
   ========================================================================== */
(function (global) {
  'use strict';
  const CKL = global.CKL;
  const { ui, util } = CKL;
  const { html, icone } = ui;

  /** Servidor ainda sem o supabase/02_cultivares.sql: explica o que fazer. */
  function erroAmigavel(e) {
    const msg = (e && e.message) || '';
    if (/Coleção inválida/i.test(msg)) {
      const er = new Error('O servidor ainda não tem o cadastro de cultivares. Rode o arquivo supabase/02_cultivares.sql no SQL Editor do Supabase e tente de novo.');
      er.amigavel = true;
      return er;
    }
    return e;
  }

  function formulario(cultivar, aoSalvar) {
    const nova = !cultivar;
    ui.modal({
      titulo: nova ? 'Nova cultivar' : 'Editar cultivar', largura: 'p',
      conteudo: html`
        <form class="formulario" novalidate>
          <div class="campo"><label for="cultivar-nome">Nome da cultivar</label>
            <input type="text" id="cultivar-nome" maxlength="${CKL.cultivares.TAMANHO_MAXIMO}" value="${cultivar ? cultivar.nome : ''}" autocomplete="off" spellcheck="false"></div>
          <p class="campo-ajuda">${nova ? 'Escreva como deve aparecer no checklist. Ex.: NEO750 IPRO.'
            : 'Os checklists já feitos continuam com o nome antigo; o novo nome vale para os próximos.'}</p>
          <p class="form-erro" id="cultivar-erro" role="alert" hidden></p>
        </form>`,
      acoes: [
        { rotulo: 'Voltar', classe: 'btn-secundario', acao: (mm) => mm.fechar() },
        { rotulo: nova ? 'Cadastrar' : 'Salvar', classe: 'btn-primario', acao: (mm, botao) => {
          const nome = mm.corpo.querySelector('#cultivar-nome').value;
          ui.ocupar(botao, () => (nova ? CKL.cultivares.criar(nome) : CKL.cultivares.renomear(cultivar.id, nome)).then((c) => {
            mm.fechar(); ui.aviso(nova ? 'Cultivar ' + c.nome + ' cadastrada.' : 'Cultivar atualizada.', 'ok'); aoSalvar();
          })).catch((e) => {
            const er = mm.corpo.querySelector('#cultivar-erro');
            er.textContent = ui.mensagemDe(erroAmigavel(e)); er.hidden = false;
          });
        } }
      ]
    });
    const campo = global.document.getElementById('cultivar-nome');
    if (campo) setTimeout(() => campo.focus(), 50);
  }

  CKL.telas.adm.cultivares = {
    montar(el) {
      let lista = [], busca = '', montado = true;
      el.innerHTML = html`
        <header class="pagina-topo">
          <div><h1>Cultivares</h1><p>Lista usada nos campos "Cultivar anterior" e "Próxima cultivar" dos checklists</p></div>
          <div class="pagina-acoes"><button type="button" class="btn btn-primario" data-acao="nova">${icone('mais', 18)}<span>Nova cultivar</span></button></div>
        </header>
        <div id="cultivares-inicial"></div>
        <section class="filtros" aria-label="Pesquisa de cultivares">
          <div class="campo campo-largo"><label for="cultivares-busca">Pesquisar</label>
            <input type="search" id="cultivares-busca" placeholder="Parte do nome. Ex.: NEO, I2X, 750" autocomplete="off"></div>
        </section>
        <div id="cultivares-lista" class="pilha"><p class="texto-menor">Carregando…</p></div>`;

      function desenharLista() {
        const termo = util.limpar(busca).toUpperCase();
        const vis = termo ? lista.filter((c) => c.nome.toUpperCase().indexOf(termo) >= 0) : lista;
        const ativas = lista.filter((c) => c.ativa !== false).length;
        el.querySelector('#cultivares-lista').innerHTML = lista.length ? html`
          <p class="texto-menor">${util.plural(ativas, 'cultivar ativa', 'cultivares ativas')}${lista.length - ativas ? ' · ' + util.plural(lista.length - ativas, 'inativa', 'inativas') : ''}${termo ? ' · ' + util.plural(vis.length, 'encontrada', 'encontradas') : ''}</p>
          <div class="cartao cartao-tabela">
            <div class="tabela-rolagem">
              <table class="tabela">
                <thead><tr><th>Cultivar</th><th>Situação</th><th>Cadastrada em</th><th>Ações</th></tr></thead>
                <tbody>${vis.map((c) => html`
                  <tr class="${c.ativa !== false ? '' : 'linha-apagada'}">
                    <td><strong>${c.nome}</strong></td>
                    <td>${c.ativa !== false ? ui.seloSimples('Ativa', 'selo-registrada', 'check') : ui.seloSimples('Inativa', 'selo-neutro', 'anular')}</td>
                    <td class="nowrap">${util.fmtDataHora(c.criadaEm)}<div class="texto-menor">${c.criadaPor || ''}</div></td>
                    <td><div class="acoes-linha">
                      <button type="button" class="btn btn-secundario btn-p" data-acao="editar" data-id="${c.id}">${icone('editar', 16)}<span>Editar</span></button>
                      <button type="button" class="btn btn-fantasma btn-p" data-acao="${c.ativa !== false ? 'desativar' : 'ativar'}" data-id="${c.id}">${icone(c.ativa !== false ? 'anular' : 'check', 16)}<span>${c.ativa !== false ? 'Desativar' : 'Ativar'}</span></button>
                    </div></td>
                  </tr>`)}</tbody>
              </table>
            </div>
            ${vis.length ? '' : html`<p class="texto-menor" style="padding:1rem">Nenhuma cultivar com "${busca}".</p>`}
          </div>
          <p class="texto-menor">Cultivar desativada some da lista do celular, mas continua nos checklists em que já foi usada. Nada é apagado; cada inclusão e alteração fica no Histórico.</p>`
          : ui.vazio('semente', 'Nenhuma cultivar cadastrada', 'Cadastre a lista inicial acima ou inclua as cultivares uma a uma em "Nova cultivar".');
      }

      function carregar() {
        return Promise.all([CKL.cultivares.listar(), CKL.cultivares.faltamDaListaInicial()]).then(([l, faltam]) => {
          if (!montado) return;
          lista = l;
          el.querySelector('#cultivares-inicial').innerHTML = faltam.length ? html`
            <div class="alerta alerta-info">${icone('semente', 20)}<div>
              <strong>${l.length ? util.plural(faltam.length, 'cultivar da lista inicial ainda não está cadastrada', 'cultivares da lista inicial ainda não estão cadastradas')
                : 'Lista inicial com ' + util.plural(faltam.length, 'cultivar', 'cultivares') + ' da empresa'}</strong>
              <p>${faltam.slice(0, 6).join(', ')}${faltam.length > 6 ? '…' : ''}</p>
              <button type="button" class="btn btn-primario" data-acao="inicial">${icone('upload', 18)}<span>Cadastrar ${util.plural(faltam.length, 'cultivar', 'cultivares')}</span></button>
            </div></div>` : '';
          desenharLista();
        }).catch((e) => ui.erro(erroAmigavel(e)));
      }

      el.addEventListener('input', (ev) => {
        if (ev.target.id === 'cultivares-busca') { busca = ev.target.value; desenharLista(); }
      });
      el.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-acao]');
        if (!b) return;
        const c = lista.filter((x) => x.id === b.dataset.id)[0], acao = b.dataset.acao;
        if (acao === 'nova') formulario(null, carregar);
        else if (acao === 'editar' && c) formulario(c, carregar);
        else if (acao === 'inicial') {
          ui.ocupar(b, () => CKL.cultivares.carregarIniciais()).then((n) => {
            ui.aviso(util.plural(n, 'cultivar cadastrada', 'cultivares cadastradas') + '.', 'ok'); return carregar();
          }).catch((e) => ui.erro(erroAmigavel(e)));
        }
        else if (acao === 'ativar' && c) CKL.cultivares.definirSituacao(c.id, true).then(() => { ui.aviso(c.nome + ' reativada.', 'ok'); return carregar(); }).catch((e) => ui.erro(erroAmigavel(e)));
        else if (acao === 'desativar' && c) {
          ui.confirmar({ titulo: 'Desativar ' + c.nome + '?', mensagem: 'Ela deixa de aparecer na lista do celular. Os checklists em que já foi usada não mudam. Pode ser reativada depois.', rotuloConfirmar: 'Desativar' })
            .then((r) => r && CKL.cultivares.definirSituacao(c.id, false).then(() => { ui.aviso(c.nome + ' desativada.', 'ok'); return carregar(); }))
            .catch((e) => ui.erro(erroAmigavel(e)));
        }
      });
      const desligar = [CKL.eventos.ouvir('cultivares:alterado', carregar)];
      carregar();
      return function desmontar() { montado = false; desligar.forEach((d) => d && d()); };
    }
  };
})(window);
