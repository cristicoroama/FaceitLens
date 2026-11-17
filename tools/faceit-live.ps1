<#
    De ce nu apare "Playing now" pentru un jucator care chiar e in meci?

    Ruleaza-l CAT TIMP jucatorul e in meci. Daca meciul s-a terminat, testul
    nu mai dovedeste nimic.

    "Playing now" presupune ca /players/{id}/history din API-ul public
    returneaza si meciul in desfasurare, cu status ONGOING. Presupunerea vine
    din overlay-ul de OBS si n-a fost verificata niciodata pe un meci real.
    Scriptul o testeaza direct, in trei locuri:

      1. API-ul public: primele 3 intrari din history, cu status si timpi.
         Daca meciul curent NU e aici, asta e cauza si trebuie alta sursa.
      2. API-ul intern, endpointul pe care il foloseste chiar faceit.com
         pentru popover-ul "VS" cu meciurile in curs ale unui jucator.
      3. Endpointul nostru /api/live/ de pe backend, ca sa vedem ce primeste
         de fapt frontendul.

    Rulare (cat timp e in meci):
        .\faceit-live.ps1 -ApiKey "cheia" -Nickname BoziSpuma
        .\faceit-live.ps1 -ApiKey "cheia" -Nickname BoziSpuma -Backend "https://backend-ul-tau.onrender.com"
#>
param(
    [Parameter(Mandatory = $true)][string]$ApiKey,
    [Parameter(Mandatory = $true)][string]$Nickname,
    [string]$Backend = ""
)

$pub = @{ Authorization = "Bearer $ApiKey" }
$ua  = @{ "User-Agent" = "faceit-lens.com" }

function Get-Json($url, $headers) {
    try {
        return Invoke-RestMethod -Uri $url -Headers $headers -TimeoutSec 12 -ErrorAction Stop
    } catch {
        $code = $null
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        return [pscustomobject]@{ __error = $true; __code = $code }
    }
}

function When($ts) {
    if (-not $ts) { return "-" }
    try { return [DateTimeOffset]::FromUnixTimeSeconds([int64]$ts).ToLocalTime().ToString("dd.MM HH:mm") }
    catch { return "$ts" }
}

$p = Get-Json "https://open.faceit.com/data/v4/players?nickname=$([uri]::EscapeDataString($Nickname))" $pub
if ($p.__error) { Write-Host "Nu gasesc jucatorul (HTTP $($p.__code))." -ForegroundColor Red; exit 1 }
$id = $p.player_id
Write-Host ""
Write-Host "$Nickname  ->  player_id $id" -ForegroundColor Cyan
Write-Host ("acum: " + (Get-Date).ToString("HH:mm:ss"))

# 1. API public
Write-Host ""
Write-Host "=== 1. API public: /players/{id}/history (primele 3) ===" -ForegroundColor Yellow
$h = Get-Json "https://open.faceit.com/data/v4/players/$id/history?game=cs2&offset=0&limit=3" $pub
$publicHasLive = $false
if ($h.__error) {
    Write-Host "  HTTP $($h.__code)" -ForegroundColor Red
} else {
    foreach ($m in @($h.items)) {
        $col = if ($m.status -in @("ONGOING", "READY")) { "Green" } else { "Gray" }
        if ($m.status -in @("ONGOING", "READY")) { $publicHasLive = $true }
        Write-Host ("  {0,-14} start {1}  final {2}  {3}" -f $m.status, (When $m.started_at), (When $m.finished_at), $m.match_id) -ForegroundColor $col
    }
}

