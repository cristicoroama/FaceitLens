<#
    De unde vin badge-urile de pe profilul FACEIT?

    Sunt pastilele circulare de sub "Game history". Hover-ul pe una arata
    "Replay 2024 — Received a GG", deci sunt badge-uri de campanie, nu
    logo-uri de hub cum presupusesem prima data. FACEIT le documenteaza ca
    "Pins & Badges" in centrul de ajutor, dar API-ul PUBLIC nu le expune:
    schema `Player` nu are asa ceva si nu exista endpoint pentru ele.

    Ramane API-ul intern, api.faceit.com — cel pe care il foloseste site-ul
    lor si pe care tracker/faceit.py il apeleaza deja in get_internal_profile
    pentru Twitch si data crearii contului. Ipoteza principala e ca badge-urile
    sunt in exact acel raspuns, iar noi il primim si aruncam tot in afara de
    doua campuri.

    Nu cere cheie de API — endpointul intern e neautentificat.

    De retinut inainte sa construiesti ceva pe rezultat: API-ul intern nu are
    niciun contract. Se poate schimba sau inchide fara anunt, exact ca in
    comentariul deja scris in faceit.py. Orice afisam de aici trebuie sa fie
    decor care poate lipsi, nu ceva de care depinde pagina.

    Rulare:
        .\faceit-badges.ps1
        .\faceit-badges.ps1 -Nicknames dziugss,donk666
#>
param(
    # DALGALI are rama ornamentala, efect pe nume si banner — controlul pozitiv.
    # Daca la el nu iese nimic, cosmeticele nu sunt in raspunsul asta.
    [string[]]$Nicknames = @("DALGALI", "dziugss", "donk666")
)

$headers = @{ "User-Agent" = "faceit-lens.com" }
$hit = $false

function Get-Json($url) {
    try {
        return Invoke-RestMethod -Uri $url -Headers $headers -TimeoutSec 12 -ErrorAction Stop
    } catch {
        $code = $null
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        return [pscustomobject]@{ __error = $true; __code = $code }
    }
}

# Cuvinte care ar trada un badge sub orice nume ar fi impachetat.
$suspects = @(
    "badge", "pin", "achiev", "award", "cosmetic", "trophy", "medal", "replay", "reward",
    # cosmeticele de profil: rama avatarului, efectul pe nume, bannerul
    # Fara "cover": cover_image_url e bannerul de profil, pe care il avem deja
    # din API-ul public (cover_image). Cautat aici, dadea un verdict verde fals.
    "frame", "border", "effect", "banner", "theme", "decor", "nameplate",
    "skin", "custom", "flair", "glow", "animation", "item", "equipped", "inventory",
    # taburile noi: Setup (periferice, crosshair) si Skin Vault (beta)
    "setup", "vault", "loadout", "crosshair", "sensitiv", "mouse", "dpi",
    "peripheral", "monitor", "float", "stattrak"
)

foreach ($nick in $Nicknames) {
    Write-Host ""
    Write-Host "=== $nick ===" -ForegroundColor Cyan

    $r = Get-Json "https://api.faceit.com/users/v1/nicknames/$([uri]::EscapeDataString($nick))"
    if ($r.__error) {
        Write-Host "  endpoint intern indisponibil (HTTP $($r.__code))" -ForegroundColor DarkGray
        continue
    }

    $p = if ($r.payload) { $r.payload } else { $r }
    $keys = $p.PSObject.Properties.Name
    Write-Host "  chei in raspunsul intern ($($keys.Count)):" -ForegroundColor Gray
    Write-Host "    $($keys -join ', ')"

    # Cosmeticele (rama de avatar, efectul pe nume, bannerul) aproape sigur nu
    # stau la primul nivel — sunt imbricate sub ceva gen settings sau
    # customization. Coboram pana la adancimea 4 si raportam CALEA completa.
    $found = @()
    function Walk($obj, $path, $depth) {
        if ($depth -gt 4 -or $null -eq $obj) { return }
        if ($obj -is [System.Management.Automation.PSCustomObject]) {
            foreach ($prop in $obj.PSObject.Properties) {
                $full = if ($path) { "$path.$($prop.Name)" } else { $prop.Name }
                $low = $prop.Name.ToLower()
                if ($suspects | Where-Object { $low -like "*$_*" }) {
                    $script:found += [pscustomobject]@{ Path = $full; Value = $prop.Value }
                }
                Walk $prop.Value $full ($depth + 1)
            }
        } elseif ($obj -is [System.Array]) {
            if ($obj.Count -gt 0) { Walk $obj[0] "$path[0]" ($depth + 1) }
        }
    }
    $script:found = @()
    Walk $p "" 0
    $found = $script:found

    if ($found.Count -gt 0) {
        $hit = $true
        Write-Host ""
        foreach ($f in $found) {
            $val = $f.Value | ConvertTo-Json -Depth 6 -Compress
            if ($val -and $val.Length -gt 500) { $val = $val.Substring(0, 500) + " ...(taiat)" }
            Write-Host "  >> $($f.Path) = $val" -ForegroundColor Green
        }
    } else {
        Write-Host "  nimic care sa semene a badge sau cosmetic, la nicio adancime" -ForegroundColor DarkGray
    }

    # Daca profilul are un id, mai incearca doua drumuri plauzibile.
    $guid = $p.id
    if ($guid) {
        foreach ($path in @("/users/v1/users/$guid", "/badges/v1/user/$guid")) {
            $x = Get-Json "https://api.faceit.com$path"
            if ($x.__error) {
                Write-Host "  $path -> HTTP $($x.__code)" -ForegroundColor DarkGray
            } else {
                $xp = if ($x.payload) { $x.payload } else { $x }
                $xk = $xp.PSObject.Properties.Name
                $xf = $xk | Where-Object { $k = $_.ToLower(); $suspects | Where-Object { $k -like "*$_*" } }
                if ($xf) {
                    $hit = $true
                    Write-Host "  $path -> 200, contine: $($xf -join ', ')" -ForegroundColor Green
                } else {
                    Write-Host "  $path -> 200, fara badge-uri ($($xk.Count) chei)" -ForegroundColor DarkGray
                }
            }
        }
    }
}

Write-Host ""
Write-Host "--- concluzie ---" -ForegroundColor Yellow
if ($hit) {
    Write-Host "  Badge-urile SUNT expuse. Trimite-mi ce a iesit cu verde si le pun pe profil." -ForegroundColor Yellow
    Write-Host "  Atentie: API intern, fara contract. Le afisam ca decor optional." -ForegroundColor Yellow
} else {
    Write-Host "  Nu apar nicaieri: nici in API-ul public, nici pe drumurile" -ForegroundColor Yellow
    Write-Host "  interne incercate aici. Probabil sunt randate dintr-un" -ForegroundColor Yellow
    Write-Host "  endpoint pe care il stie doar frontendul lor." -ForegroundColor Yellow
}
Write-Host ""
