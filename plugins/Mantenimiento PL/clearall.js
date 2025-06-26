export default function clearAllPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages?.[0];
    if (!msg?.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text || '';

    // Solo responde si es grupo y empieza con "!clearall"
    if (!text.toLowerCase().startsWith('!clearall') || !from.endsWith('@g.us')) return;

    try {
      // Obtener participantes y validar admins
      const metadata = await sock.groupMetadata(from);
      const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
      const sender = msg.key.participant || msg.key.remoteJid;

      const isBotAdmin = metadata.participants.some(p => p.id === botNumber && p.admin);
      const isUserAdmin = metadata.participants.some(p => p.id === sender && p.admin);

      if (!isBotAdmin) {
        await sock.sendMessage(from, {
          text: '⚠️ No puedo ejecutar el comando porque *no soy administrador* del grupo.',
          quoted: msg,
        });
        return;
      }

      if (!isUserAdmin) {
        await sock.sendMessage(from, {
          text: '❌ Solo los *administradores* del grupo pueden usar este comando.',
          quoted: msg,
        });
        return;
      }

      // Cargar los mensajes recientes del grupo (últimos 100)
      const history = await sock.groupMessages(from, 100);

      await sock.sendMessage(from, {
        text: `🧹 Borrando ${history.length} mensajes recientes del grupo...`,
        quoted: msg,
      });

      // Eliminar cada mensaje individualmente
      for (const m of history) {
        if (m.key.id && !m.key.fromMe) {
          await sock.sendMessage(from, {
            delete: {
              remoteJid: from,
              fromMe: false,
              id: m.key.id,
              participant: m.key.participant,
            },
          });
        }
      }

      await sock.sendMessage(from, {
        text: '✅ Todos los mensajes recientes han sido eliminados del grupo.',
      });
    } catch (err) {
      console.error('[clearall] Error:', err);
      await sock.sendMessage(from, {
        text: '❌ Hubo un error al intentar eliminar los mensajes.',
        quoted: msg,
      });
    }
  });
}
