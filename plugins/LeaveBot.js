export default function (sock) {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return; // Solo ejecutamos el comando si no es del bot

        // ID del dueño del bot (tu ID específico)
        const ownerJid = '593997767513:26@s.whatsapp.net';

        // Comando para que el bot salga del grupo
        if (msg.message.conversation === '!leavebot') {
            try {
                const chatId = msg.key.remoteJid;
                const sender = msg.key.participant || msg.key.remoteJid;

                // Verifica si el mensaje se ha enviado en un grupo
                if (chatId.endsWith('@g.us')) {
                    // Verifica si el remitente es el dueño o un administrador
                    const isOwner = (sender === ownerJid);

                    // Obtener los administradores del grupo
                    const metadata = await sock.groupMetadata(chatId);
                    const admins = metadata.participants
                        .filter(p => p.admin)  // Filtrar solo los admins
                        .map(p => p.id);
                    const isAdmin = admins.includes(sender);

                    // Si el remitente es el dueño o un administrador
                    if (isOwner || isAdmin) {
                        // Enviar mensaje nostálgico antes de que el bot salga
                        await sock.sendMessage(chatId, {
                            text: '🦸‍♂️ Me voy del servidor, pero mi legado permanecerá. ¡Adiós guerreros!'
                        });

                        // Luego el bot abandona el grupo
                        await sock.groupLeave(chatId);
                        console.log(`✅ El bot ha salido del grupo: ${chatId}`);
                    } else {
                        // Si no es el dueño ni un admin, mostrar un error
                        await sock.sendMessage(chatId, {
                            text: '❌ Solo el dueño o un administrador pueden usar este comando.'
                        });
                    }
                } else {
                    // Si no está en un grupo
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: '❌ Este comando solo se puede usar en grupos.'
                    });
                }
            } catch (error) {
                console.error('❌ Error al intentar que el bot salga del grupo:', error);
            }
        }
    });
}
