import fetch from 'node-fetch';

const cooldown = new Map();

export default async function (sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    if (!messages || !messages.length) return;

    const m = messages[0];
    if (!m.message || !m.key.remoteJid?.endsWith('@g.us')) return;

    const text = m.message?.conversation ||
                 m.message?.extendedTextMessage?.text || '';
    const command = text.trim().split(/\s+/)[0]?.toLowerCase();

    const validCommands = ['!printgay', '!gay', '!gei'];
    if (!validCommands.includes(command)) return;

    const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (mentions.length === 0) {
      return sock.sendMessage(m.key.remoteJid, {
        text: '📌 Debes mencionar al menos a un usuario: *!printgay @usuario*'
      }, { quoted: m });
    }

    const sender = m.key.participant;
    const now = Date.now();

    // Cooldown de 10 segundos por usuario
    if (cooldown.has(sender)) {
      const remaining = ((cooldown.get(sender) - now) / 1000).toFixed(1);
      return sock.sendMessage(m.key.remoteJid, {
        text: `⏳ Espera ${remaining}s antes de volver a usar este comando.`
      }, { quoted: m });
    }

    cooldown.set(sender, now + 10000);
    setTimeout(() => cooldown.delete(sender), 10000);

    // Reacción al mensaje
    try {
      await sock.sendMessage(m.key.remoteJid, {
        react: {
          text: '🏳️‍🌈',
          key: m.key
        }
      });
    } catch (err) {
      console.warn('⚠️ No se pudo enviar la reacción:', err.message);
    }

    for (const jid of mentions) {
      let profilePic = 'https://i.ibb.co/TgY9v1d/placeholder.png';

      try {
        profilePic = await sock.profilePictureUrl(jid, 'image');
      } catch {}

      let name = jid.split('@')[0];
      try {
        const [contact] = await sock.onWhatsApp(jid);
        name = contact?.notify || name;
      } catch {}

      try {
        // Cambia esta URL por un endpoint funcional para el efecto "gay"
        const apiUrl = `https://api.popcat.xyz/gay?image=${encodeURIComponent(profilePic)}`;
        const apiRes = await fetch(apiUrl);

        if (!apiRes.ok) throw new Error(`API error ${apiRes.status}`);

        const imgBuffer = await apiRes.buffer();

        await sock.sendMessage(m.key.remoteJid, {
          image: imgBuffer,
          caption: `🏳️‍🌈 ¡@${name} ha sido oficialmente declarado GAY!`
        }, {
          quoted: m,
          mentions: [jid]
        });

      } catch (error) {
        console.error(`[printgay] ❌ Error con ${jid}:`, error);
        const errorMsg = error.message.includes('404') ? 
          `❌ La API para generar la imagen no encontró el recurso. Intenta más tarde.` :
          `❌ No pude generar la imagen para @${name}.`;
        await sock.sendMessage(m.key.remoteJid, {
          text: errorMsg
        }, {
          quoted: m,
          mentions: [jid]
        });
      }
    }
  });
}
