<#
    Ce campuri returneaza FACEIT pentru un meci?

    Documentatia (docs.faceit.com) declara `player_stats` ca un dictionar liber —
    "property1", "property2" — deci nu spune nicaieri ce chei exista de fapt.
    Singurul mod de a sti sigur daca "FACEIT Rating" si "Swing" sunt in API-ul
    public v4 este sa ceri un meci real si sa te uiti.

    Rulare (PowerShell, nu are nevoie de Python):

        cd C:\Users\coroa\Desktop\FaceitLens\tools
        .\faceit-stats-keys.ps1 -ApiKey "cheia-ta" -MatchId "1-fada4a74-cd44-4a5e-a944-0a2818ca215e"

    Daca PowerShell refuza sa ruleze scriptul, deblocheaza-l o singura data:

        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#>
param(
    [Parameter(Mandatory = $true)][string]$ApiKey,
    [string]$MatchId = "1-fada4a74-cd44-4a5e-a944-0a2818ca215e"
)

$url = "https://open.faceit.com/data/v4/matches/$MatchId/stats"

try {
    $res = Invoke-RestMethod -Uri $url -Headers @{ Authorization = "Bearer $ApiKey" }
} catch {
    Write-Host "Cererea a esuat: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Verifica cheia si id-ul meciului." -ForegroundColor Yellow
    exit 1
}

$player = $res.rounds[0].teams[0].players[0]
$stats  = $player.player_stats

Write-Host ""
Write-Host "Meci : $MatchId"
Write-Host "Runde: $($res.rounds[0].round_stats.Rounds)"
Write-Host "Player de proba: $($player.nickname)"
Write-Host ""
Write-Host "--- toate cheile din player_stats ---" -ForegroundColor Cyan

$stats.PSObject.Properties |
    Sort-Object Name |
    ForEach-Object { "{0,-32} {1}" -f $_.Name, $_.Value }

Write-Host ""
Write-Host "--- exista ceva care seamana cu ratingul lor? ---" -ForegroundColor Cyan

$hits = $stats.PSObject.Properties |
    Where-Object { $_.Name -match "(?i)rating|swing|kast|impact|score" }

if ($hits) {
    $hits | ForEach-Object { Write-Host ("  {0} = {1}" -f $_.Name, $_.Value) -ForegroundColor Green }
} else {
    Write-Host "  Nimic. Ratingul si Swing-ul NU sunt in API-ul public v4," -ForegroundColor Yellow
    Write-Host "  deci raman de estimat din kills/deaths/ADR/multikills." -ForegroundColor Yellow
}
Write-Host ""
