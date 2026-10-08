# Erstellt die Anleitungen für Lehrpersonen als PDF aus docs/anleitung/anleitung.html (eine Quelle, zwei Fassungen).
# Ergebnis: anleitung/anleitung-mittelstufe.pdf und anleitung/anleitung-oberstufe.pdf (werden mit hochgeladen).
# Braucht Microsoft Edge (headless). Nach Änderungen an der Anleitung neu ausführen und die PDFs mit committen.
$repo = Split-Path $PSScriptRoot -Parent
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe" }
$quelle = ([Uri](Join-Path $repo "docs\anleitung\anleitung.html")).AbsoluteUri
$ziel = Join-Path $repo "anleitung"
New-Item -ItemType Directory -Force $ziel | Out-Null
$profil = Join-Path $env:TEMP "sff-anleitung-edge"
foreach ($f in @(@{ hash = "ms"; datei = "anleitung-mittelstufe.pdf" }, @{ hash = "os"; datei = "anleitung-oberstufe.pdf" })) {
  $pdf = Join-Path $ziel $f.datei
  if (Test-Path $pdf) { Remove-Item $pdf }
  # Edge beendet sich nach dem Drucken nicht immer selbst: warten, bis die Datei fertig ist, dann nur diese Prozesse schliessen
  Start-Process $edge -ArgumentList "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--user-data-dir=`"$profil`"",
    "--allow-file-access-from-files", "--virtual-time-budget=5000", "--print-to-pdf=`"$pdf`"", "`"$quelle#$($f.hash)`"" | Out-Null
  $n = 0; $alt = -1
  while ($n -lt 120) {
    Start-Sleep -Milliseconds 500; $n++
    if (Test-Path $pdf) { $neu = (Get-Item $pdf).Length; if ($neu -gt 0 -and $neu -eq $alt) { break }; $alt = $neu }
  }
  Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like "*sff-anleitung-edge*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  if (Test-Path $pdf) { Write-Output ("{0}: {1:N0} KB" -f $f.datei, ((Get-Item $pdf).Length / 1KB)) } else { Write-Output "$($f.datei): FEHLER" }
}
