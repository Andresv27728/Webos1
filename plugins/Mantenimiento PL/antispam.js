import fs from 'fs';

export default async function antispamPlugin(sock) {
  const fileDB = './Categorizador/db/antispam.json';
  if (!fs.existsSync('./db')) fs.mkdirSync('./db');
  if (!fs.existsSync(fileDB)) fs.writeFileSync(fileDB, '{}');

  let data = JSON.parse(fs.readFileSync(fileDB));

  // Configuración antispam
  const floodInterval = 5000; // 5 segundos
  const maxFloods = 5;
  const maxRepeticiones = 3;

  // Cache de metadata de grupo para evitar rate-limit
  const groupCache = new Map();

  async function getGroupMetadata(jid) {
    if (groupCache.has(jid)) return groupCache.get(jid);

    try {
      const metadata = await sock.groupMetadata(jid);
      groupCache.set(jid, metadata);
      setTimeout(() => groupCache.delete(jid), 10 * 60 * 1000); // 10 minutos
      return metadata;
    } catch (err) {
      console.error(`[ERROR] groupMetadata ${jid}:`, err);
      return null;
    }
  }

  // Guardar datos periódicamente
  setInterval(() => fs.writeFileSync(fileDB, JSON.stringify(data, null, 2)), 10000);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    const jid = m.key.remoteJid;

    if (!jid || !jid.endsWith('@g.us') || !m.message || m.key.fromMe) return;

    const sender = m.key.participant || m.participant;
    const text = m.message?.conversation || m.message?.extendedTextMessage?.text || '';

    if (!text) return;

    const metadata = await getGroupMetadata(jid);
    if (!metadata) return;

    const isAdmin = metadata.participants.find(p => p.id === sender)?.admin;
    if (isAdmin) return;

    // Inicializar datos del usuario
    if (!data[jid]) data[jid] = {};
    if (!data[jid][sender]) {
      data[jid][sender] = {
        lastTime: 0,
        lastMsg: '',
        repeticiones: 0,
        floods: 0
      };
    }

    const user = data[jid][sender];
    const now = Date.now();

    // Verificar repeticiones
    if (text === user.lastMsg) {
      user.repeticiones++;
    } else {
      user.repeticiones = 1;
    }

    // Verificar flood
    if (now - user.lastTime < floodInterval) {
      user.floods++;
    } else {
      user.floods = 1;
    }

    user.lastTime = now;
    user.lastMsg = text;

    // Sanción por spam
    if (user.repeticiones >= maxRepeticiones || user.floods >= maxFloods) {
      await sock.sendMessage(jid, {
        text: `⚠️ *Antispam:* El usuario @${sender.split('@')[0]} fue detectado por spam.`,
        mentions: [sender]
      });

      try {
        await sock.groupParticipantsUpdate(jid, [sender], 'remove');
      } catch {
        await sock.sendMessage(jid, { text: '❌ No pude expulsar al usuario (quizá no soy admin).' });
      }

      delete data[jid][sender];
    }
  });
}
