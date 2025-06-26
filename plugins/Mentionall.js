export default function handleMentionAll(sock) {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages?.[0];
        if (!msg || !msg.message || msg.key.fromMe) return;

        const mensajeTexto = msg.message.conversation || msg.message?.extendedTextMessage?.text;
        const comando = '!mentionall';

        if (!mensajeTexto || mensajeTexto.trim() !== comando) return;

        const remoteJid = msg.key.remoteJid;
        const isGroup = remoteJid?.endsWith('@g.us');
        const senderId = msg.key.participant || msg.participant || msg.key.remoteJid;
        const ownerId = '593997564480@s.whatsapp.net'; // tu ID

        if (!isGroup) {
            return sock.sendMessage(remoteJid, {
                text: '❌ Este comando solo está disponible en grupos.'
            });
        }

        try {
            const groupMetadata = await sock.groupMetadata(remoteJid);
            const participants = groupMetadata?.participants || [];
            const botJid = sock?.user?.id;

            const adminIds = participants
                .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
                .map(p => p.id);

            // DEBUG opcional: muestra quién lo ejecuta
            console.log('🔍 Sender ID:', senderId);
            console.log('🔒 Admins:', adminIds);
            console.log('👑 Owner:', ownerId);

            const isAuthorized = adminIds.includes(senderId) || senderId === ownerId;
            if (!isAuthorized) {
                return sock.sendMessage(remoteJid, {
                    text: '❌ Solo los administradores o el dueño del bot pueden usar este comando.'
                });
            }

            const mentions = [];
            const lines = participants
                .filter(p => p.id !== botJid)
                .map(p => {
                    mentions.push(p.id);
                    return `@${p.id.split('@')[0]}`;
                });

            if (lines.length === 0) {
                return sock.sendMessage(remoteJid, {
                    text: '⚠️ No se encontraron miembros para mencionar.'
                });
            }

            const mentionMessage = `👥 Mencionando a todos los miembros del grupo:\n\n${lines.join('\n')}`;

            await sock.sendMessage(remoteJid, {
                text: mentionMessage,
                mentions
            });

            console.log(`✅ Comando !mentionall ejecutado correctamente por ${senderId}`);
        } catch (err) {
            console.error('❌ Error al ejecutar el comando !mentionall:', err);
            await sock.sendMessage(remoteJid, {
                text: '⚠️ Ha ocurrido un error al intentar mencionar a todos los miembros del grupo.'
            });
        }
    });
}
