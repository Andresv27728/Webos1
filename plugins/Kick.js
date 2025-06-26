// kick.js

export default function kickCommand(sock) {
  const OWNER_NUMBER = '5212345678901@s.whatsapp.net';

  function getGroupAdmins(participants = []) {
    return participants.filter(p => p.admin).map(p => p.id);
  }

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages?.[0];
    if (!msg?.message || msg.key?.fromMe) return;

    const from = msg.key.remoteJid;
    if (!from || !from.endsWith('@g.us')) return; // Solo grupos

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      msg.message.videoMessage?.caption ||
      '';

    if (!text.toLowerCase().startsWith('!kick')) return;

    try {
      const metadata = await sock.groupMetadata(from);
      const sender = msg.key.participant || msg.key.remoteJid;
      const groupAdmins = getGroupAdmins(metadata.participants);
      const isUserAdmin = groupAdmins.includes(sender);
      const isOwner = sender === OWNER_NUMBER;
      const isBotAdmin = metadata.participants.find(p => p.id === sock.user.id)?.admin;

      if (!isUserAdmin && !isOwner) {
        return await sock.sendMessage(from, {
          text: '❌ *Solo los administradores o el dueño pueden usar este comando.*',
          quoted: msg
        });
      }

      if (!isBotAdmin) {
        return await sock.sendMessage(from, {
          text: '⚠️ *No tengo permisos para expulsar usuarios porque no soy administrador.*',
          quoted: msg
        });
      }

      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      if (mentioned.length === 0) {
        return await sock.sendMessage(from, {
          text: '❌ *Debes mencionar al usuario que deseas expulsar.*\n\nEjemplo: `!kick @usuario`',
          quoted: msg
        });
      }

      let resultMessage = '';

      for (const userId of mentioned) {
        const isTargetAdmin = groupAdmins.includes(userId);
        const userTag = `@${userId.split('@')[0]}`;

        if (isTargetAdmin && !isOwner) {
          resultMessage += `⚠️ No puedes expulsar a ${userTag} porque es administrador.\n`;
          continue;
        }

        try {
          await sock.groupParticipantsUpdate(from, [userId], 'remove');
          resultMessage += `✅ ${userTag} fue expulsado correctamente.\n`;
        } catch (error) {
          resultMessage += `❌ No se pudo expulsar a ${userTag}.\n`;
          console.error(`Error expulsando a ${userTag}:`, error);
        }
      }

      await sock.sendMessage(from, {
        text: resultMessage.trim(),
        mentions: mentioned,
        quoted: msg
      });
    } catch (err) {
      console.error('❌ Error en el comando !kick:', err);
      await sock.sendMessage(from, {
        text: '❌ *Ocurrió un error al intentar expulsar. Intenta nuevamente o revisa los permisos.*',
        quoted: msg
      });
    }
  });
}
