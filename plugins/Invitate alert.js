// plugins/group-invite-detector.js
const OWNER_JID = '593997564480@s.whatsapp.net'; // <-- Cambia este JID por el tuyo real

const INVITE_REGEX = /chat\.whatsapp\.com\/[A-Za-z0-9]{22}/;

export default function (sock) {
  // ✅ 1. Detección de invitaciones por privado
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    if (isGroup) return; // Solo en privado

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.groupInviteMessage?.groupJid ||
      '';

    const hasInvite =
      INVITE_REGEX.test(text) || msg.message?.groupInviteMessage;

    if (!hasInvite) return;

    const userJid = msg.key.participant || msg.key.remoteJid;

    if (userJid === OWNER_JID) return; // Si eres tú, no hacer nada

    const response = `
🔔 *Hemos detectado una nueva invitación de grupo*

Si deseas unir al bot a tu grupo debes cumplir con los siguientes requisitos:

1. Tener más de *20 miembros*
2. Seguir el *canal oficial del bot*
3. *Respetar las normas de WhatsApp*

🕒 *La unión del bot puede tardar unos días*, ya que revisamos manualmente.

📌 Uno de nuestros administradores revisará tu grupo para aprobarlo.

🙏 *Gracias por tu paciencia*.
`;

    await sock.sendMessage(from, { text: response });

    const alert = `
🚨 *Nueva invitación a grupo detectada*

• Usuario: @${userJid.split('@')[0]}
• Enlace o invitación detectada:
${text}

🔍 Revisión pendiente.
`;

    await sock.sendMessage(OWNER_JID, {
      text: alert.trim(),
      mentions: [userJid],
    });
  });

  // ✅ 2. Detección de expulsión del bot con información del expulsador
  sock.ev.on('group-participants.update', async (update) => {
    const { id: groupId, participants, action, actor } = update;

    // Si el bot fue removido del grupo
    if (action === 'remove' && participants.includes(sock.user.id)) {
      const actorTag = actor ? `@${actor.split('@')[0]}` : 'Desconocido';

      const alert = `
🚫 *El bot fue eliminado de un grupo*

• Grupo: ${groupId}
• Acción: *Expulsado*
• Expulsado por: ${actorTag}

📌 Verifica si fue por error o decisión de un administrador.
`;

      await sock.sendMessage(OWNER_JID, {
        text: alert.trim(),
        mentions: actor ? [actor] : [],
      });
    }
  });

  // ✅ 3. Detección de eliminación del grupo (opcional)
  sock.ev.on('groups.update', async (updates) => {
    for (const update of updates) {
      if (update.participants === null && update.announce === true) {
        const alert = `
⚠️ *Un grupo puede haber sido eliminado por WhatsApp*

• Grupo: ${update.id}
• Estado: Posible cierre o eliminación

🔍 Verifica si aún existe o si fue suspendido.
`;
        await sock.sendMessage(OWNER_JID, { text: alert.trim() });
      }
    }
  });
}
