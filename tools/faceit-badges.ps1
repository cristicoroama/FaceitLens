<#
    Expune API-ul public badge-urile circulare de pe profilul FACEIT?

    Sunt cele trei pastile colorate de sub "Game history" pe pagina de profil.
    Nu apar in `Player` din Swagger si nu exista niciun endpoint documentat
    pentru ele, deci intrebarea e daca vin pe alt drum sau deloc.

    Trei ipoteze, verificate separat:
      1. sunt in obiectul Player, sub o cheie nedocumentata
         (Swagger declara doar un subset; `platforms` era la fel)
      2. exista un endpoint dedicat /players/{id}/badges
      3. sunt de fapt CLUBURI sau HUBURI, iar cercurile sunt logo-urile lor
         — cea mai probabila explicatie, avand in vedere ca arata a embleme
         de comunitate, nu a realizari

    Daca toate trei ies negativ, badge-urile sunt exclusiv pe site-ul lor,
    randate din API-ul intern, si nu le putem lua legal prin API-ul public.

    Rulare:
        .\faceit-badges.ps1 -ApiKey "cheia-ta"
        .\faceit-badges.ps1 -ApiKey "cheia" -Nicknames dziugss,donk666

    Daca PowerShell refuza sa ruleze scriptul:
        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#>
param(
    [Parameter(Mandatory = $true)][string]$ApiKey,
    [string[]]$Nicknames = @("dziugss", "donk666")
)

$headers = @{ Authorization = "Bearer $ApiKey" }
$base = "https://open.faceit.com/data/v4"

# Chei documentate in Player. Orice altceva e teren necartografiat si merita
# raportat — asa a fost gasit si `cybershoke_registered_at` la CSRep.
$known = @(
    "player_id", "nickname", "avatar", "country", "cover_image", "cover_featured_image",
    "infractions", "platforms", "games", "settings", "friends_ids", "new_steam_id",
    "steam_id_64", "steam_nickname", "memberships", "faceit_url", "membership_type",
    "activated_at", "verified"
)

function Get-Json($url) {
    try {
        return Invoke-RestMethod -Uri $url -Headers $headers -ErrorAction Stop
    } catch {
        $code = $null
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        return [pscustomobject]@{ __error = $true; __code = $code }
    }
}

$foundUnknown = $false
$foundEndpoint = $false
$foundClubs = $false

foreach ($nick in $Nicknames) {
    Write-Host ""
    Write-Host "=== $nick ===" -ForegroundColor Cyan

    $p = Get-Json "$base/players?nickname=$([uri]::EscapeDataString($nick))"
    if ($p.__error) {
        Write-Host "  profil indisponibil (HTTP $($p.__code))" -ForegroundColor DarkGray
        continue
    }
    $id = $p.player_id

    # 1. chei nedocumentate
    $all = $p.PSObject.Properties.Name
    $extra = $all | Where-Object { $known -notcontains $_ }
    if ($extra) {
        $foundUnknown = $true
        Write-Host "  chei nedocumentate in Player: $($extra -join ', ')" -ForegroundColor Green
    } else {
        Write-Host "  chei nedocumentate in Player: niciuna" -ForegroundColor DarkGray
    }

    # 2. endpointuri plauzibile
    foreach ($path in @("/players/$id/badges", "/players/$id/achievements", "/badges")) {
        $r = Get-Json "$base$path"
        if ($r.__error) {
            Write-Host "  $path -> HTTP $($r.__code)" -ForegroundColor DarkGray
        } else {
            $foundEndpoint = $true
            Write-Host "  $path -> 200 (!) chei: $($r.PSObject.Properties.Name -join ', ')" -ForegroundColor Green
        }
    }

    # 3. cluburi / huburi — ipoteza cea mai probabila
    $hubs = Get-Json "$base/players/$id/hubs?offset=0&limit=10"
    if (-not $hubs.__error) {
        $n = @($hubs.items).Count
        Write-Host "  hubs -> $n" -ForegroundColor $(if ($n) { "Green" } else { "DarkGray" })
        foreach ($h in @($hubs.items)) {
            $foundClubs = $true
            Write-Host "      $($h.name)  [avatar: $([bool]$h.avatar)]"
        }
    } else {
        Write-Host "  hubs -> HTTP $($hubs.__code)" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "--- concluzie ---" -ForegroundColor Yellow
Write-Host "  chei nedocumentate in Player : $foundUnknown"
Write-Host "  endpoint dedicat de badges   : $foundEndpoint"
Write-Host "  huburi cu logo               : $foundClubs"
Write-Host ""
if (-not $foundUnknown -and -not $foundEndpoint -and $foundClubs) {
    Write-Host "  Deci: cercurile sunt aproape sigur logo-uri de hub/club," -ForegroundColor Yellow
    Write-Host "  iar pe alea le avem deja in tabul Hubs." -ForegroundColor Yellow
} elseif (-not $foundUnknown -and -not $foundEndpoint -and -not $foundClubs) {
    Write-Host "  Deci: badge-urile nu sunt expuse prin API-ul public." -ForegroundColor Yellow
}
Write-Host ""
