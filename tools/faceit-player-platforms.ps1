<#
    Are conturi legate un jucator FACEIT, si care?

    `Player.platforms` e declarat in Swagger ca dictionar liber, deci schema
    nu spune ce chei apar de fapt. Singurul mod de a sti daca Twitch e acolo
    e sa ceri cativa jucatori reali si sa te uiti.

    Ruleaza pe mai multi jucatori odata, ideal streameri cunoscuti — daca nici
    la ei nu apare `twitch`, atunci FACEIT nu expune legatura prin API-ul
    public si butonul de Twitch n-are de unde sa se umple.

    Rulare:
        .\faceit-player-platforms.ps1 -ApiKey "cheia-ta"
        .\faceit-player-platforms.ps1 -ApiKey "cheia" -Nicknames donk666,ropz,NiKo

    Daca PowerShell refuza sa ruleze scriptul:
        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#>
param(
    [Parameter(Mandatory = $true)][string]$ApiKey,
    [string[]]$Nicknames = @("donk666", "ropz", "NiKo", "s1mple", "ZywOo")
)

$headers = @{ Authorization = "Bearer $ApiKey" }
$anyTwitch = $false

foreach ($nick in $Nicknames) {
    $url = "https://open.faceit.com/data/v4/players?nickname=$([uri]::EscapeDataString($nick))"
    try {
        $p = Invoke-RestMethod -Uri $url -Headers $headers
    } catch {
        Write-Host ("{0,-12} cererea a esuat: {1}" -f $nick, $_.Exception.Message) -ForegroundColor Red
        continue
    }

    $platforms = $p.platforms
    if ($null -eq $platforms -or $platforms.PSObject.Properties.Count -eq 0) {
        Write-Host ("{0,-12} platforms: (gol)" -f $nick) -ForegroundColor DarkGray
        continue
    }

    $pairs = $platforms.PSObject.Properties | ForEach-Object { "$($_.Name)=$($_.Value)" }
    $hasTwitch = $platforms.PSObject.Properties.Name -contains "twitch"
    if ($hasTwitch) { $anyTwitch = $true }

    $colour = if ($hasTwitch) { "Green" } else { "Gray" }
    Write-Host ("{0,-12} {1}" -f $nick, ($pairs -join "  ")) -ForegroundColor $colour
}

Write-Host ""
if ($anyTwitch) {
    Write-Host "Twitch APARE in platforms — butonul are de unde sa se umple." -ForegroundColor Green
} else {
    Write-Host "Twitch NU apare la niciunul." -ForegroundColor Yellow
    Write-Host "Inseamna ca FACEIT nu expune legatura prin API-ul public v4," -ForegroundColor Yellow
    Write-Host "iar butonul de Twitch nu se va afisa la nimeni. Scoate-l sau" -ForegroundColor Yellow
    Write-Host "lasa-l — nu strica nimic, doar nu apare niciodata." -ForegroundColor Yellow
}
Write-Host ""
