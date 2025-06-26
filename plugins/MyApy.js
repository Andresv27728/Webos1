// plugins/myApi.js
export default function (sock) {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const isGroup = remoteJid.endsWith('@g.us');
        const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        if (messageContent.trim().toLowerCase() === '!myapi') {
            if (isGroup) {
                // Responder con error si se usa en grupo
                await sock.sendMessage(remoteJid, {
                    text: '⚠️ Este comando solo puede usarse en el chat privado con el bot.'
                });
                return;
            }

            const senderJid = msg.key.participant || remoteJid;
            const phone = senderJid.split('@')[0].replace(/[^0-9]/g, '');
            const apiUrl = `https://api.whatsapp.com/send/?phone=${phone}`;

            await sock.sendMessage(remoteJid, {
                text: `📡 Tu API personalizada es:\n\n${apiUrl}`
            });
        }
    });
}

