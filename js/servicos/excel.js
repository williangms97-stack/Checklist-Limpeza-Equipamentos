/* ==========================================================================
   Exportação para Excel (SheetJS, carregado sob demanda)
   Três abas: Checklists (um por linha), Itens (um por item avaliado) e
   Não conformidades (com o plano de ação).
   ========================================================================== */
(function (global) {
  'use strict';
  var CKL = global.CKL;
  var util = CKL.util, cfg = CKL.config;

  function dh(iso) { return iso ? util.fmtDataHora(iso) : ''; }

  function linhasChecklists(lista) {
    return lista.map(function (e) {
      var r = e.resultado || CKL.execucoes.resultado(e);
      return {
        'Protocolo': e.protocolo, 'Área': e.area, 'Checklist': e.nome, 'Identificação': e.identificacao,
        'Versão do documento': e.modelo && e.modelo.versaoDocumento, 'Versão do modelo': e.versaoModelo,
        'Data': util.fmtData(e.dataExecucao), 'Início': dh(e.iniciadoEm), 'Conclusão': dh(e.concluidoEm),
        'Responsável pela vistoria': e.responsavelNome, 'Operador do local': e.operadorLocal && e.operadorLocal.nome,
        'Assinado na tela': e.operadorLocal && e.operadorLocal.assinatura ? 'Sim' : 'Não',
        'Cultivar anterior': e.cultivarAnterior, 'Próxima cultivar': e.proximaCultivar,
        'Status': cfg.ROTULO_STATUS[e.status], 'Termo (UBS)': e.termo ? cfg.ROTULO_TERMO[e.termo] : '',
        'Itens': r.total, 'Avaliados': r.avaliados, 'C': r.conformes, 'NC': r.naoConformes, 'Não solicitados': r.naoSolicitados,
        'Liberados na reavaliação': r.liberadosReavaliacao, 'Não liberados': r.naoLiberados,
        'Observações': e.observacoes, 'Corrigido pelo administrador': e.correcoes && e.correcoes.length ? 'Sim' : 'Não',
        'Envio': cfg.ROTULO_SITUACAO_ENVIO[CKL.sincronizacao.situacaoVisivel(e.situacaoEnvio)]
      };
    });
  }

  function linhasItens(lista) {
    var out = [];
    lista.forEach(function (e) {
      CKL.execucoes.itens(e).forEach(function (i) {
        var r = e.respostas[i.id] || {}, reav = r.reavaliacoes || [];
        var linha = {
          'Protocolo': e.protocolo, 'Área': e.area, 'Checklist': e.nome, 'Data': util.fmtData(e.dataExecucao),
          'Nº': i.ordem, 'Seção': i.secao || '', 'Item': i.texto,
          'Avaliação': r.avaliacao ? cfg.ROTULO_AVALIACAO[r.avaliacao] : 'Não avaliado', 'Data/Hora': dh(r.em)
        };
        for (var k = 0; k < cfg.MAX_REAVALIACOES; k++) {
          linha[(k + 1) + 'ª reavaliação'] = reav[k] ? reav[k].resultado + ' · ' + dh(reav[k].em) : '';
        }
        var fin = CKL.execucoes.situacaoFinal(r);
        linha['Situação final'] = fin ? cfg.ROTULO_AVALIACAO[fin] : '';
        linha['Descrição da NC'] = r.descricao || '';
        linha['Observação'] = r.observacao || '';
        linha['Fotos'] = (r.fotos || []).length;
        out.push(linha);
      });
    });
    return out;
  }

  function linhasNc(ncs) {
    return ncs.map(function (n) {
      return {
        'Protocolo': n.protocolo, 'Área': n.area, 'Checklist': n.checklistNome, 'Data do checklist': util.fmtData(n.dataExecucao),
        'Nº do item': n.itemOrdem, 'Equipamento / item': n.itemTexto, 'Descrição da NC': n.descricao, 'Observação': n.observacao,
        'Registrada em': dh(n.registradaEm), 'Registrada por': n.registradaPorNome,
        'Reavaliações': (n.reavaliacoes || []).map(function (x) { return x.rodada + 'ª ' + x.resultado; }).join(', '),
        'Liberado na reavaliação': n.liberadoNaRodada ? n.liberadoNaRodada + 'ª' : 'Não',
        'O que será feito?': n.plano && n.plano.oQue, 'Como?': n.plano && n.plano.como, 'Quem?': n.plano && n.plano.quem,
        'Data prevista de conclusão': n.plano && n.plano.dataPrevista ? util.fmtData(n.plano.dataPrevista) : '',
        'Situação': n.situacao === cfg.SITUACAO_NC.ENCERRADA ? 'Encerrada' : (CKL.naoConformidades.atrasada(n) ? 'Aberta (atrasada)' : 'Aberta'),
        'Encerrada em': n.encerramento ? dh(n.encerramento.em) : '', 'Encerrada por': n.encerramento ? n.encerramento.porNome : '',
        'Comentário do encerramento': n.encerramento ? n.encerramento.comentario : ''
      };
    });
  }

  function aba(XLSX, linhas, vazio) {
    var ws = XLSX.utils.json_to_sheet(linhas.length ? linhas : [{ ' ': vazio }]);
    if (linhas.length) {
      ws['!cols'] = Object.keys(linhas[0]).map(function (k) {
        var max = Math.max(k.length, ...linhas.slice(0, 300).map(function (l) { return String(l[k] === undefined || l[k] === null ? '' : l[k]).length; }));
        return { wch: Math.min(60, Math.max(8, max + 2)) };
      });
    }
    return ws;
  }

  CKL.excel = {
    /** Gera o arquivo com os checklists (já filtrados) e as não conformidades deles. */
    exportar: function (execucoes, ncs) {
      return util.exigirBiblioteca('planilha', function () { return !!global.XLSX; }).then(function () {
        var XLSX = global.XLSX, wb = XLSX.utils.book_new();
        var ids = {};
        execucoes.forEach(function (e) { ids[e.id] = true; });
        XLSX.utils.book_append_sheet(wb, aba(XLSX, linhasChecklists(execucoes), 'Nenhum checklist no filtro'), 'Checklists');
        XLSX.utils.book_append_sheet(wb, aba(XLSX, linhasItens(execucoes), 'Nenhum item'), 'Itens');
        XLSX.utils.book_append_sheet(wb, aba(XLSX, linhasNc((ncs || []).filter(function (n) { return ids[n.execucaoId]; })), 'Nenhuma não conformidade'), 'Não conformidades');
        var dados = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        return {
          blob: new Blob([dados], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
          nome: 'Checklists de limpeza ' + util.dataLocal() + '.xlsx'
        };
      });
    },

    /** Limpeza de veículos: uma aba para as conferências e outra para as autorizações (já filtradas). */
    exportarVeiculos: function (lista) {
      return util.exigirBiblioteca('planilha', function () { return !!global.XLSX; }).then(function () {
        var XLSX = global.XLSX, wb = XLSX.utils.book_new(), V = CKL.veiculos, RR = V.ROTULO_RESPOSTA;
        var Rc = V.formulario('conferencia').rotulos, Ra = V.formulario('autorizacao').rotulos;
        var ordem = lista.slice().sort(function (a, b) { return a.dataHora < b.dataHora ? -1 : 1; });
        function base(v) { return { 'Protocolo': v.protocolo }; }
        var conf = ordem.filter(function (v) { return v.tipo === 'conferencia'; }).map(function (v) {
          var l = base(v);
          l[Rc.dataHora] = dh(v.dataHora); l[Rc.turno] = V.ROTULO_TURNO[v.turno]; l[Rc.placa] = v.placa;
          l['Placa a conferir'] = v.placaConferir ? 'Sim' : ''; l[Rc.origem] = v.origem;
          l[Rc.identificacaoRetirada] = RR[v.identificacaoRetirada]; l[Rc.descarregadoCompleto] = RR[v.descarregadoCompleto];
          l[Rc.grupoPeso + ' — ' + Rc.fechouPeso] = RR[v.fechouPeso]; l[Rc.responsavel] = v.responsavelNome; l[Rc.observacao] = v.observacao;
          l['Fotos'] = (v.fotos || []).length; l['Correções'] = (v.correcoes || []).length;
          return l;
        });
        var aut = ordem.filter(function (v) { return v.tipo === 'autorizacao'; }).map(function (v) {
          var l = base(v);
          l[Ra.dataHora] = dh(v.dataHora); l[Ra.placa] = v.placa; l['Placa a conferir'] = v.placaConferir ? 'Sim' : '';
          l[Ra.motorista] = v.motorista; l[Ra.cultivarAnterior] = v.cultivarAnterior; l[Ra.motivo] = v.motivo;
          l['Motivo do cadastro'] = v.motivoDoCadastro ? 'Sim' : 'Não'; l['Responsável'] = v.responsavelNome;
          l[Ra.assinatura] = v.assinatura ? 'Assinado na tela em ' + dh(v.assinatura.em) : '';
          l['Fotos'] = (v.fotos || []).length; l['Correções'] = (v.correcoes || []).length;
          return l;
        });
        XLSX.utils.book_append_sheet(wb, aba(XLSX, conf, 'Nenhuma conferência no filtro'), 'Conferências');
        XLSX.utils.book_append_sheet(wb, aba(XLSX, aut, 'Nenhuma autorização no filtro'), 'Autorizações');
        var dados = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        return {
          blob: new Blob([dados], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
          nome: 'Limpeza de veiculos ' + util.dataLocal() + '.xlsx'
        };
      });
    }
  };
})(window);
