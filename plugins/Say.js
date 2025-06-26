export default function (sock) {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages?.[0];
        if (!msg || !msg.message || msg.key?.fromMe) return;

        try {
            const text = extractMessageText(msg);
            if (!text || b!text.toLowerCase().startsWith('!say')) return;

            const messageToRepeat = text.slice(4).trim(); 
            const cleanMessage = sanitizeText(messageToRepeat);

            const replyText = cleanMessage
                ? cleanMessage
                : '❌ Por favor, escribe algo después de !say para que lo repita.';

            await sock.sendMessage(msg.key.remoteJid, { text: replyText });

            if (cleanMessage) {
                console.log(`✅ El bot ha repetido: ${cleanMessage}`);
            }
        } catch (error) {
            console.error('❌ Error en el comando !say:', error);
            await sock.sendMessage(msg.key.remoteJid, {
                text: '⚠️ Ocurrió un error al procesar el comando !say.'
            });
        }
    });
}

function extractMessageText(msg) {
    const content = msg.message;
    if (!content) return null;

    return (
        content.conversation ||
        content.extendedTextMessage?.text ||
        content.imageMessage?.caption ||
        content.videoMessage?.caption ||
        content.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
        content.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text ||
        content.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage?.caption ||
        content.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage?.caption ||
        null
    );
}
function sanitizeText(text) {
    return text.replace(/@\d{5,}/g, '').trim();
}
