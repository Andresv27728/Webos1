const antiBotGroups = new Set(); // Grupos con antibot activado

export default function antiBotPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid.endsWith('@g.us')) return;

    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const args = body.trim().split(/ +/);
    const command = args.shift()?.toLowerCase();
    const subCommand = args[0]?.toLowerCase();

    if (command === '!antibot') {
      try {
        const metadata = await sock.groupMetadata(from);
        const participants = metadata.participants;

        const isAdmin = participants.some(p => p.id === sender && p.admin);
        const isBotAdmin = participants.some(p => p.id === sock.user.id.split(':')[0] + '@s.whatsapp.net' && p.admin);

        if (!isAdmin) {
          return await sock.sendMessage(from, {
            text: '⛔ Solo los *administradores* pueden usar este comando.'
          }, { quoted: msg });
        }

        if (!isBotAdmin) {
          return await sock.sendMessage(from, {
            text: '⚠️ Necesito ser *administrador* para poder expulsar bots.'
          }, { quoted: msg });
        }

        if (subCommand === 'on') {
          antiBotGroups.add(from);
          return await sock.sendMessage(from, {
            text: '✅ *Anti-Bot activado*.\nBots nuevos sospechosos serán expulsados automáticamente.'
          }, { quoted: msg });
        }

        if (subCommand === 'off') {
          antiBotGroups.delete(from);
          return await sock.sendMessage(from, {
            text: '❌ *Anti-Bot desactivado*.'
          }, { quoted: msg });
        }

        return await sock.sendMessage(from, {
          text: 'ℹ️ Usa:\n*!antibot on* → Activa el sistema antibot\n*!antibot off* → Desactiva el sistema antibot'
        }, { quoted: msg });

      } catch (err) {
        console.error('[ANTIBOT] ❌ Error en comando:', err);
      }
    }
  });

  sock.ev.on('group-participants.update', async (update) => {
    const { id: groupId, participants, action } = update;
    if (action !== 'add' || !antiBotGroups.has(groupId)) return;

    try {
      const metadata = await sock.groupMetadata(groupId);
      const groupParticipants = metadata.participants;
      const isBotAdmin = groupParticipants.some(p => p.id === sock.user.id.split(':')[0] + '@s.whatsapp.net' && p.admin);
      if (!isBotAdmin) return;

      for (const user of participants) {
        const userId = user;

        // Heurística de detección de bots sospechosos
        const isSuspicious =
          userId.includes('bot') ||
          isNaN(userId.replace(/\D/g, '')) || // No es solo número
          userId.length < 12 ||
          userId.length > 20;

        if (isSuspicious) {
          await sock.groupParticipantsUpdate(groupId, [userId], 'remove');
          console.log(`[ANTIBOT] 🚫 Usuario bot expulsado: ${userId}`);
          await sock.sendMessage(groupId, {
            text: `⚠️ Usuario sospechoso expulsado automáticamente: @${userId.split('@')[0]}`,
            mentions: [userId]
          });
        }
      }
    } catch (err) {
      console.error('[ANTIBOT] ❌ Error al expulsar posible bot:', err);
    }
  });
}
