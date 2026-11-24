/* ==========================================================================
   Cadastros simples do ADM: Cultivares e Motivos de autorização
   (mesma tela; regras em js/servicos/cadastro-simples.js)
   ========================================================================== */
(function (global) {
  'use strict';
  const CKL = global.CKL;
  const { ui, util } = CKL;
  const { html, icone } = ui;

  /** Servidor ainda sem o SQL que cria a tabela: explica o que fazer. */
  function erroAmigavel(e, sql) {
    const msg = (e && e.message) || '';
    if (/Coleção inválida/i.test(msg)) {
      const er = new Error('O servidor ainda não tem este cadastro. Rode o arquivo supabase/' + sql + ' no SQL Editor do Supabase e tente de novo.');
      er.amigavel = true;
      return er;
    }
    return e;
  }

  /**
   * op: { servico: () => CKL.cultivares, sql: '02_cultivares.sql', evento, icone,
   *       titulo, subtitulo, novo: 'Nova cultivar', exemplo, busca, rodape,
   *       um: 'cultivar', varios: 'cultivares', fem: true, multilinha }
   */
  function paginaCadastro(op) {
    const S = op.servico;
    const o = (f, m) => (op.fem ? f : m);
    const ativo = o('Ativa', 'Ativo'), inativo = o('Inativa', 'Inativo');

    function formulario(item, aoSalvar) {
      const novo = !item;
      ui.modal({
        titulo: novo ? op.novo : 'Editar ' + op.um, largura: 'p',
        conteudo: html`
          <form class="formulario" novalidate onsubmit="return false">
            <div class="campo"><label for="cad-nome">${op.rotuloCampo}</label>
              ${op.multilinha
                ? html`<textarea id="cad-nome" rows="3" maxlength="${S().TAMANHO_MAXIMO}">${item ? item.nome : ''}</textarea>`
                : html`<input type="text" id="cad-nome" maxlength="${S().TAMANHO_MAXIMO}" value="${item ? item.nome : ''}" autocomplete="off" spellcheck="false">`}</div>
            <p class="campo-ajuda">${novo ? op.exemplo : 'Os registros já feitos continuam com o texto antigo; o novo vale para os próximos.'}</p>
            <p class="form-erro" id="cad-erro" role="alert" hidden></p>
          </form>`,
        acoes: [
          { rotulo: 'Voltar', classe: 'btn-secundario', acao: (mm) => mm.fechar() },
          { rotulo: novo ? 'Cadastrar' : 'Salvar', classe: 'btn-primario', acao: (mm, botao) => {
            const nome = mm.corpo.querySelector('#cad-nome').value;
            ui.ocupar(botao, () => (novo ? S().criar(nome) : S().renomear(item.id, nome)).then(() => {
              mm.fechar(); ui.aviso(novo ? 'Cadastro feito.' : 'Alteração salva.', 'ok'); aoSalvar();
            })).catch((e) => {
              const er = mm.corpo.querySelector('#cad-erro');
              er.textContent = ui.mensagemDe(erroAmigavel(e, op.sql)); er.hidden = false;
            });
          } }
        ]
      });
      const campo = global.document.getElementById('cad-nome');
      if (campo) setTimeout(() => campo.focus(), 50);
    }

    return {
      montar(el) {
        let lista = [], busca = '', montado = true;
        el.innerHTML = html`
          <header class="pagina-topo">
            <div><h1>${op.titulo}</h1><p>${op.subtitulo}</p></div>
            <div class="pagina-acoes"><button type="button" class="btn btn-primario" data-acao="nova">${icone('mais', 18)}<span>${op.novo}</span></button></div>
          </header>
          <div id="cad-inicial"></div>
          <section class="filtros" aria-label="Pesquisa">
            <div class="campo campo-largo"><label for="cad-busca">Pesquisar</label>
              <input type="search" id="cad-busca" placeholder="${op.busca}" autocomplete="off"></div>
          </section>
          <div id="cad-lista" class="pilha"><p class="texto-menor">Carregando…</p></div>`;

        function desenharLista() {
          const termo = util.limpar(busca).toUpperCase();
          const vis = termo ? lista.filter((c) => c.nome.toUpperCase().indexOf(termo) >= 0) : lista;
          const ativas = lista.filter((c) => c.ativa !== false).length;
          el.querySelector('#cad-lista').innerHTML = lista.length ? html`
            <p class="texto-menor">${util.plural(ativas, op.um + ' ' + ativo.toLowerCase(), op.varios + ' ' + ativo.toLowerCase() + 's')}${lista.length - ativas ? ' · ' + util.plural(lista.length - ativas, inativo.toLowerCase(), inativo.toLowerCase() + 's') : ''}${termo ? ' · ' + util.plural(vis.length, o('encontrada', 'encontrado'), o('encontradas', 'encontrados')) : ''}</p>
            <div class="cartao cartao-tabela">
              <div class="tabela-rolagem">
                <table class="tabela">
                  <thead><tr><th>${op.rotuloCampo}</th><th>Situação</th><th>Cadastro</th><th>Ações</th></tr></thead>
                  <tbody>${vis.map((c) => html`
                    <tr class="${c.ativa !== false ? '' : 'linha-apagada'}">
                      <td><strong>${c.nome}</strong></td>
                      <td>${c.ativa !== false ? ui.seloSimples(ativo, 'selo-registrada', 'check') : ui.seloSimples(inativo, 'selo-neutro', 'anular')}</td>
                      <td class="nowrap">${util.fmtDataHora(c.criadaEm)}<div class="texto-menor">${c.criadaPor || ''}</div></td>
                      <td><div class="acoes-linha">
                        <button type="button" class="btn btn-secundario btn-p" data-acao="editar" data-id="${c.id}">${icone('editar', 16)}<span>Editar</span></button>
                        <button type="button" class="btn btn-fantasma btn-p" data-acao="${c.ativa !== false ? 'desativar' : 'ativar'}" data-id="${c.id}">${icone(c.ativa !== false ? 'anular' : 'check', 16)}<span>${c.ativa !== false ? 'Desativar' : 'Ativar'}</span></button>
                      </div></td>
                    </tr>`)}</tbody>
                </table>
              </div>
              ${vis.length ? '' : html`<p class="texto-menor" style="padding:1rem">Nada encontrado com "${busca}".</p>`}
            </div>
            <p class="texto-menor">${op.rodape} Nada é apagado; cada inclusão e alteração fica no Histórico.</p>`
            : ui.vazio(op.icone, 'Nada cadastrado ainda', op.vazio);
        }

        function carregar() {
          return Promise.all([S().listar(), S().faltamDaListaInicial()]).then(([l, faltam]) => {
            if (!montado) return;
            lista = l;
            el.querySelector('#cad-inicial').innerHTML = faltam.length ? html`
              <div class="alerta alerta-info">${icone(op.icone, 20)}<div>
                <strong>${l.length ? util.plural(faltam.length, op.um + ' da lista inicial ainda não está ' + o('cadastrada', 'cadastrado'), op.varios + ' da lista inicial ainda não estão ' + o('cadastradas', 'cadastrados'))
                  : 'Lista inicial com ' + util.plural(faltam.length, op.um, op.varios) + ' da empresa'}</strong>
                <p>${faltam.slice(0, 6).join(', ')}${faltam.length > 6 ? '…' : ''}</p>
                <button type="button" class="btn btn-primario" data-acao="inicial">${icone('upload', 18)}<span>Cadastrar ${util.plural(faltam.length, op.um, op.varios)}</span></button>
              </div></div>` : '';
            desenharLista();
          }).catch((e) => ui.erro(erroAmigavel(e, op.sql)));
        }

        el.addEventListener('input', (ev) => {
          if (ev.target.id === 'cad-busca') { busca = ev.target.value; desenharLista(); }
        });
        el.addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-acao]');
          if (!b) return;
          const c = lista.filter((x) => x.id === b.dataset.id)[0], acao = b.dataset.acao;
          const falhou = (e) => ui.erro(erroAmigavel(e, op.sql));
          if (acao === 'nova') formulario(null, carregar);
          else if (acao === 'editar' && c) formulario(c, carregar);
          else if (acao === 'inicial') {
            ui.ocupar(b, () => S().carregarIniciais()).then((n) => {
              ui.aviso(util.plural(n, op.um + ' ' + o('cadastrada', 'cadastrado'), op.varios + ' ' + o('cadastradas', 'cadastrados')) + '.', 'ok'); return carregar();
            }).catch(falhou);
          }
          else if (acao === 'ativar' && c) S().definirSituacao(c.id, true).then(() => { ui.aviso(o('Reativada', 'Reativado') + ': ' + c.nome, 'ok'); return carregar(); }).catch(falhou);
          else if (acao === 'desativar' && c) {
            ui.confirmar({ titulo: 'Desativar "' + c.nome + '"?', mensagem: op.desativar, rotuloConfirmar: 'Desativar' })
              .then((r) => r && S().definirSituacao(c.id, false).then(() => { ui.aviso(o('Desativada', 'Desativado') + ': ' + c.nome, 'ok'); return carregar(); }))
              .catch(falhou);
          }
        });
        const desligar = [CKL.eventos.ouvir(op.evento, carregar)];
        carregar();
        return function desmontar() { montado = false; desligar.forEach((d) => d && d()); };
      }
    };
  }

  CKL.telas.adm.cultivares = paginaCadastro({
    servico: () => CKL.cultivares, sql: '02_cultivares.sql', evento: 'cultivares:alterado', icone: 'semente',
    titulo: 'Cultivares', subtitulo: 'Lista usada nos campos "Cultivar anterior" e "Próxima cultivar" dos checklists e na autorização de veículo',
    novo: 'Nova cultivar', rotuloCampo: 'Cultivar', exemplo: 'Escreva como deve aparecer no checklist. Ex.: NEO750 IPRO.',
    busca: 'Parte do nome. Ex.: NEO, I2X, 750', um: 'cultivar', varios: 'cultivares', fem: true,
    vazio: 'Cadastre a lista inicial acima ou inclua as cultivares uma a uma em "Nova cultivar".',
    rodape: 'Cultivar desativada some da lista do celular, mas continua nos registros em que já foi usada.',
    desativar: 'Ela deixa de aparecer na lista do celular. Os registros em que já foi usada não mudam. Pode ser reativada depois.'
  });

  CKL.telas.adm.motivos = paginaCadastro({
    servico: () => CKL.motivos, sql: '03_veiculos.sql', evento: 'motivos:alterado', icone: 'assinatura', multilinha: true,
    titulo: 'Motivos de autorização', subtitulo: 'Motivos padrão da autorização de liberação de veículo sem vistoria de limpeza (o usuário também pode escrever um motivo livre)',
    novo: 'Novo motivo', rotuloCampo: 'Motivo', exemplo: 'Escreva o motivo como deve aparecer na autorização.',
    busca: 'Parte do texto do motivo', um: 'motivo', varios: 'motivos', fem: false,
    vazio: 'Inclua os motivos mais usados em "Novo motivo". Sem motivos cadastrados, o celular mostra só o campo de texto livre.',
    rodape: 'Motivo desativado some da lista do celular, mas continua nas autorizações em que já foi usado.',
    desativar: 'Ele deixa de aparecer na lista do celular. As autorizações em que já foi usado não mudam. Pode ser reativado depois.'
  });
})(window);
