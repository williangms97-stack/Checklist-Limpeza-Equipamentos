param([string]$scratch, [string]$saida)
# Gera js/dados/modelos-originais.js a partir do texto extraído das planilhas (dump2.ps1)
$ErrorActionPreference = 'Stop'
function Limpar([string]$s) { return (($s -replace '\s+', ' ').Trim()) }
function Celula($linhas, $ref) {
  foreach ($l in $linhas) {
    $m = [regex]::Match($l, '\[' + $ref + '\] (.*?)( \| \[|$)')
    if ($m.Success) { return $m.Groups[1].Value }
  }
  return $null
}
$correcoes = @{
  'Caixa Mesa Densimétrica 1 - 2 / 316' = 'Caixa Mesa Densimétrica 1 - 2 - 316'
  'Caixa Mesa Densimétrica 3 - 4 / - 317' = 'Caixa Mesa Densimétrica 3 - 4 - 317'
}
$modelos = @()
foreach ($arq in @(@{f='ubs'; area='UBS'; col='N'; arquivo='CKL UBS - Limpeza de equipamentos - UBS.xlsx'}, @{f='sec'; area='Secador'; col='M'; arquivo='CKL Secador - Limpeza de equipamentos - Secador.xlsx'})) {
  $todas = Get-Content (Join-Path $scratch ($arq.f + '.txt')) -Encoding UTF8
  $blocos = @(); $atual = $null
  foreach ($l in $todas) {
    if ($l -match 'SHEET: (.+?)  \(') { $atual = @{ nome = $Matches[1]; linhas = New-Object System.Collections.ArrayList }; $blocos += $atual; continue }
    if ($atual -and $l -notmatch '^MERGES|^NAME') { [void]$atual.linhas.Add($l) }
  }
  foreach ($b in $blocos) {
    if ($b.nome -eq 'Verso') { continue }
    $Ls = $b.linhas; $c = $arq.col
    $itens = @(); $secao = $null; $dentro = $false; $nota = $null; $termo = $null; $obs = $null; $orient = $null
    foreach ($l in $Ls) {
      if ($l -match '^\[F16\]') { $dentro = $true; continue }
      if ($l -match '^\[A9\] (.*)$') { $orient = $Matches[1] }
      if ($l -match '^\[A\d+\] (O campo "Reavaliação".*?) \| \[L\d+\]') { $nota = Limpar $Matches[1]; $dentro = $false; continue }
      if ($l -match '^\[A\d+\] (O setor de Qualidade.*)$') { $termo = Limpar $Matches[1] }
      if ($l -match '^\[A\d+\] (Obs\S*)\s*$' -and -not $obs) { $obs = Limpar $Matches[1] }
      if ($dentro -and $l -match '^\[A(\d+)\] (.*?)( \| |$)') {
        $txt = Limpar $Matches[2]
        if ($txt -eq 'EMBEGAMENTO') { $secao = $txt; continue }
        if ($correcoes.ContainsKey($txt)) { $txt = $correcoes[$txt] }
        $itens += [ordered]@{ texto = $txt; secao = $secao; linha = [int]$Matches[1] }
      }
    }
    $num = ($b.nome -replace '\D', '')
    $id = if ($arq.area -eq 'UBS') { 'ubs-' + $num } elseif ($b.nome -match 'Básica') { 'secador-basica-' + $num } else { 'secador-' + $num }
    $serial = [double](Celula $Ls ($c + '7'))
    $aprov = ([datetime]'1899-12-30').AddDays($serial).ToString('yyyy-MM-dd')
    $i = 0
    $modelos += [ordered]@{
      id = $id; area = $arq.area; nome = $b.nome
      titulo = Limpar (Celula $Ls 'D4')
      identificacao = Limpar (Celula $Ls ($c + '1'))
      versaoDocumento = Limpar (Celula $Ls ($c + '2'))
      pagina = Limpar (Celula $Ls ($c + '3'))
      elaboradoPor = Limpar (Celula $Ls ($c + '4'))
      revisadoPor = Limpar (Celula $Ls ($c + '5'))
      aprovadoPor = Limpar (Celula $Ls ($c + '6'))
      aprovadoEm = $aprov
      cabecalho = Limpar (Celula $Ls 'D1')
      orientacao = ($orient -split ' / ' | ForEach-Object { Limpar $_ })
      notaReavaliacao = $nota
      termoConclusao = $termo
      rotuloObservacoes = $obs
      origem = [ordered]@{ arquivo = $arq.arquivo; aba = $b.nome }
      itens = @($itens | ForEach-Object { $i++; [ordered]@{ id = ($id + '-i' + $i.ToString('00')); ordem = $i; texto = $_.texto; secao = $_.secao; linhaOriginal = $_.linha; ativo = $true } })
    }
  }
}
$json = $modelos | ConvertTo-Json -Depth 8
$cab = @"
/* ==========================================================================
   Os 16 checklists originais de limpeza de equipamentos (gerado automaticamente)
   --------------------------------------------------------------------------
   Fonte: planilhas "CKL UBS - Limpeza de equipamentos - UBS.xlsx" e
   "CKL Secador - Limpeza de equipamentos - Secador.xlsx" (texto visível de cada aba).
   Usado só para criar os modelos na primeira vez. Depois disso, os modelos são
   mantidos pelo administrador no painel (cada alteração vira uma nova versão).
   Não edite à mão: a fidelidade ao documento é conferida item por item.
   ========================================================================== */
(function (global) {
  'use strict';
  var CKL = global.CKL = global.CKL || {};
  CKL.modelosOriginais =
"@
$rod = @"
;
})(window);
"@
[System.IO.File]::WriteAllText($saida, $cab + $json + $rod, (New-Object System.Text.UTF8Encoding($false)))
"modelos: $($modelos.Count); itens: $(($modelos | ForEach-Object { $_.itens.Count } | Measure-Object -Sum).Sum)"
