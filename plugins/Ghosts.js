   import fs from 'fs';

export default async function ghostPlugin(sock) {
  const dbFile = './Categorizador/db/ghosts.json';
  if (!fs.existsSync('./db')) fs.mkdirSync('./db');
  if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, JSON.stringify({}));

  let ghostData = JSON.parse(fs.readFileSync(dbFile));
  const saveData = () => fs.writeFileSync(dbFile, JSON.stringify(ghostData, null, 2));

  const isAdmin = async (jid, userId) => {
    const metadata = await sock.groupMetadata(jid);
    const adminList = metadata.participants.filter(p => p.admin).map(p => p.id);
    return adminList.includes(userId);
  };

  const parseThreshold = (text) => {
    const match = text.match(/^(\d+)([dh])$/);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2];
    return unit === 'd' ? value * 24 * 60 * 60 * 1000 : value * 60 * 60 * 1000;
  };

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || !m.key.remoteJid.endsWith('@g.us')) return;

    const groupId = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;
    const body = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
    const args = body.trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    // Registrar actividad
    if (ghostData[groupId]?.enabled) {
      if (!ghostData[groupId].users) ghostData[groupId].users = {};
      if (!ghostData[groupId].warnings) ghostData[groupId].warnings = {};

      if (!ghostData[groupId].users[sender]) {
        ghostData[groupId].users[sender] = { lastSeen: Date.now(), count: 1 };
      } else {
        ghostData[groupId].users[sender].lastSeen = Date.now();
        ghostData[groupId].users[sender].count += 1;
      }
      saveData();
    }

    // Solo responder si es comando !ghost
    if (command !== '!ghost') return;

    const admin = await isAdmin(groupId, sender);
    if (!admin) {
      return await sock.sendMessage(groupId, { text: '❌ Solo los *administradores* pueden usar este comando.' }, { quoted: m });
    }

    const sub = args[0]?.toLowerCase();

    if (sub === 'on') {
      ghostData[groupId] = {
        enabled: true,
        users: {},
        warnings: {},
        threshold: 3 * 24 * 60 * 60 * 1000
      };
      saveData();
      return await sock.sendMessage(groupId, { text: '✅ Sistema de fantasmas *activado* en este grupo.' }, { quoted: m });

    } else if (sub === 'off') {
      delete ghostData[groupId];
      saveData();
      return await sock.sendMessage(groupId, { text: '❎ Sistema de fantasmas *desactivado* en este grupo.' }, { quoted: m });

    } else if (sub === 'threshold') {
      const raw = args[1];
      const parsed = parseThreshold(raw);
      if (!parsed) {
        return await sock.sendMessage(groupId, { text: '⚠️ Usa un formato válido: `!ghost threshold 5d` o `12h`.' }, { quoted: m });
      }
      ghostData[groupId].threshold = parsed;
      saveData();
      return await sock.sendMessage(groupId, { text: `⏳ Umbral actualizado a *${raw}*.` }, { quoted: m });

    } else if (['mention', 'kick', 'warn'].includes(sub)) {
      if (!ghostData[groupId]?.enabled) {
        return await sock.sendMessage(groupId, { text: '⚠️ El sistema de fantasmas no está activado.' }, { quoted: m });
      }

      const metadata = await sock.groupMetadata(groupId);
      const now = Date.now();
      const inactive = [];

      for (const participant of metadata.participants) {
        const id = participant.id;
        if (id === sock.user.id) continue;

        const user = ghostData[groupId].users?.[id];
        const isInactive =
          !user ||
          (now - user.lastSeen > ghostData[groupId].threshold) ||
          user.count < 3;

        if (isInactive) inactive.push(id);
      }

      if (inactive.length === 0) {
        return await sock.sendMessage(groupId, { text: '🎉 No hay fantasmas. Todos están activos.' }, { quoted: m });
      }

      if (sub === 'mention') {
        return await sock.sendMessage(groupId, {
          text: '👻 *Usuarios inactivos detectados:*\nDeben participar más en el grupo.',
          mentions: inactive
        }, { quoted: m });
      }

      if (sub === 'warn') {
        for (const id of inactive) {
          if (!ghostData[groupId].warnings[id]) ghostData[groupId].warnings[id] = 0;
          ghostData[groupId].warnings[id] += 1;
        }
        saveData();
        return await sock.sendMessage(groupId, {
          text: `⚠️ Se han enviado advertencias a los inactivos. Usen *!ghost kick* si ya tienen 2 advertencias.`,
          mentions: inactive
        }, { quoted: m });
      }

      if (sub === 'kick') {
        const toKick = inactive.filter(id => (ghostData[groupId].warnings[id] || 0) >= 2);
        if (toKick.length === 0) {
          return await sock.sendMessage(groupId, { text: '⚠️ Nadie tiene suficientes advertencias para ser expulsado.' }, { quoted: m });
        }

        for (const id of toKick) {
          try {
            await sock.groupParticipantsUpdate(groupId, [id], 'remove');
            delete ghostData[groupId].users[id];
            delete ghostData[groupId].warnings[id];
          } catch (e) {
            console.log(`❌ Error al expulsar ${id}`);
          }
        }

        saveData();
        return await sock.sendMessage(groupId, {
          text: `🔨 Expulsados ${toKick.length} fantasmas tras múltiples advertencias.`,
        }, { quoted: m });
      }

    } else if (sub === 'resetwarnings') {
      ghostData[groupId].warnings = {};
      saveData();
      return await sock.sendMessage(groupId, { text: '🔁 Advertencias reiniciadas para todos los miembros.' }, { quoted: m });

    } else {
      return await sock.sendMessage(groupId, {
        text:
`📘 *Comandos disponibles:*
!ghost on – Activa el sistema.
!ghost off – Desactiva el sistema.
!ghost threshold 5d – Cambia el umbral.
!ghost mention – Menciona a los inactivos.
!ghost warn – Envía advertencias a los inactivos.
!ghost kick – Expulsa fantasmas con 2 advertencias.
!ghost resetwarnings – Limpia advertencias.`,
      }, { quoted: m });
    }
  });
}
