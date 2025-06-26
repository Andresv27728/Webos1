import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { iniciarSesion } from './sessionManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Servir archivos estáticos (CSS, JS, etc.)
app.use(express.static(__dirname));

// Servir imágenes QR desde la carpeta /qr
app.use('/qr', express.static(path.join(__dirname, 'qr')));

// En la raíz servir el index.html
app.get('/', (_, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Cuando un cliente se conecta por websocket
io.on('connection', (socket) => {
    socket.on('iniciar', async (usuario) => {
        socket.join(usuario); // Canal exclusivo para este usuario
        await iniciarSesion(usuario, io); // Iniciar sesión y cargar plugins
    });
});

const PORT = process.env.PANEL_PORT || 4000;
httpServer.listen(PORT, () => {
    console.log(`🟢 Panel moderador activo en http://localhost:${PORT}`);
});
