# Stellt die Dateien für den Webspace zusammen (Hostpoint, https://je-net.ch/sff/).
# Ergebnis: Ordner «sff-upload» neben dem Repo. Seinen Inhalt per SFTP in den Ordner sff/ auf dem Webspace hochladen
# (bestehende Dateien überschreiben). Nicht dabei: Git, Dokumentation, SQL, dieses Skript.
$repo = Split-Path $PSScriptRoot -Parent
$ziel = Join-Path (Split-Path $repo -Parent) "sff-upload"
if (Test-Path $ziel) { Remove-Item -Recurse -Force $ziel }
New-Item -ItemType Directory $ziel | Out-Null
foreach ($f in "index.html", "admin.html", "config.js", "sw.js", "manifest.webmanifest", ".htaccess") {
  Copy-Item -LiteralPath (Join-Path $repo $f) $ziel
}
foreach ($d in "css", "js", "icons", "anleitung") { Copy-Item -Recurse (Join-Path $repo $d) $ziel }
$n = (Get-ChildItem -Recurse -File -Force $ziel).Count
Write-Output "$n Dateien in $ziel"
