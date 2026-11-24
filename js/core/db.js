/* ==========================================================================
   Acesso ao IndexedDB (banco local do aparelho)
   Somente este arquivo e o repositório local conhecem o IndexedDB.
   ========================================================================== */
(function (global) {
  'use strict';
  var CKL = global.CKL;
  var cfg = CKL.config.BANCO;
  var promessa = null;

  /* Para evoluir o esquema, aumente BANCO.VERSAO e acrescente um bloco
     "if (versaoAnterior < N)" — nunca altere blocos antigos. */
  function migrar(db, versaoAnterior) {
    function criar(nome, opcoes, indices) {
      var s = db.createObjectStore(nome, opcoes);
      (indices || []).forEach(function (i) { s.createIndex(i[0], i[1], i[2] || {}); });
    }
    if (versaoAnterior < 1) {
      criar('usuarios', { keyPath: 'id' }, [['login', 'login', { unique: true }]]);
      // modelo vigente de cada checklist (área, identificação, itens)
      criar('modelos', { keyPath: 'id' }, [['area', 'area']]);
      // cópia congelada de cada versão de modelo ("<id>@<versão>")
      criar('modelos_versoes', { keyPath: 'chave' }, [['modeloId', 'modeloId']]);
      // checklists preenchidos (em andamento e concluídos)
      criar('execucoes', { keyPath: 'id' }, [
        ['modeloId', 'modeloId'], ['responsavelId', 'responsavelId'], ['status', 'status'], ['iniciadoEm', 'iniciadoEm']
      ]);
      criar('fotos', { keyPath: 'id' }, [['execucaoId', 'execucaoId']]);
      // não conformidades (uma por item NC) e seus planos de ação
      criar('nao_conformidades', { keyPath: 'id' }, [['execucaoId', 'execucaoId'], ['situacao', 'situacao']]);
      criar('historico', { keyPath: 'id' }, [['entidadeChave', 'entidadeChave'], ['dataHora', 'dataHora']]);
      // um item por checklist a enviar ao servidor (sempre o estado mais recente)
      criar('fila_sincronizacao', { keyPath: 'id' }, [['situacao', 'situacao'], ['execucaoId', 'execucaoId', { unique: true }]]);
    }
    if (versaoAnterior < 2) {
      // cadastro de cultivares (cultivar anterior / próxima cultivar)
      criar('cultivares', { keyPath: 'id' }, [['nome', 'nome']]);
    }
  }

  function abrir() {
    if (promessa) return promessa;
    promessa = new Promise(function (resolve, reject) {
      if (!global.indexedDB) { reject(new Error('Este navegador não oferece armazenamento local (IndexedDB).')); return; }
      var req;
      try { req = global.indexedDB.open(cfg.NOME, cfg.VERSAO); } catch (e) { reject(e); return; }
      req.onupgradeneeded = function (ev) { migrar(req.result, ev.oldVersion, req.transaction); };
      req.onsuccess = function () {
        var db = req.result;
        db.onversionchange = function () { db.close(); promessa = null; };
        resolve(db);
      };
      req.onerror = function () { reject(req.error || new Error('Não foi possível abrir o banco local.')); };
      req.onblocked = function () { reject(new Error('O banco local está em uso por outra aba. Feche as outras abas do sistema e tente de novo.')); };
    });
    promessa.catch(function () { promessa = null; });
    return promessa;
  }

  /** Executa fn(store) dentro de uma transação e resolve quando ela é concluída. */
  function transacao(colecoes, modo, fn) {
    return abrir().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx, resultado;
        try { tx = db.transaction(colecoes, modo); } catch (e) { reject(e); return; }
        tx.oncomplete = function () { resolve(resultado); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error('Operação cancelada pelo banco local.')); };
        try {
          resultado = fn(function (nome) { return tx.objectStore(nome); }, tx);
        } catch (e) {
          try { tx.abort(); } catch (_) { /* já encerrada */ }
          reject(e);
        }
      });
    });
  }

  /** Uma leitura simples: fn(store) devolve um IDBRequest. */
  function ler(colecao, fn) {
    var req;
    return transacao([colecao], 'readonly', function (store) { req = fn(store(colecao)); })
      .then(function () { return req.result; });
  }

  CKL.db = { abrir: abrir, transacao: transacao, ler: ler };
})(window);
