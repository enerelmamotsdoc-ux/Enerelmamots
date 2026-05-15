$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
& "C:\Python314\python.exe" -m http.server 5500 --bind 127.0.0.1
