<?php
session_start();
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Conectando...</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #efeae2;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            text-align: center;
        }
        .spinner {
            width: 50px;
            height: 50px;
            border: 5px solid rgba(0, 0, 0, 0.2);
            border-top: 5px solid #0b81ff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-top: 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <h1>Conectando el bot...</h1>
    <p>Esto puede tardar unos segundos.</p>
    <div class="spinner"></div>

    <script>
        function checkBotConnected() {
            fetch('check_status.php') // Verifica el estado del bot
                .then(response => response.json())
                .then(data => {
                    if (data.status === "connected") {
                        window.location.href = "dashboard.php"; // Redirige al panel de control
                    }
                })
                .catch(error => console.error("Error verificando el estado:", error));
        }
        setInterval(checkBotConnected, 3000); // Verifica el estado cada 3 segundos
    </script>
</body>
</html>
 