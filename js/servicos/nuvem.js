/* ==========================================================================
   Ligação com o servidor central (Supabase)
   --------------------------------------------------------------------------
   Ativa somente quando URL e CHAVE_PUBLICA estão preenchidas em js/core/servidor.js.
   Sem isso, nada aqui roda e o sistema trabalha só com os dados do aparelho.

   Como funciona
   - O banco do aparelho (IndexedDB) continua sendo a fonte das telas: rápido e
     disponível sem internet.
   - Novidades do servidor são baixadas ao entrar, ao voltar a conexão e a cada minuto.
   - Checklist feito no celular: gravado no aparelho e enviado pela fila (fotos para o
     Storage + função ckl_enviar_execucao). Funciona sem internet; em andamento
     também é enviado, para o painel acompanhar.
   - Operações do administrador (modelos, correções, planos de ação, encerramentos):
     vão direto ao servidor (ckl_lote) e depois são aplicadas no aparelho.
   - Login pelo Supabase Auth; cadastro de usuários pela Edge Function ckl-usuarios.
   ========================================================================== */
(function (global) {
  'use strict';
  var CKL = global.CKL;
  var S = CKL.servidor || {};
  var util = CKL.util, cfg = CKL.config;
  var configurado = !!(S.URL && S.CHAVE_PUBLICA);

  CKL.nuvem = { ativa: false, configurado: configurado };
  if (!configurado) return;
  if (!global.supabase || !global.supabase.createClient) {
    console.error('[nuvem] biblioteca do Supabase não carregada (vendor/supabase.js)');
    return;
  }

  var Erro = function (m) { return CKL.auth.Erro(m); };
  var local = CKL.RepositorioLocal;
  var CHAVE_PERFIL = 'ckl.nuvem.perfil';
  var SO_LOCAL = ['filaSincronizacao', 'usuarios'];
  var LIMITE_LOTE = 600 * 1024;
  var PAGINA = 500;
  var SOBREPOSICAO_MS = 2 * 60 * 1000;

  var sb = global.supabase.createClient(S.URL, S.CHAVE_PUBLICA, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ckl.supabase.sessao' }
  });

  function online() { return global.navigator.onLine !== false; }
  function semConexao(e) {
    var m = (e && (e.message || e.msg)) || '';
    return !online() || /Failed to fetch|NetworkError|Load failed|network|fetch/i.test(m);
  }
  function erroDoServidor(e, padrao) {
    if (semConexao(e)) return Erro('Sem conexão com o servidor. Verifique a internet e tente novamente.');
    var m = (e && e.message) || '';
    if (/permission denied|JWT|not authorized|row-level security/i.test(m)) return Erro('Sem permissão no servidor. Entre novamente.');
    return Erro(m || padrao || 'O servidor recusou a operação.');
  }
  function rpc(nome, p) {
    return sb.rpc(nome, { p: p || {} }).then(function (r) {
      if (r.error) throw erroDoServidor(r.error);
      return r.data;
    }, function (e) { throw erroDoServidor(e); });
  }

  function lerPerfil() { try { return JSON.parse(global.localStorage.getItem(CHAVE_PERFIL) || 'null'); } catch (e) { return null; } }
  function gravarPerfil(p) {
    try { if (p) global.localStorage.setItem(CHAVE_PERFIL, JSON.stringify(p)); else global.localStorage.removeItem(CHAVE_PERFIL); } catch (e) { /* sem armazenamento */ }
  }
  function emailDe(login) {
    var l = CKL.auth.chaveLogin(login);
    return l.indexOf('@') >= 0 ? l : l + '@' + S.DOMINIO_LOGIN;
  }

  /* ======================================================================
     Acesso (Supabase Auth)
     ====================================================================== */
  var auth = CKL.auth;
  auth.entrar = function (login, senha, perfilEscolhido) {
    if (!CKL.auth.chaveLogin(login) || !senha) return Promise.reject(Erro('Informe o usuário e a senha.'));
    if (!online()) return Promise.reject(Erro('Sem conexão com a internet. Para entrar é preciso estar conectado; depois o aplicativo funciona sem internet.'));
    return sb.auth.signInWithPassword({ email: emailDe(login), password: String(senha) }).then(function (r) {
      if (r.error) {
        var m = r.error.message || '';
        if (/banned/i.test(m)) throw Erro('Este usuário está inativo. Procure o administrador.');
        if (/invalid login|invalid credentials|invalid_credentials/i.test(m) || r.error.status === 400) throw Erro('Usuário ou senha incorretos.');
        throw erroDoServidor(r.error);
      }
      return rpc('ckl_meu_perfil');
    }).then(function (p) {
      if (!p.ativo) throw Erro('Este usuário está inativo. Procure o administrador.');
      if (perfilEscolhido === cfg.PERFIS.ADM && p.perfil !== cfg.PERFIS.ADM) {
        var e = Erro('Este usuário não tem perfil de Administrador.');
        e.codigo = 'SEM_PERFIL_ADM';
        throw e;
      }
      var anterior = lerPerfil();
      if (anterior && anterior.id !== p.id) limparCursores();
      gravarPerfil(p);
      var u = auth.assumir(p, perfilEscolhido);
      sincronia.iniciar();
      return u;
    }).catch(function (e) {
      sb.auth.signOut({ scope: 'local' }).catch(function () {});
      throw e;
    });
  };

  auth.restaurar = function () {
    var cache = lerPerfil(), sessao = auth.sessaoGravada();
    if (!cache || !sessao || sessao.usuarioId !== cache.id) return Promise.resolve(null);
    return sb.auth.getSession().catch(function () { return { data: { session: null } }; }).then(function (r) {
      var s = r && r.data && r.data.session;
      if (!s && online()) { gravarPerfil(null); auth.sair(); return null; }
      if (s && s.user && s.user.id !== cache.id) { gravarPerfil(null); auth.sair(); return null; }
      var u = auth.assumir(cache, sessao.modo);
      sincronia.iniciar();
      return u;
    });
  };

  var sairLocal = auth.sair;
  auth.sair = function () {
    sincronia.parar();
    gravarPerfil(null);
    sb.auth.signOut({ scope: 'local' }).catch(function () {});
    sairLocal();
  };

  function conferirPerfil() {
    return rpc('ckl_meu_perfil').then(function (p) {
      var atual = auth.usuario();
      if (!atual || p.id !== atual.id) return;
      if (!p.ativo) { CKL.eventos.emitir('sessao:encerrada', { motivo: 'Seu usuário foi desativado pelo administrador.' }); return; }
      gravarPerfil(p);
      if (p.nome !== atual.nome || p.perfil !== atual.perfil || p.usuario !== atual.usuario) auth.assumir(p, auth.modo());
    });
  }

  /* ======================================================================
     Usuários (Edge Function ckl-usuarios)
     ====================================================================== */
  function chamarFuncao(corpo) {
    auth.exigirAdm();
    corpo.dominio = S.DOMINIO_LOGIN;
    return sb.functions.invoke(S.FUNCAO_USUARIOS, { body: corpo }).then(function (r) {
      if (!r.error) {
        if (r.data && r.data.erro) throw Erro(r.data.erro);
        return r.data && r.data.usuario;
      }
      var ctx = r.error.context;
      var leitura = ctx && typeof ctx.json === 'function' ? ctx.json().catch(function () { return null; }) : Promise.resolve(null);
      return leitura.then(function (j) {
        if (j && j.erro) throw Erro(j.erro);
        if (semConexao(r.error)) throw Erro('Sem conexão com o servidor. Verifique a internet e tente novamente.');
        throw Erro('Não foi possível falar com a função "' + S.FUNCAO_USUARIOS + '" do Supabase. Confira se ela foi publicada.');
      });
    }, function (e) { throw erroDoServidor(e); }).then(function (u) {
      CKL.eventos.emitir('usuarios:alterado');
      if (u && auth.usuario() && u.id === auth.usuario().id) { gravarPerfil(u); auth.assumir(u, auth.modo()); }
      return u;
    });
  }
  var usuarios = CKL.usuarios;
  usuarios.listar = function () {
    return rpc('ckl_listar_perfis').then(function (l) {
      return (l || []).map(function (p) { return Object.assign({ senhaPadrao: false }, p); });
    });
  };
  usuarios.criar = function (d) { return chamarFuncao({ acao: 'criar', nome: d.nome, usuario: d.usuario, senha: d.senha, perfil: d.perfil, ativo: d.ativo !== false }); };
  usuarios.editar = function (id, d) { return chamarFuncao({ acao: 'editar', id: id, nome: d.nome, usuario: d.usuario, perfil: d.perfil }); };
  usuarios.redefinirSenha = function (id, senha) { return chamarFuncao({ acao: 'senha', id: id, senha: senha }); };
  usuarios.definirSituacao = function (id, ativo) { return chamarFuncao({ acao: 'situacao', id: id, ativo: ativo }); };
  usuarios.semear = function () { return Promise.resolve(); };
  usuarios.acessosIniciaisAtivos = function () { return Promise.resolve([]); };
  CKL.modelos.semear = function () { return Promise.resolve(false); };   // modelos vêm do servidor
  CKL.cultivares.semear = function () { return Promise.resolve(false); };   // cultivares vêm do servidor
  CKL.motivos.semear = function () { return Promise.resolve(false); };

  /* ======================================================================
     Repositório: leitura no aparelho, gravação do ADM no servidor
     ====================================================================== */
  var ORDEM_ENVIO = { modelos: 0, cultivares: 0, motivos: 0, documentosVeiculo: 0, modelosVersoes: 1, execucoes: 1, veiculos: 1, naoConformidades: 2, fotos: 2, historico: 3 };

  function paraServidor(op) {
    var o = { colecao: op.colecao, tipo: op.tipo };
    if (op.tipo === 'remover') o.chave = op.chave;
    else {
      o.valor = Object.assign({}, op.valor);
      if (op.colecao === 'fotos') delete o.valor.dados;
      if (op.colecao === 'execucoes' || op.colecao === 'veiculos') { delete o.valor.situacaoEnvio; delete o.valor.erroEnvio; }
    }
    return o;
  }

  function enviarLote(ops) {
    if (!online()) return Promise.reject(Erro('Sem conexão com o servidor. Esta operação do administrador precisa de internet.'));
    var lista = ops.map(paraServidor).map(function (o, i) { return { o: o, i: i, t: JSON.stringify(o).length }; })
      .sort(function (a, b) { return ((ORDEM_ENVIO[a.o.colecao] || 0) - (ORDEM_ENVIO[b.o.colecao] || 0)) || (a.i - b.i); });
    var partes = [], atual = [], tam = 0;
    lista.forEach(function (x) {
      if (atual.length && tam + x.t > LIMITE_LOTE) { partes.push(atual); atual = []; tam = 0; }
      atual.push(x.o); tam += x.t;
    });
    if (atual.length) partes.push(atual);
    return partes.reduce(function (cadeia, parte) {
      return cadeia.then(function () { return rpc('ckl_lote', { operacoes: parte }); });
    }, Promise.resolve());
  }

  var repo = Object.create(local);
  repo.tipo = 'supabase';
  repo.local = local;
  repo.loteLocal = function (ops) { return local.lote(ops); };   // preenchimento do checklist: vai pela fila
  repo.lote = function (ops) {
    if (!ops || !ops.length) return Promise.resolve();
    var doServidor = ops.filter(function (o) { return SO_LOCAL.indexOf(o.colecao) < 0; });
    if (!doServidor.length) return local.lote(ops);
    return enviarLote(doServidor).then(function () {
      return local.lote(ops.map(function (o) {
        if ((o.colecao === 'execucoes' || o.colecao === 'veiculos') && o.valor) {
          return { colecao: o.colecao, tipo: o.tipo, valor: Object.assign({}, o.valor, { situacaoEnvio: cfg.SITUACAO_ENVIO.SINCRONIZADO, erroEnvio: null }) };
        }
        return o;
      }));
    });
  };

  function baixarFoto(f) {
    if (f.dados || !f.caminho) return Promise.resolve(f);
    if (!online()) return Promise.resolve(f);   // a tela mostra a miniatura
    return sb.storage.from(S.BUCKET_FOTOS).download(f.caminho).then(function (r) {
      if (r.error) throw erroDoServidor(r.error, 'Não foi possível baixar a fotografia.');
      return r.data.arrayBuffer();
    }).then(function (buf) {
      var copia = Object.assign({}, f, { dados: buf });
      return local.fotos.salvar(copia).then(function () { return copia; });
    }).catch(function () { return f; });
  }
  repo.fotos = Object.assign({}, local.fotos, {
    porIndice: function (indice, valor) {
      return local.fotos.porIndice(indice, valor).then(function (l) { return Promise.all(l.map(baixarFoto)); });
    }
  });
  CKL.repo = repo;

  /* ======================================================================
     Sincronização (baixar novidades)
     ====================================================================== */
  var COLECOES_TODOS = ['modelos', 'execucoes', 'fotos', 'naoConformidades', 'cultivares', 'veiculos', 'motivos', 'documentosVeiculo'];
  // coleções criadas por SQL posterior ao 01: se o servidor ainda não tem, o resto da sincronia continua
  var COLECOES_OPCIONAIS = ['cultivares', 'veiculos', 'motivos', 'documentosVeiculo'];
  var COLECOES_ADM = ['modelosVersoes', 'historico'];
  var EVENTO = { modelos: 'modelos:alterado', modelosVersoes: 'modelos:alterado', execucoes: 'execucoes:alterado', fotos: 'execucoes:alterado',
    naoConformidades: 'nc:alterado', historico: 'execucoes:alterado', cultivares: 'cultivares:alterado', veiculos: 'veiculos:alterado', motivos: 'motivos:alterado',
    documentosVeiculo: 'documentosVeiculo:alterado' };

  function chaveCursor(colecao) { return 'ckl.cursor.' + (auth.ehAdm() ? 'ADM' : 'OP') + '.' + colecao; }
  function lerCursor(c) { try { return JSON.parse(global.localStorage.getItem(chaveCursor(c)) || 'null'); } catch (e) { return null; } }
  function gravarCursor(c, v) { try { global.localStorage.setItem(chaveCursor(c), JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } }
  function limparCursores() {
    try { Object.keys(global.localStorage).forEach(function (k) { if (k.indexOf('ckl.cursor.') === 0) global.localStorage.removeItem(k); }); } catch (e) { /* sem armazenamento */ }
  }

  function aplicar(colecao, linhas) {
    if (!linhas.length) return Promise.resolve();
    var vivas = linhas.filter(function (l) { return !l.removido; }).map(function (l) { return l.dados; });
    var preparo;
    if (colecao === 'fotos') {
      preparo = Promise.all(vivas.map(function (f) {
        return local.fotos.obter(f.id).then(function (atual) { return Object.assign({}, f, { dados: atual && atual.dados ? atual.dados : null }); });
      }));
    } else if (colecao === 'execucoes' || colecao === 'veiculos') {
      // checklist com alteração deste aparelho ainda não enviada: vale a versão do aparelho
      preparo = Promise.all(vivas.map(function (e) {
        return local.filaSincronizacao.umPorIndice('execucaoId', e.id).then(function (item) {
          if (item && item.situacao !== cfg.SITUACAO_ENVIO.SINCRONIZADO) return null;
          return Object.assign({}, e, { situacaoEnvio: cfg.SITUACAO_ENVIO.SINCRONIZADO, erroEnvio: null });
        });
      })).then(function (l) { return l.filter(Boolean); });
    } else {
      preparo = Promise.resolve(vivas);
    }
    return preparo.then(function (docs) {
      return local.lote(docs.map(function (d) { return { colecao: colecao, tipo: 'salvar', valor: d }; }));
    });
  }

  function puxarColecao(colecao) {
    // aparelho sem nada guardado desta coleção: baixa tudo de novo, mesmo que haja marcador antigo
    return local[colecao].contar().catch(function () { return 1; }).then(function (n) { return puxarDesde(colecao, n ? lerCursor(colecao) : null); });
  }

  function puxarDesde(colecao, cursor) {
    var desde = cursor ? new Date(new Date(cursor.desde).getTime() - SOBREPOSICAO_MS).toISOString() : null;
    var depoisId = '', recebidas = 0, ultimo = cursor;
    function pagina() {
      return rpc('ckl_puxar', { colecao: colecao, desde: desde, depoisId: depoisId, limite: PAGINA }).then(function (r) {
        var linhas = (r && r.linhas) || [];
        return aplicar(colecao, linhas).then(function () {
          recebidas += linhas.length;
          if (linhas.length) {
            var u = linhas[linhas.length - 1];
            desde = u.atualizadoEm; depoisId = u.id;
            if (!ultimo || u.atualizadoEm >= ultimo.desde) ultimo = { desde: u.atualizadoEm };
          }
          if (linhas.length === PAGINA) return pagina();
        });
      });
    }
    return pagina().then(function () { if (ultimo) gravarCursor(colecao, ultimo); return recebidas; });
  }

  var emAndamento = null, timer = null, ativa = false, ultimaSincronia = null, ultimaFalha = null;
  var sincronia = {
    puxar: function () {
      if (emAndamento) return emAndamento;
      if (!auth.usuario() || !online()) return Promise.resolve({ ok: false });
      var colecoes = COLECOES_TODOS.concat(auth.ehAdm() ? COLECOES_ADM : []);
      var avisados = {};
      emAndamento = colecoes.reduce(function (cadeia, c) {
        return cadeia.then(function () {
          return puxarColecao(c).then(function (n) {
            // avisa as telas logo que a coleção chega (uma falha depois não esconde o que já foi baixado)
            if (n && !avisados[EVENTO[c]]) { avisados[EVENTO[c]] = true; CKL.eventos.emitir(EVENTO[c], { origem: 'servidor' }); }
          }, function (e) {
            // servidor ainda sem os SQL 02/03 não pode parar o resto da sincronia
            if (COLECOES_OPCIONAIS.indexOf(c) >= 0) { console.warn('[sincronia] ' + c + ':', e && e.message); return; }
            throw e;
          });
        });
      }, Promise.resolve()).then(function () {
        ultimaSincronia = util.agora();
        ultimaFalha = null;
        emAndamento = null;
        CKL.eventos.emitir('sincronia:concluida', { quando: ultimaSincronia });
        return { ok: true };
      }).then(function (r) { emAndamento = null; return r; }, function (e) {
        emAndamento = null;
        console.warn('[sincronia]', e && e.message);
        ultimaFalha = { em: util.agora(), mensagem: (erroDoServidor(e, 'Falha ao baixar os dados do servidor.') || {}).message };
        CKL.eventos.emitir('sincronia:falha', { mensagem: ultimaFalha.mensagem });
        return { ok: false, erro: e };
      });
      CKL.eventos.emitir('sincronia:inicio');
      return emAndamento;
    },
    ciclo: function () {
      if (!auth.usuario() || !online()) return Promise.resolve();
      return CKL.sincronizacao.processar().catch(function (e) { console.warn('[fila]', e && e.message); })
        .then(function () { return sincronia.puxar(); })
        .then(function () { return conferirPerfil().catch(function () {}); });
    },
    iniciar: function () {
      if (ativa) { sincronia.ciclo(); return; }
      ativa = true;
      sincronia.ciclo();
      timer = setInterval(function () { if (document.visibilityState !== 'hidden') sincronia.ciclo(); }, Math.max(15, S.INTERVALO_SINCRONIA || 60) * 1000);
    },
    parar: function () { ativa = false; if (timer) clearInterval(timer); timer = null; },
    ultima: function () { return ultimaSincronia; },
    falha: function () { return ultimaFalha; },
    rodando: function () { return !!emAndamento; }
  };
  global.addEventListener('online', function () { if (ativa) sincronia.ciclo(); });
  document.addEventListener('visibilitychange', function () { if (ativa && document.visibilityState === 'visible') sincronia.ciclo(); });

  /* ======================================================================
     Envio dos checklists da fila
     ====================================================================== */
  CKL.sincronizacao.registrarAdaptador({
    podeEnviar: function (item, exec) {
      var u = auth.usuario();
      return !!u && exec.responsavelId === u.id;   // checklist de outro usuário neste aparelho espera ele entrar
    },
    enviarExecucao: function (exec, fotos, ncs) {
      var metas = [];
      var usadas = {};
      Object.keys(exec.respostas || {}).forEach(function (k) { (exec.respostas[k].fotos || []).forEach(function (id) { usadas[id] = true; }); });
      return fotos.filter(function (f) { return usadas[f.id]; }).reduce(function (cadeia, f) {
        return cadeia.then(function () {
          var caminho = f.caminho || ('execucoes/' + exec.id + '/' + f.id + '.jpg');
          var envio = f.dados && !f.caminho
            ? sb.storage.from(S.BUCKET_FOTOS).upload(caminho, f.dados, { upsert: true, contentType: f.tipo || 'image/jpeg' })
            : Promise.resolve({});
          return envio.then(function (r) {
            if (r && r.error) throw erroDoServidor(r.error, 'Falha ao enviar a fotografia.');
            var meta = Object.assign({}, f, { caminho: caminho });
            delete meta.dados;
            metas.push(meta);
            if (!f.caminho) return local.fotos.salvar(Object.assign({}, f, { caminho: caminho }));
          }, function (e) { throw erroDoServidor(e); });
        });
      }, Promise.resolve()).then(function () {
        return local.historico.porIndice('entidadeChave', 'execucao:' + exec.id);
      }).then(function (eventos) {
        var e = Object.assign({}, exec);
        delete e.situacaoEnvio; delete e.erroEnvio;
        return rpc('ckl_enviar_execucao', { execucao: e, fotos: metas, naoConformidades: ncs || [], eventos: eventos });
      }).then(function (r) {
        if (r && r.situacao === 'ja_concluido') throw Erro('Este checklist já tinha sido enviado por outro aparelho.');
      });
    },
    /* registro de veículo (conferência ou autorização): só vai depois de enviado; fotos no mesmo bucket */
    enviarVeiculo: function (v, fotos) {
      var metas = [], usadas = {};
      (v.fotos || []).forEach(function (id) { usadas[id] = true; });
      return fotos.filter(function (f) { return usadas[f.id]; }).reduce(function (cadeia, f) {
        return cadeia.then(function () {
          var caminho = f.caminho || ('execucoes/' + v.id + '/' + f.id + '.jpg');
          var envio = f.dados && !f.caminho
            ? sb.storage.from(S.BUCKET_FOTOS).upload(caminho, f.dados, { upsert: true, contentType: f.tipo || 'image/jpeg' })
            : Promise.resolve({});
          return envio.then(function (r) {
            if (r && r.error) throw erroDoServidor(r.error, 'Falha ao enviar a fotografia.');
            var meta = Object.assign({}, f, { caminho: caminho });
            delete meta.dados;
            metas.push(meta);
            if (!f.caminho) return local.fotos.salvar(Object.assign({}, f, { caminho: caminho }));
          }, function (e) { throw erroDoServidor(e); });
        });
      }, Promise.resolve()).then(function () {
        return local.historico.porIndice('entidadeChave', 'veiculo:' + v.id);
      }).then(function (eventos) {
        var x = Object.assign({}, v);
        delete x.situacaoEnvio; delete x.erroEnvio;
        return rpc('ckl_enviar_veiculo', { veiculo: x, fotos: metas, eventos: eventos }).catch(function (e) {
          if (/ckl_enviar_veiculo|function .* does not exist|Could not find the function/i.test((e && e.message) || '')) {
            throw Erro('O servidor ainda não recebe registros de veículos. O administrador precisa rodar o supabase/03_veiculos.sql.');
          }
          throw e;
        });
      });
    }
  });

  CKL.nuvem = { ativa: true, configurado: true, cliente: sb, sincronia: sincronia, rpc: rpc, online: online, url: S.URL };
})(window);
