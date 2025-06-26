// plugins/mentionall.js
export default function handleMyIdCommand(sock) {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages?.[0];
        if (!msg || !msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const isGroup = remoteJid?.endsWith('@g.us');
        const mensajeTexto = msg.message.conversation || msg.message?.extendedTextMessage?.text;
        const comando = '!myid';

        // Verificar si el mensaje es el comando exacto
        if (!mensajeTexto || mensajeTexto.trim() !== comando) return;

        // Si está en un grupo, rechazar el comando
        if (isGroup) {
            await sock.sendMessage(remoteJid, {
                text: '⚠️ Este comando solo puede usarse en el chat privado con el bot.'
            });
            return;
        }

        try {
            // Obtener el ID del usuario que envió el mensaje
            const senderId = msg.key.participant || msg.key.remoteJid;

            await sock.sendMessage(remoteJid, {
                text: `🧾 Tu ID de WhatsApp es:\n\n📌 ${senderId}`
            });

            console.log(`✅ El usuario solicitó su ID: ${senderId}`);
        } catch (error) {
            console.error('❌ Error al procesar el comando !myid:', error);
            await sock.sendMessage(remoteJid, {
                text: '⚠️ Ocurrió un error al intentar obtener tu ID.'
            });
        }
    });
}
