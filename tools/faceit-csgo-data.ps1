<#
    Mai returneaza FACEIT ceva pentru CS:GO, sau doar pentru CS2?

    Intrebarea a aparut vazand ca faceitanalyser.com are un comutator
    CS2 / CS:GO pe profil. Nu se poate deduce din Swagger: `Player.games` e
    declarat dictionar liber, exact ca `platforms`, deci schema nu spune ce
    chei exista de fapt. Si chiar daca `csgo` apare in profil, nu rezulta ca
    endpointurile de statistici si de istoric mai servesc date pentru el —
    FACEIT a arhivat CS:GO cand a lansat CS2.

    Atentie la interpretare: daca scriptul arata ca API-ul NU mai da CS:GO,
    asta nu inseamna ca faceitanalyser minte. Ei ruleaza din 2020 si aproape
    sigur au datele in baza lor proprie, salvate cat timp API-ul le servea.
    Un site pornit dupa arhivare nu mai poate recupera acel istoric.

    Verifica trei lucruri separat, pentru ca pot avea raspunsuri diferite:
      1. apare `csgo` in `games` pe profil (nivel, ELO, id de joc)
      2. /players/{id}/stats/csgo mai raspunde 200 sau da 404
      3. /players/{id}/history?game=csgo mai intoarce meciuri

    Rulare:
        .\faceit-csgo-data.ps1 -ApiKey "cheia-ta"
        .\faceit-csgo-data.ps1 -ApiKey "cheia" -Nicknames dziugss,s1mple

    Daca PowerShell refuza sa ruleze scriptul:
        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#>
param(
    [Parameter(Mandatory = $true)][string]$ApiKey,
    [string[]]$Nicknames = @("dziugss", "s1mple", "donk666", "NiKo")
)

$headers = @{ Authorization = "Bearer $ApiKey" }
$base = "https://open.faceit.com/data/v4"
$anyCsgo = $false
$anyStats = $false
$anyHistory = $false

function Get-Json($url) {
    try {
        return Invoke-RestMethod -Uri $url -Headers $headers -ErrorAction Stop
    } catch {
        $code = $null
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        return [pscustomobject]@{ __error = $true; __code = $code }
    }
}

foreach ($nick in $Nicknames) {
    Write-Host ""
    Write-Host "=== $nick ===" -ForegroundColor Cyan

    $p = Get-Json "$base/players?nickname=$([uri]::EscapeDataString($nick))"
    if ($p.__error) {
        Write-Host "  nu am putut lua profilul (HTTP $($p.__code))" -ForegroundColor DarkGray
        continue
    }

    $games = @()
    if ($p.games) { $games = $p.games.PSObject.Properties.Name }
    Write-Host "  games: $($games -join ', ')"

    $csgo = $null
    if ($p.games) { $csgo = $p.games.csgo }

    if ($csgo) {
        $anyCsgo = $true
        Write-Host "  csgo -> nivel $($csgo.skill_level), ELO $($csgo.faceit_elo), regiune $($csgo.region)" -ForegroundColor Green
    } else {
        Write-Host "  csgo -> absent din profil" -ForegroundColor DarkGray
    }

    $id = $p.player_id
    if (-not $id) { continue }

    $s = Get-Json "$base/players/$id/stats/csgo"
    if ($s.__error) {
        Write-Host "  stats/csgo -> HTTP $($s.__code)" -ForegroundColor DarkGray
    } else {
        $anyStats = $true
        $m = $s.lifetime.'Matches'
        $wr = $s.lifetime.'Win Rate %'
        Write-Host "  stats/csgo -> 200, $($s.lifetime.PSObject.Properties.Name.Count) chei lifetime (Matches=$m, WinRate=$wr)" -ForegroundColor Green
    }

    $h = Get-Json "$base/players/$id/history?game=csgo&offset=0&limit=5"
    if ($h.__error) {
        Write-Host "  history?game=csgo -> HTTP $($h.__code)" -ForegroundColor DarkGray
    } else {
        $n = @($h.items).Count
        if ($n -gt 0) {
            $anyHistory = $true
            $last = [DateTimeOffset]::FromUnixTimeSeconds($h.items[0].finished_at).UtcDateTime
            Write-Host "  history?game=csgo -> $n meciuri, ultimul $($last.ToString('yyyy-MM-dd'))" -ForegroundColor Green
        } else {
            Write-Host "  history?game=csgo -> 200 dar zero meciuri" -ForegroundColor DarkGray
        }
    }
}

Write-Host ""
Write-Host "--- concluzie ---" -ForegroundColor Yellow
Write-Host "  profil contine csgo : $anyCsgo"
Write-Host "  stats/csgo merge    : $anyStats"
Write-Host "  history csgo merge  : $anyHistory"
Write-Host ""
if ($anyCsgo -and -not $anyStats -and -not $anyHistory) {
    Write-Host "  Deci: nivelul si ELO-ul vechi de CS:GO se mai pot arata, dar" -ForegroundColor Yellow
    Write-Host "  statisticile si istoricul nu se mai pot reconstrui din API." -ForegroundColor Yellow
} elseif ($anyStats -or $anyHistory) {
    Write-Host "  Deci: CS:GO e inca servit. Un tab CS:GO e fezabil." -ForegroundColor Yellow
} elseif (-not $anyCsgo) {
    Write-Host "  Deci: FACEIT nu mai expune CS:GO deloc prin API-ul public." -ForegroundColor Yellow
}
Write-Host ""
