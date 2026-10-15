# Guarda tu APP_PASSWORD en radar/.env.radar sin mostrarla en pantalla (se ven asteriscos).
# Uso: powershell -ExecutionPolicy Bypass -File .\scripts\guardar-clave.ps1
$segura = Read-Host -Prompt 'Escribi tu clave del radar (la misma de Vercel) y apreta Enter' -AsSecureString
$puntero = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)
try {
  $clave = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($puntero).Trim()
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($puntero)
}
if (-not $clave) {
  Write-Host 'No escribiste nada. Volve a intentarlo.'
  exit 1
}
$archivo = Join-Path (Split-Path $PSScriptRoot -Parent) '.env.radar'
$texto = "# Clave de tu web del radar (la misma APP_PASSWORD que cargaste en Vercel). Este archivo no se sube a GitHub.`nAPP_PASSWORD=$clave`n"
[IO.File]::WriteAllText($archivo, $texto, (New-Object Text.UTF8Encoding $false))
Write-Host "Listo, clave guardada en $archivo"
