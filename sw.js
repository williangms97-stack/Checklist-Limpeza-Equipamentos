/* ==========================================================================
   Service worker — funcionamento sem internet (PWA)
   --------------------------------------------------------------------------
   Guarda os arquivos do sistema no aparelho na primeira visita. Depois disso o
   app abre mesmo sem conexão. Responde com a cópia guardada e, em segundo plano,
   busca a versão mais nova para a próxima abertura.
   Os DADOS (checklists, fotos) não passam por aqui: ficam no IndexedDB.

   Ao publicar uma nova versão, altere VERSAO (e CKL.config.VERSAO, mesmo número).
   ========================================================================== */
const VERSAO = 'ckl-dois-marcos-1.0.1';

const ARQUIVOS = [
  './',
  './index.html',
  './painel.html',
  './manifest.webmanifest',
  './css/fontes.css',
  './css/estilos.css',
  './css/checklist.css',
  './js/core/config.js',
  './js/core/servidor.js',
  './js/core/util.js',
  './js/core/recursos.js',
  './js/core/db.js',
  './js/core/repositorio.js',
  './js/dados/modelos-originais.js',
  './js/servicos/historico.js',
  './js/servicos/auth.js',
  './js/servicos/usuarios.js',
  './js/servicos/modelos.js',
  './js/servicos/sincronizacao.js',
  './js/servicos/execucoes.js',
  './js/servicos/nao-conformidades.js',
  './js/servicos/imagem.js',
  './js/servicos/arquivos.js',
  './js/servicos/pdf.js',
  './js/servicos/excel.js',
  './vendor/supabase.js',
  './js/servicos/nuvem.js',
  './js/ui/base.js',
  './js/ui/graficos.js',
  './js/ui/assinatura.js',
  './js/ui/login.js',
  './js/ui/operador.js',
  './js/ui/adm/comum.js',
  './js/ui/adm/estrutura.js',
  './js/ui/adm/painel.js',
  './js/ui/adm/checklists.js',
  './js/ui/adm/nc.js',
  './js/ui/adm/modelos.js',
  './js/ui/adm/usuarios.js',
  './js/ui/adm/historico.js',
  './js/app.js',
  './js/servicos/pdf-fontes.js',
  './vendor/xlsx.full.min.js',
  './vendor/jspdf.umd.min.js',
  './assets/logo-dois-marcos.png',
  './assets/icones/favicon-48.png',
  './assets/icones/icone-192.png',
  './assets/icones/icone-512.png',
  './assets/icones/icone-maskable-512.png',
  './assets/icones/apple-touch-icon.png',
  './assets/fontes/barlow-latin-400-normal.woff2',
  './assets/fontes/barlow-latin-500-normal.woff2',
  './assets/fontes/barlow-latin-600-normal.woff2',
  './assets/fontes/barlow-condensed-latin-600-normal.woff2',
  './assets/fontes/barlow-condensed-latin-700-normal.woff2'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSAO).then((cache) => cache.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET' || new URL(pedido.url).origin !== self.location.origin) return;

  evento.respondWith(
    caches.open(VERSAO).then((cache) =>
      cache.match(pedido, { ignoreSearch: true }).then((guardada) => {
        const daRede = fetch(pedido).then((resposta) => {
          if (resposta && resposta.ok) cache.put(pedido, resposta.clone());
          return resposta;
        });
        if (guardada) {
          daRede.catch(() => {});
          return guardada;
        }
        return daRede.catch(() => (pedido.mode === 'navigate' ? cache.match('./index.html') : Response.error()));
      })
    )
  );
});