import fs from 'fs'; 
import path from 'path';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import fetch from 'node-fetch'; // Asegúrate de tenerlo instalado

const picBackupFolder = './Categorizador/group_pics';
if (!fs.existsSync(picBackupFolder)) fs.mkdirSync(picBackupFolder);

export default function groupPicManagerPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages?.[0];
    if (!msg || !msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const sender = msg.key.participant || msg.key.remoteJid;

    const body =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      '';

    // ====================
    // 1. CAMBIAR LA FOTO
    // ====================
    if (body?.toLowerCase() === '!setpic' && isGroup) {
      const quotedMsg =
        msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      const quotedKey =
        msg.message?.extendedTextMessage?.contextInfo?.stanzaId;

      const participant =
        msg.message?.extendedTextMessage?.contextInfo?.participant;

      if (!quotedMsg || !quotedMsg.imageMessage || !quotedKey || !participant) {
        await sock.sendMessage(from, {
          text: '❌ Debes responder a una *imagen* con el comando *!setpic*.',
          quoted: msg,
        });
        return;
      }

      try {
        // ✅ 1. GUARDAR FOTO ACTUAL
        const groupPPUrl = await sock.profilePictureUrl(from, 'image');
        const backupPath = path.join(picBackupFolder, `${from}.jpeg`);

        if (groupPPUrl) {
          const res = await fetch(groupPPUrl);
          const buffer = await res.arrayBuffer();
          fs.writeFileSync(backupPath, Buffer.from(buffer));
        }

        // ✅ 2. DESCARGAR NUEVA IMAGEN
        const mediaBuffer = await downloadMediaMessage(
          {
            key: {
              remoteJid: from,
              id: quotedKey,
              participant,
            },
            message: quotedMsg,
          },
          'buffer',
          {},
          { logger: console }
        );

        // ✅ 3. CAMBIAR FOTO DEL GRUPO
        await sock.updateProfilePicture(from, mediaBuffer);
        await sock.sendMessage(from, {
          text: `✅ Foto de grupo actualizada. Copia anterior guardada.`,
          mentions: [sender],
        });
      } catch (err) {
        console.error('❌ Error al cambiar foto:', err);
        await sock.sendMessage(from, {
          text: '❌ No se pudo cambiar la foto. ¿El bot es admin?',
          quoted: msg,
        });
      }
    }

    // ====================
    // 2. RESTAURAR LA FOTO
    // ====================
    if (body?.toLowerCase() === '!restorepic' && isGroup) {
      const backupPath = path.join(picBackupFolder, `${from}.jpeg`);

      if (!fs.existsSync(backupPath)) {
        await sock.sendMessage(from, {
          text: '❌ No hay copia guardada para este grupo.',
          quoted: msg,
        });
        return;
      }

      try {
        const imageBuffer = fs.readFileSync(backupPath);
        await sock.updateProfilePicture(from, imageBuffer);
        await sock.sendMessage(from, {
          text: `🔁 Foto de grupo restaurada correctamente.`,
        });
      } catch (err) {
        console.error('❌ Error al restaurar foto:', err);
        await sock.sendMessage(from, {
          text: '❌ No se pudo restaurar la foto. ¿El bot es admin?',
          quoted: msg,
        });
      }
    }
  });
}
