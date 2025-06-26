// plugins/afk.js
const afkMap = new Map();

export default function (sock) {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return; // No ejecutamos si es un mensaje del bot

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const pushName = msg.pushName || 'Usuario';
        const isGroup = from.endsWith('@g.us'); // Verificamos si es un grupo

        // Detectar texto del mensaje
        const text = (
            msg.message.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            msg.message?.videoMessage?.caption ||
            ''
        ).trim();

        if (!text) return; // Si no hay texto, no hacemos nada

        // Comando para poner al usuario en AFK
        if (text.startsWith('!afk')) {
            const reason = text.slice(4).trim() || 'Sin motivo';
            if (afkMap.has(sender)) {
                await sock.sendMessage(from, {
                    text: `🟡 *${pushName}* ya está en modo AFK.\nMotivo: _${afkMap.get(sender).reason}_`
                });
            } else {
                afkMap.set(sender, {
                    reason,
                    since: Date.now()
                });
                await sock.sendMessage(from, {
                    text: `🌙 *${pushName}* ahora está en modo AFK.\n📝 Motivo: _${reason}_`
                });
            }
            return;
        }

        // Si el usuario está en modo AFK y escribe algo
        if (afkMap.has(sender)) {
            afkMap.delete(sender);
            await sock.sendMessage(from, {
                text: `🔔 *${pushName}* ha vuelto del modo AFK. ¡Bienvenido de nuevo!`
            });
        }
    });
}
