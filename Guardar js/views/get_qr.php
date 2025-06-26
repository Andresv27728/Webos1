<?php
$qrImagePath = "qr_code.png"; // Imagen generada por index.js
if (file_exists($qrImagePath)) {
    echo $qrImagePath;
} else {
    echo "";
}
?>
