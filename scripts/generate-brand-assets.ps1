param(
  [Parameter(Mandatory = $true)]
  [string]$Source
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies "System.Drawing" -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class TranqlyImageTools {
  public static Bitmap ForceOpaque(Bitmap source) {
    var output = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb);
    var rect = new Rectangle(0, 0, output.Width, output.Height);
    var sourceData = source.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    var outputData = output.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
    try {
      var bytes = Math.Abs(sourceData.Stride) * sourceData.Height;
      var pixels = new byte[bytes];
      Marshal.Copy(sourceData.Scan0, pixels, 0, bytes);
      for (var index = 3; index < bytes; index += 4) pixels[index] = 255;
      Marshal.Copy(pixels, 0, outputData.Scan0, bytes);
    } finally {
      source.UnlockBits(sourceData);
      output.UnlockBits(outputData);
    }
    return output;
  }
}
"@

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
$image = [System.Drawing.Bitmap]::FromStream($sourceStream)
$opaqueImage = [TranqlyImageTools]::ForceOpaque($image)
try {
  $outputs = @(
    @{ Path = "public\tranqly_logo.png"; Size = 1024 },
    @{ Path = "public\icons\icon-192.png"; Size = 192; Opaque = $true },
    @{ Path = "public\icons\icon-512.png"; Size = 512; Opaque = $true },
    @{ Path = "public\icons\apple-touch-icon.png"; Size = 180; Opaque = $true },
    @{ Path = "apps\mobile\assets\icon.png"; Size = 1024; Opaque = $true },
    @{ Path = "apps\mobile\assets\images\icon.png"; Size = 1024; Opaque = $true },
    @{ Path = "apps\mobile\assets\images\adaptive-icon.png"; Size = 1024; Opaque = $true },
    @{ Path = "apps\mobile\assets\images\tranqly_logo.png"; Size = 512 },
    @{ Path = "apps\mobile\assets\splash.png"; Size = 1024 },
    @{ Path = "apps\mobile\assets\images\splash.png"; Size = 1024 }
  )

  foreach ($output in $outputs) {
    $destination = Join-Path $root $output.Path
    $sourceImage = if ($output.Opaque) { $opaqueImage } else { $image }
    Write-ResizedPng -Image $sourceImage -Destination $destination -Size $output.Size
    Write-Output "Generated $($output.Path) ($($output.Size)x$($output.Size))"
  }

  $faviconPng = Join-Path $root "public\icons\favicon-64.png"
  Write-ResizedPng -Image $image -Destination $faviconPng -Size 64
  Write-PngIco -PngPath $faviconPng -Destination (Join-Path $root "public\favicon.ico") -Size 64
  Remove-Item -LiteralPath $faviconPng
  Write-Output "Generated public\favicon.ico (64x64)"
}
finally {
  $opaqueImage.Dispose()
  $image.Dispose()
  $sourceStream.Dispose()
}
