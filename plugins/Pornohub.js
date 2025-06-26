import { isNSFWEnabled } from './nsfw.js'; // Asegúrate de que la ruta sea correcta
import fetch from 'node-fetch'; // Asegúrate de tener esto instalado con npm

export default function phPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages?.[0];
    if (!msg?.message) return;

    const from = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      '';

    if (!text.startsWith('!ph ')) return;

    // NSFW debe estar habilitado
    if (!isNSFWEnabled(from)) {
      await sock.sendMessage(from, {
        text: '❌ Los comandos NSFW están desactivados en este chat. Usa *!nsfw on* para habilitarlos.',
        quoted: msg,
      });
      return;
    }

    const link = text.split(' ')[1];
    if (!link || !link.startsWith('http')) {
      await sock.sendMessage(from, {
        text: '⚠️ Debes proporcionar un enlace válido. Ejemplo:\n*!ph https://www.pornhub.com/view_video.php?viewkey=xyz*',
        quoted: msg,
      });
      return;
    }

    // Aquí simulamos la descarga con una API de terceros ficticia
    try {
      const apiUrl = `https://api.lanapi.xyz/phdl?url=${encodeURIComponent(link)}`;
      const res = await fetch(apiUrl);
      const data = await res.json();

      if (!data || !data.video || !data.title) {
        throw new Error('No se pudo extraer el video');
      }

      await sock.sendMessage(from, {
        text: `🔞 *${data.title}*\nEnlace directo:\n${data.video}`,
        quoted: msg,
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(from, {
        text: '❌ No se pudo descargar el video. Puede que el enlace no sea válido o el servidor esté caído.',
        quoted: msg,
      });
    }
  });
}
