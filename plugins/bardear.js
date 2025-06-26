// plugins/bardear.js
export default function (sock) {
    const insults = [
        "Tu mamá tiene sida.",
        "Cállate, mongo, vuelve a tu cueva, simio de mrd.",
        "Eres más inútil que un lápiz sin punta.",
        "negro muerto de hambre ",
         "silencio negr sarnoso",
         "sos un putito de mierda ",
         "tu madre es mi perra q cuando la llamo viene ",
         "Puto enano sindrome de down",
         "tamsexual de mrd andate a prostituir pedazo de mrd ",
         "negra depresiva ",
         "tienes a tu madre pudriendose bajo tierra ",
        "con la boca chupas vrg travesti de mrd",
        "estas peor q hincha del boca ",
        "vos cerra el ortito bisexual ",
        
    ];

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const type = Object.keys(msg.message)[0];
        const isText = type === 'conversation' || type === 'extendedTextMessage';

        let body = '';
        if (msg.message?.conversation) {
            body = msg.message.conversation;
        } else if (msg.message?.extendedTextMessage?.text) {
            body = msg.message.extendedTextMessage.text;
        }

        if (!body.toLowerCase().startsWith('!bardear')) return;

        const jid = msg.key.remoteJid;
        let targetJid;

        // Si el mensaje es una respuesta
        if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
            targetJid = msg.message.extendedTextMessage.contextInfo.participant;
        }

        // Si no hay respuesta, bardear al remitente (con una advertencia graciosa)
        if (!targetJid) {
            return await sock.sendMessage(jid, {
                text: '🧠 ¡Debes responder a un mensaje para bardear a alguien!'
            });
        }

        // Prevenir que se bardee a sí mismo
        if (targetJid === msg.key.participant || targetJid === msg.key.remoteJid) {
            return await sock.sendMessage(jid, {
                text: '⛔ No puedes bardearte a ti mismo.'
            });
        }

        const insulto = insults[Math.floor(Math.random() * insults.length)];
        await sock.sendMessage(jid, {
            text: `@${targetJid.split('@')[0]}, ${insulto}`,
            mentions: [targetJid]
        });
    });
}
