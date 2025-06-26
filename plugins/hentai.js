import { isNSFWEnabled } from './nsfw.js';
import fetch from 'node-fetch';

export default function hentaiPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages?.[0];
    if (!msg?.message) return;

    const from = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      '';

    if (!text.toLowerCase().startsWith('!hentai')) return;

    if (!isNSFWEnabled(from)) {
      await sock.sendMessage(from, {
        text: '❌ Los comandos NSFW están desactivados en este chat. Usa *!nsfw on* para habilitarlos.',
        quoted: msg,
      });
      return;
    }

    try {
      const res = await fetch('https://api.waifu.pics/nsfw/hentai');
      if (!res.ok) throw new Error('Error al obtener la imagen');

      const data = await res.json();

      if (!data || !data.url) {
        throw new Error('No se encontró la imagen');
      }

      await sock.sendMessage(from, {
        image: { url: data.url },
        caption: '🔞 Hentai random para ti',
        quoted: msg,
      });

    } catch (err) {
      console.error('Error en comando hentai:', err);
      await sock.sendMessage(from, {
        text: '❌ No se pudo obtener la imagen hentai. Intenta más tarde.',
        quoted: msg,
      });
    }
  });
}
