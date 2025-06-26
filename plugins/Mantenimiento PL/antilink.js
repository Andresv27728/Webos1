import fs from 'fs';
import { getGroupMetadataCached } from '../utils/groupCache.js';

const dbPath = './Categorizador/db/antilink.json';

function loadAntiLinkData() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({}));
  }
  return JSON.parse(fs.readFileSync(dbPath));
}

function saveAntiLinkData(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

export default function antilinkPlugin(sock) {
  const antiLinkData = loadAntiLinkData();

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    const from = m.key.remoteJid;
    if (!from || !from.endsWith('@g.us')) return;

    const body =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      m.message.imageMessage?.caption ||
      m.message.videoMessage?.caption ||
      '';

    const sender = m.key.participant || m.key.remoteJid;

    const metadata = await getGroupMetadataCached(sock, from);
    if (!metadata) return;

    const participants = metadata.participants;

    const senderData = participants.find(p => p.id === sender);
    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const botData = participants.find(p => p.id === botId);

    const isAdmin = senderData?.admin === 'admin' || senderData?.admin === 'superadmin';
    const isBotAdmin = botData?.admin === 'admin' || botData?.admin === 'superadmin';

    const command = body.trim().toLowerCase();

    // Activar/desactivar antilink
    if (command === 'antilink on' || command === 'antilink off') {
      if (!isAdmin) {
        await sock.sendMessage(from, {
          text: '❌ Solo los administradores pueden usar este comando.',
        }, { quoted: m });
        return;
      }

      const status = command === 'antilink on';
      antiLinkData[from] = status;
      saveAntiLinkData(antiLinkData);

      await sock.sendMessage(from, {
        text: `✅ Anti-link ha sido *${status ? 'activado' : 'desactivado'}* correctamente.`,
      }, { quoted: m });
      return;
    }

    // AntiLink activo
    if (antiLinkData[from]) {
      const hasLink = /(https?:\/\/|wa\.me\/|chat\.whatsapp\.com\/|t\.me\/|discord\.gg\/)/i.test(body);

      if (hasLink && !isAdmin) {
        if (!isBotAdmin) {
          await sock.sendMessage(from, {
            text: '⚠️ No puedo eliminar el mensaje porque no soy administrador.',
          }, { quoted: m });
          return;
        }

        try {
          await sock.sendMessage(from, {
            delete: {
              remoteJid: from,
              fromMe: false,
              id: m.key.id,
              participant: sender
            }
          });

          await sock.sendMessage(from, {
            text: `🚫 Se eliminó un mensaje con enlace de @${sender.split('@')[0]}`,
            mentions: [sender]
          });
        } catch (e) {
          console.error('❌ Error al eliminar el mensaje:', e);
        }
      }
    }
  });
}