# 1b. Cautarea publica. Raspunsul /search/players are un camp `status` per
# jucator, nedocumentat ca valori. Singurul camp de prezenta din tot Data
# API-ul — daca se schimba cand omul e in meci, e sursa noastra.
Write-Host ""
Write-Host "=== 1b. API public: campul status din /search/players ===" -ForegroundColor Yellow
$searchStatus = $null
$sr = Get-Json "https://open.faceit.com/data/v4/search/players?nickname=$([uri]::EscapeDataString($Nickname))&game=cs2&limit=5" $pub
if ($sr.__error) {
    Write-Host "  HTTP $($sr.__code)" -ForegroundColor Red
} else {
    foreach ($it in @($sr.items)) {
        $mark = if ($it.player_id -eq $id) { "  <-- el" } else { "" }
        Write-Host ("  {0,-20} status = {1}{2}" -f $it.nickname, $it.status, $mark)
        if ($it.player_id -eq $id) { $searchStatus = $it.status }
    }
}

# 1c. Profilul public complet: orice camp care ar putea fi stare/prezenta.
Write-Host ""
Write-Host "=== 1c. API public: /players/{id}, campuri de stare ===" -ForegroundColor Yellow
$full = Get-Json "https://open.faceit.com/data/v4/players/$id" $pub
if (-not $full.__error) {
    $hits = $full.PSObject.Properties | Where-Object { $_.Name -match "status|state|online|presence|match|playing" }
    if ($hits) { foreach ($x in $hits) { Write-Host "  $($x.Name) = $($x.Value | ConvertTo-Json -Compress -Depth 3)" -ForegroundColor Green } }
    else { Write-Host "  niciun camp de stare" -ForegroundColor DarkGray }
}

# 2. API intern
Write-Host ""
Write-Host "=== 2. API intern: meciuri pe stare (ce foloseste faceit.com) ===" -ForegroundColor Yellow
$internalHasLive = $false
$g = Get-Json "https://api.faceit.com/match/v1/matches/groupByState?userId=$id" $ua
if ($g.__error) {
    Write-Host "  HTTP $($g.__code)" -ForegroundColor DarkGray
} else {
    $payload = if ($g.payload) { $g.payload } else { $g }
    $states = $payload.PSObject.Properties.Name
    if (-not $states) { Write-Host "  raspuns gol" -ForegroundColor DarkGray }
    foreach ($s in $states) {
        $list = @($payload.$s)
        Write-Host "  $s -> $($list.Count) meci(uri)" -ForegroundColor Green
        $internalHasLive = $true
        foreach ($m in $list | Select-Object -First 2) {
            $mid = if ($m.id) { $m.id } elseif ($m.matchId) { $m.matchId } else { "?" }
            Write-Host "      $mid  (chei: $(@($m.PSObject.Properties.Name)[0..7] -join ', ') ...)"
        }
    }
}

# 3. backend-ul nostru
if ($Backend) {
    Write-Host ""
    Write-Host "=== 3. backend FaceitLens: /api/live/{id}/ ===" -ForegroundColor Yellow
    $b = Get-Json "$($Backend.TrimEnd('/'))/api/live/$id/" @{ Origin = "https://faceit-lens.com" }
    if ($b.__error) {
        Write-Host "  HTTP $($b.__code)  (404 = endpointul nu e deployat)" -ForegroundColor Red
    } else {
        Write-Host "  $($b | ConvertTo-Json -Depth 4 -Compress)"
    }
}

Write-Host ""
Write-Host "--- concluzie ---" -ForegroundColor Yellow
Write-Host "  status in cautare: $searchStatus"
Write-Host "  (ruleaza-l inca o data DUPA ce iese din meci: daca status-ul difera, e semnalul nostru)"
if ($publicHasLive) {
    Write-Host "  API-ul public ARE meciul in curs. Problema e la noi (deploy / cache / frontend)." -ForegroundColor Yellow
} elseif ($internalHasLive) {
    Write-Host "  API-ul public NU il are, dar cel intern DA." -ForegroundColor Yellow
    Write-Host "  Deci history arata doar meciuri terminate si trebuie schimbata sursa." -ForegroundColor Yellow
} else {
    Write-Host "  Nicio sursa nu arata meciul. Ori s-a terminat, ori e intr-o stare" -ForegroundColor Yellow
    Write-Host "  pe care nu o cunoastem. Trimite-mi tot outputul." -ForegroundColor Yellow
}
Write-Host ""
