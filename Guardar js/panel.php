<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Panel Moderador</title>
    <style>
        body { font-family: Arial; padding: 30px; }
        input, button { padding: 10px; font-size: 16px; }
        #qrContainer img { margin-top: 20px; width: 300px; }
        #estado { margin-top: 20px; font-weight: bold; color: green; }
    </style>
</head>
<body>

    <h1>Panel Moderador</h1>
    <input type="text" id="usuario" placeholder="Nombre de sesión">
    <button onclick="iniciarSesion()">Iniciar sesión</button>

    <div id="estado"></div>
    <div id="qrContainer"></div>

    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <script>
        const socket = io("http://localhost:3000");

        function iniciarSesion() {
            const usuario = document.getElementById('usuario').value.trim();
            if (!usuario) return alert("Escribe un nombre de sesión");

            document.getElementById('estado').textContent = '🔄 Iniciando sesión...';
            document.getElementById('qrContainer').innerHTML = '';

            socket.emit('iniciar', usuario);

            socket.on('qr', (qrUrl) => {
                const img = document.createElement('img');
                img.src = qrUrl;
                img.alt = 'QR';
                const qrContainer = document.getElementById('qrContainer');
                qrContainer.innerHTML = '';
                qrContainer.appendChild(img);
            });

            socket.on('estado', (estado) => {
                document.getElementById('estado').textContent = estado;
            });
        }
    </script>

</body>
</html>
