import { makeWASocket, useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import qrcode from 'qrcode';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sesionesPath = path.join(__dirname, 'sessions');
const pluginsPath = path.join(__dirname, 'plugins');
const qrPath = path.join(__dirname, 'qr');

if (!fs.existsSync(sesionesPath)) fs.mkdirSync(sesionesPath, { recursive: true });
if (!fs.existsSync(qrPath)) fs.mkdirSync(qrPath, { recursive: true });

const logger = pino({ level: 'silent' });

async function cargarPlugins(sock) {
    if (!fs.existsSync(pluginsPath)) return;

    const archivos = fs.readdirSync(pluginsPath).filter(f => f.endsWith('.js'));

    for (const archivo of archivos) {
        const plugin = await import(`file://${path.join(pluginsPath, archivo)}`);
        if (typeof plugin.default === 'function') {
            plugin.default(sock);
            console.log(`✅ Plugin de moderador cargado: ${archivo}`);
        }
    }
}

export async function iniciarSesion(nombre, io) {
    const rutaSesion = path.join(sesionesPath, nombre);
    const { state, saveCreds } = await useMultiFileAuthState(rutaSesion);

    const sock = makeWASocket({
        auth: state,
        logger,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async ({ connection, qr }) => {
        if (qr) {
            const qrFile = path.join(qrPath, `${nombre}.png`);
            await qrcode.toFile(qrFile, qr);
            io.to(nombre).emit('qr', qr);
        }

        if (connection === 'open') {
            io.to(nombre).emit('estado', `✅ Moderador conectado: ${nombre}`);
            await cargarPlugins(sock);
        }

        if (connection === 'close') {
            io.to(nombre).emit('estado', '❌ Sesión cerrada');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        console.log(`📩 [${nombre}] ${msg.message?.conversation || '[otro tipo]'}`);
    });
}
