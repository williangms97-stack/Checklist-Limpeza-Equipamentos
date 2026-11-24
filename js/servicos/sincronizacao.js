/* ==========================================================================
   Fila de envio ao servidor central
   --------------------------------------------------------------------------
   Cada checklist tem UM item na fila, que sempre aponta para o estado mais recente
   guardado no aparelho. Sem servidor configurado (js/core/servidor.js em branco)
   nada é enviado e nada é marcado como sincronizado: os checklists ficam "Só neste
   aparelho". Com Supabase, js/servicos/nuvem.js registra o adaptador de envio.
   ========================================================================== */
(function (global) {
  'use strict';
  var CKL = global.CKL;
  var util = CKL.util, cfg = CKL.config;
  var ENVIO = cfg.SITUACAO_ENVIO;
  // a fila é sempre do aparelho: com servidor central, CKL.repo.local é o banco local
  var repo = function () { return CKL.repo.local || CKL.repo; };
  var adaptador = null, emAndamento = null, agendado = null;

  var sinc = CKL.sincronizacao = {
    registrarAdaptador: function (a) { adaptador = a || null; },
    configurada: function () { return !!adaptador; },
    online: function () { return global.navigator.onLine !== false; },

    /** Situação de envio como deve aparecer na tela. */
    situacaoVisivel: function (s) { return !adaptador && s !== ENVIO.SINCRONIZADO ? ENVIO.LOCAL : s; },

    /** Operações que colocam (ou mantêm) o registro na fila, apontando para a versão atual.
        op: { colecao: 'execucoes' (padrão) ou 'veiculos', rotulo } */
    opsFila: function (doc, op) {
      op = op || {};
      return repo().filaSincronizacao.umPorIndice('execucaoId', doc.id).then(function (atual) {
        var item = Object.assign({}, atual || { id: util.uuid(), execucaoId: doc.id, criadoEm: util.agora(), tentativas: 0 }, {
          colecao: op.colecao || 'execucoes',
          rotulo: op.rotulo || (doc.nome + ' · ' + doc.protocolo), situacao: ENVIO.AGUARDANDO, versaoLocal: doc.alteradoEm, erro: null
        });
        return [{ colecao: 'filaSincronizacao', tipo: 'salvar', valor: item }];
      });
    },

    fila: function () {
      return repo().filaSincronizacao.listar().then(function (l) { return l.sort(function (a, b) { return a.criadoEm < b.criadoEm ? -1 : 1; }); });
    },

    resumo: function () {
      return sinc.fila().then(function (l) {
        var r = { aguardando: 0, sincronizado: 0, falha: 0, total: l.length };
        l.forEach(function (i) { r[i.situacao] = (r[i.situacao] || 0) + 1; });
        return r;
      });
    },

    /** Processa a fila logo depois das gravações em sequência (evita um envio por toque). */
    processarDepois: function () {
      if (!adaptador) return;
      clearTimeout(agendado);
      agendado = setTimeout(function () { sinc.processar().catch(function (e) { console.warn('[fila]', e && e.message); }); }, 2500);
    },

    /** Envia os checklists pendentes, um a um. Sem adaptador registrado, não faz nada. */
    processar: function () {
      if (!adaptador) return Promise.resolve({ configurada: false });
      if (!sinc.online()) return Promise.resolve({ configurada: true, online: false });
      if (emAndamento) return emAndamento;
      emAndamento = sinc.fila().then(function (itens) {
        var pendentes = itens.filter(function (i) { return i.situacao !== ENVIO.SINCRONIZADO; });
        var enviados = 0, falhas = 0;
        return pendentes.reduce(function (cadeia, item) {
          return cadeia.then(function () {
            var colecao = item.colecao || 'execucoes', ehVeiculo = colecao === 'veiculos';
            return Promise.all([repo()[colecao].obter(item.execucaoId), repo().fotos.porIndice('execucaoId', item.execucaoId),
              ehVeiculo ? [] : repo().naoConformidades.porIndice('execucaoId', item.execucaoId)]).then(function (r) {
              var exec = r[0];
              if (!exec) return repo().filaSincronizacao.remover(item.id);
              if (adaptador.podeEnviar && !adaptador.podeEnviar(item, exec)) return null;
              var versaoEnviada = exec.alteradoEm;
              return Promise.resolve().then(function () {
                return ehVeiculo ? adaptador.enviarVeiculo(exec, r[1], item) : adaptador.enviarExecucao(exec, r[1], r[2], item);
              }).then(function () {
                enviados++;
                return { ok: true };
              }, function (e) {
                falhas++;
                return { ok: false, erro: (e && e.message) || 'Falha no envio' };
              }).then(function (res) {
                // relê: se o checklist mudou durante o envio, continua aguardando para mandar a versão nova
                return Promise.all([repo()[colecao].obter(item.execucaoId), repo().filaSincronizacao.obter(item.id)]).then(function (x) {
                  var atual = x[0], it = x[1] || item;
                  if (!atual) return;
                  it.tentativas = (it.tentativas || 0) + 1;
                  it.ultimaTentativa = util.agora();
                  if (!res.ok) { it.situacao = ENVIO.FALHA; it.erro = res.erro; atual.situacaoEnvio = ENVIO.FALHA; atual.erroEnvio = res.erro; }
                  else if (atual.alteradoEm === versaoEnviada) { it.situacao = ENVIO.SINCRONIZADO; it.erro = null; atual.situacaoEnvio = ENVIO.SINCRONIZADO; atual.erroEnvio = null; }
                  else { it.situacao = ENVIO.AGUARDANDO; }
                  return repo().lote([{ colecao: 'filaSincronizacao', tipo: 'salvar', valor: it }, { colecao: colecao, tipo: 'salvar', valor: atual }]);
                });
              });
            });
          });
        }, Promise.resolve()).then(function () {
          if (enviados || falhas) { CKL.eventos.emitir('execucoes:alterado', { origem: 'fila' }); CKL.eventos.emitir('veiculos:alterado', { origem: 'fila' }); }
          return { configurada: true, online: true, enviados: enviados, falhas: falhas };
        });
      }).then(function (r) { emAndamento = null; return r; }, function (e) { emAndamento = null; throw e; });
      return emAndamento;
    },

    iniciar: function () {
      global.addEventListener('online', function () {
        CKL.eventos.emitir('conexao:alterada', { online: true });
        sinc.processar().catch(function (e) { console.error('[sincronização]', e); });
      });
      global.addEventListener('offline', function () { CKL.eventos.emitir('conexao:alterada', { online: false }); });
    }
  };
})(window);
