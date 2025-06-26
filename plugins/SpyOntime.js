import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { isPremium } from './premium.js';
import fs from 'fs';
import path from 'path';

/**
 * Determina el tipo de medio (si existe) en un mensaje citado.
 * @param {Object} quoted 
 * @returns {string|null} image | video | audio | null
 */
function getMediaType(quoted) {
  if (quoted.imageMessage) return 'image';
  if (quoted.videoMessage) return 'video';
  if (quoted.audioMessage) return 'audio';
  return null;
}

/**
 * Envía un mensaje de texto con cita.
 */
async function replyText(sock, jid, text, quoted) {
  return await sock.sendMessage(jid, { text, quoted });
}

export default function viewerPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const msg = messages?.[0];
      if (!msg || !msg.message || msg.key.fromMe) return;

      const from = msg.key.remoteJid;
      const isGroup = from.endsWith('@g.us');
      if (!isGroup) return;

      const sender = msg.key.participant || msg.key.remoteJid;
      const body = msg.message?.extendedTextMessage?.text || msg.message?.conversation || '';
      if (!body.toLowerCase().startsWith('!espiar')) return;

      // ⚠️ Validar si el usuario es premium
      if (!isPremium(sender)) {
        return await replyText(sock, from, '🚫 Este comando es exclusivo para *usuarios premium*. Contacta con el administrador.', msg);
      }

      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const quoted = contextInfo?.quotedMessage;

      if (!quoted) {
        return await replyText(sock, from, '❌ Debes responder a una *imagen, video o audio* para usar este comando.', msg);
      }

      const mediaType = getMediaType(quoted);
      if (!mediaType) {
        return await replyText(sock, from, '❌ Solo se pueden reenviar *imágenes, videos o audios*.', msg);
      }

      // ✅ Descargar el medio
      const buffer = await downloadMediaMessage(
        { message: quoted, key: { id: contextInfo.stanzaId, remoteJid: from, fromMe: false } },
        'buffer',
        {},
        {
          logger: console,
          reuploadRequest: sock.updateMediaMessage
        }
      );

      if (!buffer) {
        throw new Error('No se pudo obtener el buffer del archivo multimedia.');
      }

      // 📤 Reenviar el medio
      const mediaMsg = {
        [mediaType]: buffer,
        caption: `📎 ${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} reenviado`,
        quoted: msg
      };

      await sock.sendMessage(from, mediaMsg);

    } catch (err) {
      console.error('[viewerPlugin] Error:', err);
      if (err?.message?.includes('not a media message')) {
        return await replyText(sock, from, '❌ El mensaje citado no contiene un medio válido.', messages?.[0]);
      }
      await replyText(sock, messages?.[0]?.key?.remoteJid || '', '❌ Ocurrió un error al procesar el archivo. Inténtalo de nuevo más tarde.', messages?.[0]);
    }
  });
}
