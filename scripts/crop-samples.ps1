Add-Type -AssemblyName System.Drawing

function Crop-Image($srcPath, $destPath, $x, $y, $w, $h, $targetW, $targetH) {
    $src = [System.Drawing.Bitmap]::FromFile($srcPath)
    $rect = New-Object System.Drawing.Rectangle($x, $y, $w, $h)
    $cropped = $src.Clone($rect, $src.PixelFormat)
    $src.Dispose()
    
    if ($targetW -gt 0 -and $targetH -gt 0) {
        $resized = New-Object System.Drawing.Bitmap($targetW, $targetH)
        $g = [System.Drawing.Graphics]::FromImage($resized)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.DrawImage($cropped, 0, 0, $targetW, $targetH)
        $g.Dispose()
        $cropped.Dispose()
        $cropped = $resized
    }
    
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]90)
    $cropped.Save($destPath, $codec, $encoderParams)
    $cropped.Dispose()
    Write-Host "Created: $destPath"
}

# 1. Left strip from pb_strip_1 (center strip is from x=405 to 765, y=15 to 880)
Crop-Image 'e:\Work\Solvix Studio\Work\Photobooth\public\samples\pb_strip_1.jpg' 'e:\Work\Solvix Studio\Work\Photobooth\public\samples\strip_left.jpg' 405 15 360 865 300 720

# 2. Right strip from pb_strip_2 (left strip is from x=145 to 435, y=45 to 885)
Crop-Image 'e:\Work\Solvix Studio\Work\Photobooth\public\samples\pb_strip_2.jpg' 'e:\Work\Solvix Studio\Work\Photobooth\public\samples\strip_right.jpg' 145 45 292 840 300 860

# 3. Polaroid photo cut (from pb_strip_1 first pose)
Crop-Image 'e:\Work\Solvix Studio\Work\Photobooth\public\samples\pb_strip_1.jpg' 'e:\Work\Solvix Studio\Work\Photobooth\public\samples\polaroid_sample.jpg' 430 135 310 250 300 240

# 4. 2x2 grid 4 cuts
Crop-Image 'e:\Work\Solvix Studio\Work\Photobooth\public\samples\pb_strip_1.jpg' 'e:\Work\Solvix Studio\Work\Photobooth\public\samples\grid_cut_1.jpg' 430 135 310 250 200 200
Crop-Image 'e:\Work\Solvix Studio\Work\Photobooth\public\samples\pb_strip_2.jpg' 'e:\Work\Solvix Studio\Work\Photobooth\public\samples\grid_cut_2.jpg' 175 95 235 200 200 200
Crop-Image 'e:\Work\Solvix Studio\Work\Photobooth\public\samples\pb_strip_2.jpg' 'e:\Work\Solvix Studio\Work\Photobooth\public\samples\grid_cut_3.jpg' 175 510 235 200 200 200
Crop-Image 'e:\Work\Solvix Studio\Work\Photobooth\public\samples\pb_strip_1.jpg' 'e:\Work\Solvix Studio\Work\Photobooth\public\samples\grid_cut_4.jpg' 430 500 310 250 200 200

Get-ChildItem 'e:\Work\Solvix Studio\Work\Photobooth\public\samples' | Select-Object Name, Length
