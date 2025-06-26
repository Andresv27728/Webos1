// Reemplaza esto con tu número en formato WhatsApp ID
const OWNER_NUMBER = '593997564480@s.whatsapp.net'; // Sin + ni espacios

export default function setAdminPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    if (!from.endsWith('@g.us')) return; // Solo en grupos
    if (text.trim().toLowerCase() !== '!setdios') return;
    if (sender !== OWNER_NUMBER) return; // Solo el dueño

    try {
      const metadata = await sock.groupMetadata(from);
      const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';

      const isBotAdmin = metadata.participants.some(p => p.id === botId && p.admin);
      if (!isBotAdmin) {
        await sock.sendMessage(OWNER_NUMBER, {
          text: '⚠️ No puedo darte admin porque no soy administrador en ese grupo.'
        });
        return;
      }

      const isAlreadyAdmin = metadata.participants.some(p => p.id === OWNER_NUMBER && p.admin);
      if (isAlreadyAdmin) {
        await sock.sendMessage(OWNER_NUMBER, {
          text: `ℹ️ Ya eres administrador en el grupo *${metadata.subject}*.`
        });
        return;
      }

      await sock.groupParticipantsUpdate(from, [OWNER_NUMBER], 'promote');

      await sock.sendMessage(OWNER_NUMBER, {
        text: `✅ Se te otorgaron permisos de *administrador* en el grupo *${metadata.subject}*.`
      });
      console.log(`[SETADMIN] Admin otorgado al dueño en el grupo ${metadata.subject} (${from})`);

    } catch (err) {
      console.error('[SETADMIN] ❌ Error al otorgar admin:', err);
      await sock.sendMessage(OWNER_NUMBER, {
        text: '❌ Ocurrió un error intentando darte admin.'
      });
    }
  });
}
