<# 
.SYNOPSIS
    Teste automatizado do TGTmusic via agent-desktop (UIA/acessibilidade)
.DESCRIPTION
    Abre o app, busca uma música, tenta tocar, captura logs e screenshots.
    Requer: agent-desktop instalado (cargo install agent-desktop)
.NOTES
    Rode no PowerShell como usuário normal (não precisa Admin).
#>

param(
    [string]$AppPath = "C:\Users\lucia\OneDrive\Desktop\clsss\TGTmusic\src-tauri\target\release\tgtmusic.exe",
    [string]$SearchQuery = "The Weeknd Blinding Lights",
    [int]$TimeoutMs = 20000,
    [string]$OutputDir = "C:\Users\lucia\OneDrive\Desktop\clsss\TGTmusic\test-output"
)

# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────
function Log($msg) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $msg" -ForegroundColor Cyan }
function LogOk($msg) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ✅ $msg" -ForegroundColor Green }
function LogErr($msg) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ❌ $msg" -ForegroundColor Red }
function LogWarn($msg) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ⚠️ $msg" -ForegroundColor Yellow }

function RunAgentDesktop([string[]]$args) {
    Log "Executando: agent-desktop $($args -join ' ')"
    try {
        $result = & agent-desktop @args
        $exitCode = $LASTEXITCODE
        if ($exitCode -ne 0) {
            LogErr "Falhou (exit $exitCode): $result"
            return $null
        }
        return $result
    } catch {
        LogErr "Exceção: $_"
        return $null
    }
}

function GetRefFromJson($json) {
    if ($json -match '@s[^:]+:e\d+') { return $matches[0] }
    return $null
}

function SaveJson($json, $filename) {
    if ($json) {
        $path = Join-Path $OutputDir $filename
        $json | Out-File -FilePath $path -Encoding utf8
        LogOk "Salvo: $path"
    }
}

# ──────────────────────────────────────────────
# Setup
# ──────────────────────────────────────────────
if (-not (Test-Path $AppPath)) { LogErr "Executável não encontrado: $AppPath"; exit 1 }

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$logFile = Join-Path $OutputDir "test-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
Start-Transcript -Path $logFile -Force | Out-Null

Log "=== INÍCIO TESTE TGTmusic ==="
Log "App: $AppPath"
Log "Busca: $SearchQuery"
Log "Output: $OutputDir"

# ──────────────────────────────────────────────
# 1. Verifica agent-desktop
# ──────────────────────────────────────────────
$help = RunAgentDesktop @("--help")
if (-not $help) { LogErr "agent-desktop não encontrado. Instale: cargo install agent-desktop"; Stop-Transcript; exit 1 }
LogOk "agent-desktop OK"

# ──────────────────────────────────────────────
# 2. Inicia o app
# ──────────────────────────────────────────────
Log "Iniciando TGTmusic..."
$proc = Start-Process -FilePath $AppPath -PassThru -WindowStyle Normal
if (-not $proc) { LogErr "Falha ao iniciar processo"; Stop-Transcript; exit 1 }
LogOk "Processo iniciado (PID: $($proc.Id))"

# ──────────────────────────────────────────────
# 3. Espera janela aparecer
# ──────────────────────────────────────────────
Log "Aguardando janela 'TGTmusic' aparecer..."
$waitResult = RunAgentDesktop @("wait", "--app", "TGTmusic", "--timeout", [int]($TimeoutMs/1000))
if (-not $waitResult) { LogErr "Janela não apareceu em ${TimeoutMs}ms"; Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue; Stop-Transcript; exit 1 }
LogOk "Janela detectada"

# ──────────────────────────────────────────────
# 4. Snapshot inicial (observe)
# ──────────────────────────────────────────────
Log "Snapshot inicial da UI (observe)..."
$snap = RunAgentDesktop @("observe", "--app", "TGTmusic")
SaveJson $snap "snapshot-inicial.json"

# ──────────────────────────────────────────────
# 5. Encontra campo de busca
# ──────────────────────────────────────────────
Log "Procurando campo de busca (textbox/edit)..."
$selectors = @('text_field', 'textbox', 'edit', 'search_field', 'combobox')
$searchRef = $null
foreach ($sel in $selectors) {
    Log "Tentando seletor: $sel"
    $find = RunAgentDesktop @("observe", "--app", "TGTmusic", "--query", $sel)
    $searchRef = GetRefFromJson $find
    if ($searchRef) { LogOk "Campo de busca encontrado com '$sel': $searchRef"; break }
}

if (-not $searchRef) {
    LogWarn "Não achou por role. Tentando por nome 'busca'..."
    $find = RunAgentDesktop @("observe", "--app", "TGTmusic", "--query", '*[name*="busca"i]')
    $searchRef = GetRefFromJson $find
}
if (-not $searchRef) {
    LogWarn "Tentando por placeholder..."
    $find = RunAgentDesktop @("observe", "--app", "TGTmusic", "--query", '*[placeholder*="busca"i]')
    $searchRef = GetRefFromJson $find
}
if (-not $searchRef) {
    LogErr "Campo de busca NÃO ENCONTRADO. Salvando dump completo..."
    RunAgentDesktop @("observe", "--app", "TGTmusic") | Out-File (Join-Path $OutputDir "snapshot-debug.json") -Encoding utf8
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue; Stop-Transcript; exit 1
}

