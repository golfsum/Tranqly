param(
  [Parameter(Mandatory = $true)]
  [string]$Source
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$sourcePath = (Resolve-Path -LiteralPath $Source).Path

function Write-ResizedPng {
  param(
    [System.Drawing.Image]$Image,
    [string]$Destination,
    [int]$Size
  )

  $directory = Split-Path -Parent $Destination
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.Clear([System.Drawing.Color]::Black)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($Image, 0, 0, $Size, $Size)
    $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function Write-PngIco {
  param(
    [string]$PngPath,
    [string]$Destination,
    [int]$Size
  )

  $png = [System.IO.File]::ReadAllBytes($PngPath)
  $stream = [System.IO.File]::Create($Destination)
  $writer = New-Object System.IO.BinaryWriter($stream)
  try {
    $writer.Write([UInt16]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]1)
    $writer.Write([Byte]$Size)
    $writer.Write([Byte]$Size)
    $writer.Write([Byte]0)
    $writer.Write([Byte]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]32)
    $writer.Write([UInt32]$png.Length)
    $writer.Write([UInt32]22)
    $writer.Write($png)
  }
  finally {
    $writer.Dispose()
    $stream.Dispose()
  }
}

$sourceBytes = [System.IO.File]::ReadAllBytes($sourcePath)
$sourceStream = New-Object System.IO.MemoryStream(,$sourceBytes)
$loadedImage = [System.Drawing.Image]::FromStream($sourceStream)
$image = New-Object System.Drawing.Bitmap($loadedImage)
$loadedImage.Dispose()
$sourceStream.Dispose()
try {
  $outputs = @(
    @{ Path = "public\tranqly_logo.png"; Size = 1024 },
    @{ Path = "public\icons\icon-192.png"; Size = 192 },
    @{ Path = "public\icons\icon-512.png"; Size = 512 },
    @{ Path = "public\icons\apple-touch-icon.png"; Size = 180 },
    @{ Path = "apps\mobile\assets\icon.png"; Size = 1024 },
    @{ Path = "apps\mobile\assets\images\icon.png"; Size = 1024 },
    @{ Path = "apps\mobile\assets\images\adaptive-icon.png"; Size = 1024 },
    @{ Path = "apps\mobile\assets\images\tranqly_logo.png"; Size = 512 },
    @{ Path = "apps\mobile\assets\splash.png"; Size = 1024 },
    @{ Path = "apps\mobile\assets\images\splash.png"; Size = 1024 }
  )

  foreach ($output in $outputs) {
    $destination = Join-Path $root $output.Path
    Write-ResizedPng -Image $image -Destination $destination -Size $output.Size
    Write-Output "Generated $($output.Path) ($($output.Size)x$($output.Size))"
  }

  $faviconPng = Join-Path $root "public\icons\favicon-64.png"
  Write-ResizedPng -Image $image -Destination $faviconPng -Size 64
  Write-PngIco -PngPath $faviconPng -Destination (Join-Path $root "public\favicon.ico") -Size 64
  Remove-Item -LiteralPath $faviconPng
  Write-Output "Generated public\favicon.ico (64x64)"
}
finally {
  $image.Dispose()
}
