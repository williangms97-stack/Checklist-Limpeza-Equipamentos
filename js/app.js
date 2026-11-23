/* ==========================================================================
   Inicialização e troca entre as interfaces:
   acesso (login) · aplicativo do celular · painel do administrador (computador)
   ========================================================================== */
(function (global) {
  'use strict';
  const CKL = global.CKL;
  const { ui, config: cfg } = CKL;
  const { html, icone } = ui;
  const PERFIS = cfg.PERFIS;
  let desmontar = null;

  const raiz = () => document.getElementById('app');

  function trocar(montar) {
    if (desmontar) { try { desmontar(); } catch (e) { console.error(e); } desmontar = null; }
    const r = raiz();
    r.innerHTML = '';
    global.scrollTo(0, 0);
    desmontar = montar(r) || null;
  }

  function sair() {
    CKL.auth.sair();
    try { if (global.location.hash) global.location.hash = ''; } catch (e) { /* endereço não disponível */ }
    rotear();
  }

  /* <body data-entrada="app"> → index.html (celular) · "painel" → painel.html (computador) */
  const entrada = () => document.body.getAttribute('data-entrada') || '';
  const ENDERECO = { app: 'index.html', painel: 'painel.html' };

  function irPara(destino, modo) {
    CKL.auth.definirModo(modo);
    if (entrada() && entrada() !== destino) global.location.href = ENDERECO[destino];
    else rotear();
  }

  function rotear() {
    if (!CKL.auth.usuario()) {
      document.body.dataset.interface = 'acesso';
      trocar((r) => CKL.telas.login.montar(r, rotear, entrada()));
      return;
    }
    const painel = entrada() === 'painel' || (!entrada() && CKL.auth.modo() === PERFIS.ADM);
    if (painel && !CKL.auth.ehAdm()) {
      CKL.auth.sair();
      rotear();
      ui.aviso('O painel é exclusivo do administrador. Use o aplicativo do celular.', 'erro');
      return;
    }
    if (painel) {
      CKL.auth.definirModo(PERFIS.ADM);
      document.body.dataset.interface = 'painel';
      trocar((r) => CKL.telas.adm.estrutura.montar(r, { aoSair: sair, aoAbrirOperador: () => irPara('app', PERFIS.OPERADOR) }));
    } else {
      if (entrada() === 'app') CKL.auth.definirModo(PERFIS.OPERADOR);
      document.body.dataset.interface = 'operador';
      trocar((r) => CKL.telas.operador.montar(r, { aoSair: sair, aoIrParaPainel: () => irPara('painel', PERFIS.ADM) }));
    }
  }

  CKL.eventos.ouvir('sessao:encerrada', (d) => {
    if (!CKL.auth.usuario()) return;
    CKL.auth.sair();
    rotear();
    ui.aviso((d && d.motivo) || 'Sua sessão foi encerrada. Entre novamente.', 'erro', 8000);
  });

  function erroFatal(e) {
    console.error(e);
    raiz().innerHTML = html`
      <main class="erro-fatal">
        <span class="vazio-icone">${icone('banco', 30)}</span>
        <h1>Não foi possível abrir o armazenamento deste navegador</h1>
        <p>O sistema guarda os checklists e as fotografias no próprio aparelho. Isso costuma falhar em janela anônima ou quando o armazenamento de sites está bloqueado.</p>
        <p class="texto-menor">${(e && e.message) || 'Erro desconhecido'}</p>
        <button type="button" class="btn btn-primario" id="erro-tentar">Tentar novamente</button>
      </main>`;
    raiz().querySelector('#erro-tentar').addEventListener('click', () => CKL.app.iniciar());
  }

  function pedirArmazenamentoPersistente() {
    try {
      if (global.navigator.storage && global.navigator.storage.persist) global.navigator.storage.persist().catch(() => {});
    } catch (e) { /* recurso opcional */ }
  }

  function registrarServiceWorker() {
    if (!('serviceWorker' in global.navigator) || !/^https?:$/.test(global.location.protocol) || global.claude) return;
    global.navigator.serviceWorker.register('./sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const novo = reg.installing;
        if (!novo) return;
        novo.addEventListener('statechange', () => {
          if (novo.state === 'installed' && global.navigator.serviceWorker.controller) {
            ui.aviso('Nova versão do sistema baixada. Feche e abra novamente para atualizar.', 'info', 8000);
          }
        });
      });
    }).catch((e) => console.warn('[PWA] service worker não registrado:', e && e.message));
  }

  CKL.app = {
    rotear: rotear,
    iniciar() {
      return CKL.repo.iniciar()
        .then(() => Promise.all([CKL.usuarios.semear(), CKL.modelos.semear()]))
        .then(() => CKL.auth.restaurar())
        .then(() => {
          rotear();
          pedirArmazenamentoPersistente();
        })
        .catch(erroFatal);
    }
  };

  function ligar() {
    CKL.sincronizacao.iniciar();
    registrarServiceWorker();
    CKL.app.iniciar();
  }
  if (document.getElementById('app')) ligar();
  else document.addEventListener('DOMContentLoaded', ligar);
})(window);
