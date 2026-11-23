# =============================================================================
# Servidor local para abrir o sistema no computador (sem instalar nada)
# Uso:  clique com o botão direito → "Executar com o PowerShell"
#       ou, no PowerShell:  .\ferramentas\servidor-local.ps1
# Depois abra http://localhost:8080/ (aplicativo) ou http://localhost:8080/painel.html
# Para parar: feche a janela do PowerShell (ou Ctrl+C).
# =============================================================================
param([int]$Porta = 8080)
$raiz = Split-Path -Parent $PSScriptRoot
$tipos = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json'; '.webmanifest' = 'application/manifest+json'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'
  '.svg' = 'image/svg+xml'; '.woff2' = 'font/woff2'; '.ttf' = 'font/ttf'; '.txt' = 'text/plain; charset=utf-8'; '.md' = 'text/plain; charset=utf-8'
}
$ouvinte = New-Object System.Net.HttpListener
$ouvinte.Prefixes.Add("http://localhost:$Porta/")
$ouvinte.Start()
Write-Host "Checklist de Limpeza rodando em http://localhost:$Porta/  (painel: http://localhost:$Porta/painel.html)"
Write-Host "Pasta: $raiz"
try {
  while ($ouvinte.IsListening) {
    $ctx = $ouvinte.GetContext()
    $caminho = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if (-not $caminho) { $caminho = 'index.html' }
    $arquivo = [IO.Path]::GetFullPath((Join-Path $raiz $caminho))
    $resp = $ctx.Response
    if ($arquivo.StartsWith($raiz) -and (Test-Path $arquivo -PathType Leaf)) {
      $bytes = [IO.File]::ReadAllBytes($arquivo)
      $ext = [IO.Path]::GetExtension($arquivo).ToLower()
      $resp.ContentType = if ($tipos.ContainsKey($ext)) { $tipos[$ext] } else { 'application/octet-stream' }
      $resp.Headers.Add('Cache-Control', 'no-cache')
      $resp.ContentLength64 = $bytes.Length
      $resp.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $resp.StatusCode = 404
    }
    $resp.Close()
  }
} finally { $ouvinte.Stop() }
