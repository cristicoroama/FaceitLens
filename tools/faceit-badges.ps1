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
    [string[]]$Nicknames = @("dziugss", "donk666")
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
$suspects = @("badge", "pin", "achiev", "award", "cosmetic", "trophy", "medal", "replay", "reward")

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

    $found = $keys | Where-Object {
        $k = $_.ToLower()
        $suspects | Where-Object { $k -like "*$_*" }
    }

    if ($found) {
        $hit = $true
        Write-Host ""
        foreach ($k in $found) {
            $val = $p.$k | ConvertTo-Json -Depth 6 -Compress
            if ($val.Length -gt 700) { $val = $val.Substring(0, 700) + " ...(taiat)" }
            Write-Host "  >> $k = $val" -ForegroundColor Green
        }
    } else {
        Write-Host "  nimic care sa semene a badge in raspunsul asta" -ForegroundColor DarkGray
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
