param(
  [Parameter(Mandatory = $true)][string]$ImagePath,
  [Parameter(Mandatory = $true)][string]$PrinterName,
  [int]$Copies = 1
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$image = [System.Drawing.Image]::FromFile($ImagePath)
$document = New-Object System.Drawing.Printing.PrintDocument
$document.PrinterSettings.PrinterName = $PrinterName
$document.PrinterSettings.Copies = [Math]::Max(1, [Math]::Min(10, $Copies))
$document.PrintController = New-Object System.Drawing.Printing.StandardPrintController

if (-not $document.PrinterSettings.IsValid) {
  throw "Printer '$PrinterName' tidak ditemukan atau tidak siap."
}

$document.add_PrintPage({
  param($sender, $eventArgs)
  $bounds = $eventArgs.MarginBounds
  $ratio = [Math]::Min($bounds.Width / $image.Width, $bounds.Height / $image.Height)
  $width = [int]($image.Width * $ratio)
  $height = [int]($image.Height * $ratio)
  $left = $bounds.Left + [int](($bounds.Width - $width) / 2)
  $top = $bounds.Top + [int](($bounds.Height - $height) / 2)
  $eventArgs.Graphics.DrawImage($image, $left, $top, $width, $height)
  $eventArgs.HasMorePages = $false
})

try {
  $document.Print()
} finally {
  $document.Dispose()
  $image.Dispose()
}