# ──────────────────────────────────────────────
# 6. Clica, digita, Enter
# ──────────────────────────────────────────────
Log "Clicando no campo de busca..."
RunAgentDesktop @("click", "--ref", $searchRef) | Out-Null
Start-Sleep -Milliseconds 500

Log "Digitando: $SearchQuery"
RunAgentDesktop @("type", "--text", $SearchQuery) | Out-Null
Start-Sleep -Milliseconds 300

Log "Pressionando Enter..."
RunAgentDesktop @("key", "--name", "Enter") | Out-Null

# ──────────────────────────────────────────────
# 7. Espera resultados
# ──────────────────────────────────────────────
Log "Aguardando resultados da busca..."
$waitResults = RunAgentDesktop @("wait", "--app", "TGTmusic", "--query", "listitem, row, button", "--timeout", "10")
if (-not $waitResults) {
    LogWarn "Nenhum resultado padrão apareceu. Salvando snapshot..."
    RunAgentDesktop @("observe", "--app", "TGTmusic") | Out-File (Join-Path $OutputDir "snapshot-pos-busca.json") -Encoding utf8
} else { LogOk "Resultados carregados" }

# ──────────────────────────────────────────────
# 8. Clica no primeiro resultado
# ──────────────────────────────────────────────
Log "Procurando primeiro item clicável..."
$itemRef = $null
foreach ($sel in @('listitem', 'row', 'button[description*="play"i]', 'button')) {
    Log "Tentando: $sel"
    $find = RunAgentDesktop @("observe", "--app", "TGTmusic", "--query", $sel)
    $itemRef = GetRefFromJson $find
    if ($itemRef) { LogOk "Item encontrado com '$sel': $itemRef"; break }
}
if (-not $itemRef) {
    LogErr "Nenhum item clicável encontrado"
    RunAgentDesktop @("observe", "--app", "TGTmusic") | Out-File (Join-Path $OutputDir "snapshot-sem-itens.json") -Encoding utf8
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue; Stop-Transcript; exit 1
}
Log "Clicando no primeiro resultado..."
RunAgentDesktop @("click", "--ref", $itemRef) | Out-Null

# ──────────────────────────────────────────────
# 9. Monitora playback - espera "Preparando..." sumir
# ──────────────────────────────────────────────
Log "Aguardando playback iniciar (espera 'Preparando' sumir, max 30s)..."
$waitPlay = RunAgentDesktop @("wait", "--app", "TGTmusic", "--query", '*[name*="Preparando"i]', "--timeout", "30", "--until", "absent")
if ($waitPlay) { LogOk "Playback iniciou! 'Preparando' desapareceu." }
else {
    LogWarn "'Preparando' não sumiu em 30s. Verificando estado..."
    RunAgentDesktop @("observe", "--app", "TGTmusic") | Out-File (Join-Path $OutputDir "snapshot-playback.json") -Encoding utf8
    $findError = RunAgentDesktop @("observe", "--app", "TGTmusic", "--query", '*[name*="erro"i], *[name*="error"i], *[description*="erro"i]')
    if ($findError) {
        $errorRef = GetRefFromJson $findError
        if ($errorRef) { $errorText = RunAgentDesktop @("read", "--ref", $errorRef); LogErr "Erro detectado na UI: $errorText" }
    }
}

# ──────────────────────────────────────────────
# 10. Verifica controles de playback
# ──────────────────────────────────────────────
Log "Verificando controles de playback..."
foreach ($sel in @('slider', 'progress_bar', 'scrollbar')) {
    $find = RunAgentDesktop @("observe", "--app", "TGTmusic", "--query", $sel)
    $sliderRef = GetRefFromJson $find
    if ($sliderRef) { LogOk "Slider de progresso encontrado ($sel): $sliderRef"; $sliderVal = RunAgentDesktop @("read", "--ref", $sliderRef); Log "Valor do slider: $sliderVal"; break }
}

# ──────────────────────────────────────────────
# 11. Screenshot final
# ──────────────────────────────────────────────
Log "Capturando screenshot final..."
$screenPath = Join-Path $OutputDir "resultado-final.png"
RunAgentDesktop @("screenshot", "--app", "TGTmusic", "--output", $screenPath) | Out-Null
if (Test-Path $screenPath) { LogOk "Screenshot: $screenPath" }

# ──────────────────────────────────────────────
# 12. Snapshot final completo
# ──────────────────────────────────────────────
Log "Snapshot final..."
RunAgentDesktop @("observe", "--app", "TGTmusic") | Out-File (Join-Path $OutputDir "snapshot-final.json") -Encoding utf8

# ──────────────────────────────────────────────
# Cleanup
# ──────────────────────────────────────────────
Log "Fechando app..."
Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue

Stop-Transcript
Log "=== FIM TESTE ==="
Log "Logs completos: $logFile"
Log "Artefatos em: $OutputDir"

# Abre pasta de output
Invoke-Item $OutputDir