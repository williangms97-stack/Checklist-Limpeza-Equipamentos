/* ==========================================================================
   Modelos de checklist — locais, secadores, equipamentos e itens
   Toda alteração cria uma nova versão do modelo. Checklists já feitos guardam a
   versão usada e não mudam. Itens nunca são apagados: são desativados.
   ========================================================================== */
(function (global) {
  'use strict';
  const CKL = global.CKL;
  const { ui, util, config: cfg } = CKL;
  const { html, icone } = ui;

  CKL.telas.adm.modelos = {
    montar(el) {
      let modelos = [], montado = true;
      el.innerHTML = html`
        <header class="pagina-topo">
          <div><h1>Modelos de checklist</h1><p>Cada UBS e cada secador tem o próprio checklist, com os equipamentos do documento original</p></div>
          <div class="pagina-acoes"><button type="button" class="btn btn-primario" data-acao="novo">${icone('mais', 18)}<span>Novo checklist</span></button></div>
        </header>
        <div id="md-lista"><p class="texto-menor">Carregando…</p></div>
        <div id="md-veiculos"></div>`;

      function carregar() {
        desenharVeiculos();
        return CKL.modelos.listar().then((l) => { if (!montado) return; modelos = l; desenhar(); }).catch(ui.erro);
      }

      /* ---------- Fichas de limpeza de veículo (só o cabeçalho é editável) ---------- */
      const DV = () => CKL.documentosVeiculo;
      function desenharVeiculos() {
        if (!montado) return;
        el.querySelector('#md-veiculos').innerHTML = String(html`
          <section class="pilha">
            <h2 class="secao-titulo">Limpeza de veículo · 2 fichas</h2>
            <div class="ck-modelos">${DV().TIPOS.map((t) => {
              const f = CKL.formulariosVeiculos[t], d = DV().atual(t);
              return html`
                <article class="cartao ck-modelo">
                  <header><strong>${f.nome}</strong><span class="selos">${ui.seloSimples('Ativo', 'selo-registrada', 'check')}</span></header>
                  ${ui.dados([['Identificação', d.identificacao], ['Versão', d.versaoDocumento || '—'], ['Elaborado por', d.elaboradoPor],
                    ['Revisado por', d.revisadoPor], ['Aprovado por', d.aprovadoPor], ['Aprovado em', d.aprovadoEm ? util.fmtData(d.aprovadoEm) : '—']], 'dados-3col')}
                  ${d.atualizadoEm ? html`<p class="texto-menor">Cabeçalho alterado em ${util.fmtDataHora(d.atualizadoEm)} por ${d.atualizadoPor}.</p>` : ''}
                  <div class="acoes-linha">
                    <button type="button" class="btn btn-secundario btn-p" data-acao="vei-editar" data-id="${t}">${icone('editar', 16)}<span>Editar cabeçalho</span></button>
                    <button type="button" class="btn btn-secundario btn-p" data-acao="vei-historico" data-id="${t}">${icone('historico', 16)}<span>Histórico</span></button>
                  </div>
                </article>`;
            })}</div>
            <p class="texto-menor">As perguntas das fichas seguem o documento original e não mudam aqui. Cada registro de veículo guarda o cabeçalho do dia em que foi feito.</p>
          </section>`);
      }

      function editarVeiculo(tipo) {
        const f = CKL.formulariosVeiculos[tipo], d = DV().atual(tipo), campos = DV().CAMPOS;
        ui.modal({
          titulo: f.nome + ' — cabeçalho', largura: 'g',
          conteudo: html`
            <form class="formulario" novalidate onsubmit="return false">
              <p class="texto-menor">${f.titulo}. Original: ${f.origem.arquivo} · aba "${f.origem.aba}". Os registros já feitos continuam com o cabeçalho que usaram.</p>
              <div class="formulario-linha">
                ${Object.keys(campos).map((c) => html`<div class="campo"><label for="dv-${c}">${campos[c]}</label>
                  <input id="dv-${c}" data-c="${c}" ${c === 'aprovadoEm' ? ui.bruto('type="date"') : ''} value="${d[c] || ''}" autocomplete="off"></div>`)}
              </div>
              <div class="campo"><label for="dv-motivo">Motivo da alteração</label><textarea id="dv-motivo" rows="2" maxlength="300" placeholder="Ex.: troca do aprovador, revisão 2 do documento"></textarea></div>
              <p class="form-erro" id="dv-erro" role="alert" hidden></p>
            </form>`,
          acoes: [
            { rotulo: 'Voltar', classe: 'btn-secundario', acao: (mm) => mm.fechar() },
            { rotulo: 'Salvar', classe: 'btn-primario', acao: (mm, botao) => {
              const dados = {};
              mm.corpo.querySelectorAll('[data-c]').forEach((i) => { dados[i.dataset.c] = i.value; });
              ui.ocupar(botao, () => DV().salvar(tipo, dados, mm.corpo.querySelector('#dv-motivo').value)).then((mudou) => {
                mm.fechar();
                ui.aviso(mudou ? 'Cabeçalho salvo. Vale para os próximos registros.' : 'Nada foi alterado.', 'ok');
                desenharVeiculos();
              }).catch((e) => { const x = mm.corpo.querySelector('#dv-erro'); x.textContent = ui.mensagemDe(e); x.hidden = false; if (!e || !e.amigavel) console.error(e); });
            } }
          ]
        });
      }

      function historicoVeiculo(tipo) {
        CKL.historico.daEntidade('documentoVeiculo', tipo).then((ev) => {
          ui.modal({
            titulo: CKL.formulariosVeiculos[tipo].nome + ' — histórico do cabeçalho', largura: 'g',
            conteudo: ev.length ? html`${CKL.telas.adm.eventosHtml(ev)}` : html`<p class="texto-menor">O cabeçalho ainda não foi alterado. Vale o do documento original.</p>`,
            acoes: [{ rotulo: 'Fechar', classe: 'btn-secundario', acao: (mm) => mm.fechar() }]
          });
        }).catch(ui.erro);
      }
      function desenhar() {
        const alvo = el.querySelector('#md-lista');
        if (!modelos.length) {
          alvo.innerHTML = String(html`<div class="cartao">${ui.vazio('planilha', 'Nenhum modelo carregado', 'Carregue os 16 checklists originais (5 UBS e 11 secadores).',
            html`<button type="button" class="btn btn-primario" data-acao="carregar">${icone('upload', 18)}<span>Carregar os checklists originais</span></button>`)}</div>`);
          return;
        }
        const areas = CKL.modelos.areas(modelos);
        alvo.innerHTML = String(html`${areas.map((a) => {
          const lista = modelos.filter((m) => m.area === a.id);
          if (!lista.length) return '';
          return html`
            <section class="pilha">
              <h2 class="secao-titulo">${a.rotulo} · ${util.plural(lista.length, 'checklist', 'checklists')}</h2>
              <div class="ck-modelos">${lista.map((m) => html`
                <article class="cartao ck-modelo ${m.ativo === false ? 'inativo' : ''}">
                  <header><strong>${m.nome}</strong><span class="selos">${m.ativo === false ? ui.seloSimples('Inativo', 'selo-neutro', 'anular') : ui.seloSimples('Ativo', 'selo-registrada', 'check')}</span></header>
                  ${ui.dados([['Identificação', m.identificacao], ['Versão do documento', m.versaoDocumento], ['Itens ativos', String(CKL.modelos.itensAtivos(m).length)],
                    ['Versão do modelo', String(m.versaoModelo || 1)], ['Termo Liberada/Não liberada', m.temTermo ? 'Sim' : 'Não'], ['Atualizado', util.fmtData((m.atualizadoEm || '').slice(0, 10))]], 'dados-3col')}
                  <div class="acoes-linha">
                    <button type="button" class="btn btn-secundario btn-p" data-acao="editar" data-id="${m.id}">${icone('editar', 16)}<span>Ver e editar</span></button>
                    <button type="button" class="btn btn-secundario btn-p" data-acao="versoes" data-id="${m.id}">${icone('historico', 16)}<span>Versões</span></button>
                    <button type="button" class="btn ${m.ativo === false ? 'btn-secundario' : 'btn-perigo-suave'} btn-p" data-acao="situacao" data-id="${m.id}">${icone(m.ativo === false ? 'check' : 'anular', 16)}<span>${m.ativo === false ? 'Ativar' : 'Desativar'}</span></button>
                  </div>
                </article>`)}</div>
            </section>`;
        })}`);
      }

      /* ---------- Edição (nova versão) ---------- */
      function editar(id) {
        const m = modelos.filter((x) => x.id === id)[0];
        if (!m) return;
        let itens = (m.itens || []).slice().sort((a, b) => a.ordem - b.ordem).map((i) => Object.assign({}, i));
        const campos = CKL.modelos.CAMPOS;
        const modal = ui.modal({
          titulo: m.nome + ' — versão ' + (m.versaoModelo || 1), largura: 'xg',
          conteudo: html`
            <form id="md-form" class="formulario" novalidate>
              ${m.origem && m.origem.arquivo ? html`<p class="texto-menor">${icone('planilha', 14)} Original: ${m.origem.arquivo} · aba "${m.origem.aba}". Salvar cria a versão ${(m.versaoModelo || 1) + 1}; checklists já feitos continuam com a versão que usaram.</p>` : ''}
              <div class="formulario-linha">
                ${Object.keys(campos).map((c) => html`<div class="campo"><label for="md-${c}">${campos[c]}</label>
                  <input id="md-${c}" data-c="${c}" ${c === 'aprovadoEm' ? ui.bruto('type="date"') : ''} value="${m[c] || ''}"></div>`)}
              </div>
              <label class="marcador"><input type="checkbox" id="md-termo" ${m.temTermo ? ui.bruto('checked') : ''}> Tem termo de conclusão (Liberada / Não liberada)</label>
              <h3 class="secao-titulo">Itens a serem avaliados</h3>
              <div id="md-itens"></div>
              <div><button type="button" class="btn btn-secundario" data-md="incluir">${icone('mais', 18)}<span>Incluir item</span></button></div>
              <div class="campo"><label for="md-motivo">Motivo da alteração</label><textarea id="md-motivo" rows="2" maxlength="300" placeholder="Ex.: revisão 5 do documento, inclusão do Elevador em Z"></textarea></div>
              <p class="form-erro" id="md-erro" role="alert" hidden></p>
            </form>`,
          acoes: [
            { rotulo: 'Voltar', classe: 'btn-secundario', acao: (mm) => mm.fechar() },
            { rotulo: 'Salvar nova versão', classe: 'btn-primario', acao: (mm, botao) => {
              lerItens();
              const d = { temTermo: mm.corpo.querySelector('#md-termo').checked, itens: itens };
              mm.corpo.querySelectorAll('[data-c]').forEach((i) => { d[i.dataset.c] = i.value; });
              ui.ocupar(botao, () => CKL.modelos.salvarVersao(m.id, d, mm.corpo.querySelector('#md-motivo').value)).then((novo) => {
                mm.fechar();
                ui.aviso(novo.versaoModelo !== m.versaoModelo ? 'Versão ' + novo.versaoModelo + ' salva.' : 'Nada foi alterado.', 'ok');
                carregar();
              }).catch((e) => { const x = mm.corpo.querySelector('#md-erro'); x.textContent = ui.mensagemDe(e); x.hidden = false; if (!e || !e.amigavel) console.error(e); });
            } }
          ]
        });
        const alvo = modal.corpo.querySelector('#md-itens');
        function lerItens() {
          alvo.querySelectorAll('tr[data-i]').forEach((tr) => {
            const it = itens[Number(tr.dataset.i)];
            it.texto = tr.querySelector('[data-k=texto]').value;
            it.secao = tr.querySelector('[data-k=secao]').value;
            it.ativo = tr.querySelector('[data-k=ativo]').checked;
          });
        }
        function desenharItens() {
          alvo.innerHTML = String(html`
            <div class="tabela-rolagem"><table class="tabela tabela-compacta ck-editor-itens">
              <thead><tr><th class="num">Nº</th><th>Item (texto exato)</th><th>Seção</th><th>Ativo</th><th>Posição</th></tr></thead>
              <tbody>${itens.map((i, k) => html`
                <tr data-i="${k}" class="${i.ativo === false ? 'linha-apagada' : ''}">
                  <td class="num">${k + 1}</td>
                  <td><input data-k="texto" value="${i.texto}" aria-label="Texto do item ${k + 1}"></td>
                  <td><input data-k="secao" value="${i.secao || ''}" aria-label="Seção do item ${k + 1}" placeholder="—"></td>
                  <td class="col-marca"><input type="checkbox" data-k="ativo" aria-label="Item ${k + 1} ativo" ${i.ativo !== false ? ui.bruto('checked') : ''}></td>
                  <td class="nowrap"><button type="button" class="btn-icone" data-md="subir" data-k="${k}" aria-label="Subir o item ${k + 1}" ${k === 0 ? ui.bruto('disabled') : ''}>${icone('voltar', 18)}</button>
                    <button type="button" class="btn-icone" data-md="descer" data-k="${k}" aria-label="Descer o item ${k + 1}" ${k === itens.length - 1 ? ui.bruto('disabled') : ''}>${icone('avancar', 18)}</button></td>
                </tr>`)}</tbody>
            </table></div>
            <p class="texto-menor">Para tirar um item do checklist, desmarque "Ativo". Ele continua guardado no histórico das versões.</p>`);
        }
        desenharItens();
        modal.corpo.addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-md]');
          if (!b) return;
          lerItens();
          const k = Number(b.dataset.k);
          if (b.dataset.md === 'incluir') itens.push({ id: null, texto: '', secao: '', ativo: true });
          else if (b.dataset.md === 'subir' && k > 0) itens.splice(k - 1, 0, itens.splice(k, 1)[0]);
          else if (b.dataset.md === 'descer' && k < itens.length - 1) itens.splice(k + 1, 0, itens.splice(k, 1)[0]);
          desenharItens();
          if (b.dataset.md === 'incluir') { const ult = alvo.querySelector('tr:last-child [data-k=texto]'); if (ult) ult.focus(); }
        });
      }

      /* ---------- Versões ---------- */
      function versoes(id) {
        CKL.modelos.versoes(id).then((l) => {
          const m = ui.modal({
            titulo: 'Versões do modelo', largura: 'g',
            conteudo: html`
              <p class="texto-menor">Cada checklist feito guarda a cópia da versão usada. Esta lista mostra as versões guardadas neste ${CKL.nuvem && CKL.nuvem.ativa ? 'servidor' : 'aparelho'}.</p>
              <div class="tabela-rolagem"><table class="tabela tabela-compacta">
                <thead><tr><th class="num">Versão</th><th>Data</th><th>Por</th><th>Documento</th><th class="num">Itens ativos</th><th></th></tr></thead>
                <tbody>${l.map((v) => html`<tr><td class="num">${v.versaoModelo}</td><td>${util.fmtDataHora(v.atualizadoEm)}</td><td>${v.atualizadoPor}</td>
                  <td>${v.identificacao} · v${v.versaoDocumento}</td><td class="num">${CKL.modelos.itensAtivos(v).length}</td>
                  <td><button type="button" class="btn btn-secundario btn-p" data-v="${v.chave}">Ver itens</button></td></tr>`)}</tbody>
              </table></div>
              <div id="md-versao"></div>`
          });
          m.corpo.addEventListener('click', (ev) => {
            const b = ev.target.closest('[data-v]');
            if (!b) return;
            const v = l.filter((x) => x.chave === b.dataset.v)[0];
            m.corpo.querySelector('#md-versao').innerHTML = String(html`<h3 class="secao-titulo">Versão ${v.versaoModelo}</h3>
              <ol class="ck-lista-simples">${CKL.modelos.itensAtivos(v).map((i) => html`<li><span class="ck-item-num">${i.ordem}</span>${i.secao ? html`<small>${i.secao} · </small>` : ''}${i.texto}</li>`)}</ol>`);
          });
        }).catch(ui.erro);
      }

      /* ---------- Novo checklist ---------- */
      function novo() {
        const areas = CKL.modelos.areas(modelos);
        const m = ui.modal({
          titulo: 'Novo checklist', largura: 'g',
          conteudo: html`
            <form class="formulario" novalidate>
              <p class="texto-menor">Use para um novo secador, uma nova UBS ou um novo local. Os itens podem ser ajustados depois (cada ajuste vira uma nova versão).</p>
              <div class="formulario-linha">
                <div class="campo"><label for="nv-area">Área</label><select id="nv-area">${ui.opcoes(areas.map((a) => ({ valor: a.id, rotulo: a.rotulo })).concat([{ valor: '__nova', rotulo: 'Outra área (novo local)…' }]), areas[0] && areas[0].id)}</select></div>
                <div class="campo" id="nv-area-nova-campo" hidden><label for="nv-area-nova">Nome da nova área</label><input id="nv-area-nova" maxlength="40"></div>
                <div class="campo"><label for="nv-nome">Nome</label><input id="nv-nome" maxlength="60" placeholder="Ex.: Secador 09"></div>
                <div class="campo"><label for="nv-ident">Identificação</label><input id="nv-ident" maxlength="20" placeholder="Ex.: CKL 38"></div>
                <div class="campo"><label for="nv-versao">Versão do documento</label><input id="nv-versao" maxlength="10"></div>
                <div class="campo"><label for="nv-elab">Elaborado por</label><input id="nv-elab" maxlength="80"></div>
                <div class="campo"><label for="nv-rev">Revisado por</label><input id="nv-rev" maxlength="80"></div>
                <div class="campo"><label for="nv-aprov">Aprovado por</label><input id="nv-aprov" maxlength="80"></div>
                <div class="campo"><label for="nv-data">Aprovado em</label><input id="nv-data" type="date"></div>
              </div>
              <label class="marcador"><input type="checkbox" id="nv-termo"> Tem termo de conclusão (Liberada / Não liberada)</label>
              <div class="campo"><label for="nv-itens">Itens a serem avaliados (um por linha, na ordem do documento)</label>
                <textarea id="nv-itens" rows="10" placeholder="Moega - Secador&#10;Elevador Moega&#10;Pré-limpeza&#10;…&#10;Piso"></textarea></div>
              <p class="form-erro" id="nv-erro" role="alert" hidden></p>
            </form>`,
          acoes: [
            { rotulo: 'Voltar', classe: 'btn-secundario', acao: (mm) => mm.fechar() },
            { rotulo: 'Criar checklist', classe: 'btn-primario', acao: (mm, botao) => {
              const q = (s) => mm.corpo.querySelector(s);
              const area = q('#nv-area').value === '__nova' ? q('#nv-area-nova').value : q('#nv-area').value;
              ui.ocupar(botao, () => CKL.modelos.criar({
                area: area, nome: q('#nv-nome').value, identificacao: q('#nv-ident').value, versaoDocumento: q('#nv-versao').value,
                elaboradoPor: q('#nv-elab').value, revisadoPor: q('#nv-rev').value, aprovadoPor: q('#nv-aprov').value, aprovadoEm: q('#nv-data').value,
                temTermo: q('#nv-termo').checked, itens: q('#nv-itens').value.split(/\r?\n/)
              })).then((x) => { mm.fechar(); ui.aviso('Checklist ' + x.nome + ' criado.', 'ok'); carregar(); })
                .catch((e) => { const er = q('#nv-erro'); er.textContent = ui.mensagemDe(e); er.hidden = false; if (!e || !e.amigavel) console.error(e); });
            } }
          ]
        });
        m.corpo.querySelector('#nv-area').addEventListener('change', (ev) => { m.corpo.querySelector('#nv-area-nova-campo').hidden = ev.target.value !== '__nova'; });
      }

      el.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-acao]');
        if (!b) return;
        const id = b.dataset.id, a = b.dataset.acao;
        if (a === 'vei-editar') editarVeiculo(id);
        else if (a === 'vei-historico') historicoVeiculo(id);
        else if (a === 'editar') editar(id);
        else if (a === 'versoes') versoes(id);
        else if (a === 'novo') novo();
        else if (a === 'carregar') ui.ocupar(b, () => CKL.modelos.carregarOriginais()).then(() => { ui.aviso('Os 16 checklists originais foram carregados.', 'ok'); carregar(); }).catch(ui.erro);
        else if (a === 'situacao') {
          const m = modelos.filter((x) => x.id === id)[0];
          const ativar = m.ativo === false;
          ui.confirmar({
            titulo: (ativar ? 'Ativar ' : 'Desativar ') + m.nome + '?',
            mensagem: ativar ? 'O checklist volta a aparecer no aplicativo do celular.' : 'O checklist deixa de aparecer no aplicativo. Os checklists já feitos continuam guardados.',
            rotuloConfirmar: ativar ? 'Ativar' : 'Desativar', perigo: !ativar, motivo: { rotulo: 'Motivo', obrigatorio: !ativar }
          }).then((r) => r && CKL.modelos.definirSituacao(id, ativar, r.motivo).then(() => { ui.aviso(m.nome + (ativar ? ' ativado.' : ' desativado.'), 'ok'); carregar(); })).catch(ui.erro);
        }
      });
      const desligar = [CKL.eventos.ouvir('modelos:alterado', carregar), CKL.eventos.ouvir(CKL.documentosVeiculo.APLICADO, desenharVeiculos)];
      carregar();
      return () => { montado = false; desligar.forEach((f) => f()); };
    }
  };
})(window);
