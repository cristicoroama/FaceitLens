<#
    De ce difera numarul de meciuri fata de alte site-uri?

    Noi afisam 5719 meciuri CS2 pentru un cont, faceitanalyser afiseaza 1259.
    Codul nostru nu calculeaza nimic: ia direct `lifetime.Matches` din
    /players/{id}/stats/cs2. Deci intrebarea nu e daca gresim aritmetica, ci
    ce numara de fapt campul ala.

    Doua ipoteze, si duc la remedii diferite:

      A. Cifra include si moduri non-5v5 (wingman, 1v1, 2v2, huburi cu alt
         format). Tooltipul faceitanalyser spune exact asta despre numarul
         LOR: e doar 5v5 si "can be lower than your total match history".
         Daca A e adevarata, cifra noastra e corecta ca "total", dar ar trebui
         etichetata, iar statisticile de 5v5 ar trebui calculate separat.

      B. Lifetime-ul de CS2 include si meciurile de CS:GO. Pe contul verificat,
         5719 - 4477 = 1242, iar faceitanalyser arata 1259 — foarte aproape,
         dar nu exact, deci nu e o simpla adunare. Daca B e adevarata, numarul
         de CS2 e umflat si trebuie scazut.

    Testul care le separa: `segments` din raspunsul de stats contine cate o
    intrare per (harta x mod). Suma meciurilor pe modul 5v5 da numarul real de
    5v5. Comparata cu `lifetime.Matches`, arata daca diferenta vine din moduri
    (A) sau nu (B).

    Verifica si daca segmentele au dubluri pe aceeasi harta in moduri diferite
    — daca da, lista noastra de harti le numara de doua ori.

    Rulare:
        .\faceit-match-count.ps1 -ApiKey "cheia-ta"
        .\faceit-match-count.ps1 -ApiKey "cheia" -Nicknames s1mplecsgod,donk666
#>
param(
    [Parameter(Mandatory = $true)][string]$ApiKey,
    [string[]]$Nicknames = @("s1mplecsgod", "donk666", "dziugss")
)

$headers = @{ Authorization = "Bearer $ApiKey" }
$base = "https://open.faceit.com/data/v4"

function Get-Json($url) {
    try {
        return Invoke-RestMethod -Uri $url -Headers $headers -ErrorAction Stop
    } catch {
        $code = $null
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        return [pscustomobject]@{ __error = $true; __code = $code }
    }
}

function Show-Game($id, $game) {
    $s = Get-Json "$base/players/$id/stats/$game"
    if ($s.__error) {
        Write-Host "  $game -> HTTP $($s.__code)" -ForegroundColor DarkGray
        return $null
    }

    $life = [int]$s.lifetime.'Matches'
    Write-Host "  $game lifetime.Matches : $life" -ForegroundColor Cyan

    # Grupez segmentele pe mod si insumez meciurile.
    $byMode = @{}
    $mapSeen = @{}
    $dupes = @()
    foreach ($seg in $s.segments) {
        if ($seg.type -ne 'Map') { continue }
        $mode = if ($seg.mode) { $seg.mode } else { '(fara mod)' }
        $n = 0
        if ($seg.stats.'Matches') { $n = [int]$seg.stats.'Matches' }
        if (-not $byMode.ContainsKey($mode)) { $byMode[$mode] = 0 }
        $byMode[$mode] += $n

        $label = $seg.label
        if ($mapSeen.ContainsKey($label)) { $dupes += "$label ($($mapSeen[$label]) + $mode)" }
        else { $mapSeen[$label] = $mode }
    }

    $total = 0
    Write-Host "  meciuri pe mod:"
    foreach ($k in ($byMode.Keys | Sort-Object)) {
        Write-Host ("    {0,-16} {1}" -f $k, $byMode[$k])
        $total += $byMode[$k]
    }
    Write-Host "    suma segmentelor : $total"

    $fivev5 = 0
    foreach ($k in $byMode.Keys) { if ($k -like '*5v5*') { $fivev5 += $byMode[$k] } }
    if ($fivev5 -gt 0) { Write-Host "    doar 5v5         : $fivev5" -ForegroundColor Yellow }

    if ($dupes.Count -gt 0) {
        Write-Host "  harti in mai multe moduri (le-am numara de doua ori): $($dupes -join ', ')" -ForegroundColor Yellow
    } else {
        Write-Host "  fara harti duplicate intre moduri" -ForegroundColor DarkGray
    }

    return [pscustomobject]@{ life = $life; segTotal = $total; fivev5 = $fivev5 }
}

foreach ($nick in $Nicknames) {
    Write-Host ""
    Write-Host "=== $nick ===" -ForegroundColor Green

    $p = Get-Json "$base/players?nickname=$([uri]::EscapeDataString($nick))"
    if ($p.__error) {
        Write-Host "  profil indisponibil (HTTP $($p.__code))" -ForegroundColor DarkGray
        continue
    }
    $id = $p.player_id

    $cs2 = Show-Game $id 'cs2'
    Write-Host ""
    $csgo = Show-Game $id 'csgo'

    if ($cs2 -and $csgo) {
        Write-Host ""
        Write-Host "  --- verdict ---" -ForegroundColor Yellow
        Write-Host "  cs2 lifetime          : $($cs2.life)"
        Write-Host "  cs2 doar 5v5          : $($cs2.fivev5)"
        Write-Host "  cs2 lifetime - csgo   : $($cs2.life - $csgo.life)"
        Write-Host ""
        if ($cs2.fivev5 -gt 0 -and [math]::Abs($cs2.fivev5 - $cs2.life) -gt 20) {
            Write-Host "  Ipoteza A: diferenta vine din moduri non-5v5." -ForegroundColor Yellow
            Write-Host "  Cifra noastra e totalul real; separam 5v5 daca vrem paritate." -ForegroundColor Yellow
        } elseif ([math]::Abs(($cs2.life - $csgo.life) - $cs2.fivev5) -lt 50) {
            Write-Host "  Ipoteza B: lifetime-ul CS2 pare sa includa si CS:GO." -ForegroundColor Red
            Write-Host "  Atunci numarul de CS2 e umflat si trebuie corectat." -ForegroundColor Red
        } else {
            Write-Host "  Niciuna nu se potriveste curat. Trimite-mi tot ce a iesit." -ForegroundColor Yellow
        }
    }
}
Write-Host ""
