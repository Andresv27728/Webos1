export default function promotePlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const chatId = msg.key.remoteJid;
    if (!chatId.endsWith('@g.us')) return; // Solo grupos

    const text = msg.message.conversation || 
                 msg.message.extendedTextMessage?.text || "";

    if (!text.startsWith('!promover')) return;

    try {
      const groupMetadata = await sock.groupMetadata(chatId);

      // Obtener ID limpio del bot
      const botId = sock?.user?.id?.split(':')[0]; // elimina ":19" si hay

      // Verificar si el bot es admin
      const botParticipant = groupMetadata.participants.find(p => p.id === botId);
      const botIsAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';

      if (!botIsAdmin) {
        await sock.sendMessage(chatId, { text: "❌ No puedo promover porque no soy administrador." });
        return;
      }

      // Obtener ID del usuario a promover
      const contextInfo = msg.message.extendedTextMessage?.contextInfo;
      const mentionedJid = contextInfo?.mentionedJid?.[0] || contextInfo?.participant;

      if (!mentionedJid) {
        await sock.sendMessage(chatId, { text: "⚠️ Debes mencionar o responder al usuario que quieres promover." });
        return;
      }

      // Promover
      await sock.groupParticipantsUpdate(chatId, [mentionedJid], 'promote');

      await sock.sendMessage(chatId, {
        text: `✅ @${mentionedJid.split('@')[0]} ahora es administrador.`,
        mentions: [mentionedJid]
      });

    } catch (err) {
      console.error("Error al promover:", err);
      await sock.sendMessage(chatId, { text: "⚠️ Ocurrió un error al intentar promover al usuario." });
    }
  });
}
 