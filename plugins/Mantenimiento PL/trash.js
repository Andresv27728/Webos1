import fetch from 'node-fetch';
import FormData from 'form-data';
import { Readable } from 'stream';

const cooldown = new Map();
const avatarCache = new Map();

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

export default async function (sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    if (!messages || messages.length === 0) return;

    const m = messages[0];
    if (!m.message || !m.key.remoteJid?.endsWith('@g.us')) return;

    const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentions.length === 0) return;

    const sender = m.key.participant || m.key.remoteJid;
    const now = Date.now();

    if (cooldown.has(sender)) {
      const remaining = ((cooldown.get(sender) - now) / 1000).toFixed(1);
      if (remaining > 0) {
        return sock.sendMessage(m.key.remoteJid, {
          text: `⏳ Espera ${remaining}s antes de usar este comando nuevamente.`
        }, { quoted: m });
      } else {
        cooldown.delete(sender);
      }
    }

    cooldown.set(sender, now + 10000);
    setTimeout(() => cooldown.delete(sender), 10000);

    try {
      await sock.sendMessage(m.key.remoteJid, {
        react: { text: '🗑️', key: m.key }
      });
    } catch {}

    for (const jid of mentions) {
      let avatarBuffer;
      let avatarUrl = avatarCache.get(jid) || 'https://i.ibb.co/TgY9v1d/placeholder.png';

      // Intentar obtener URL de la foto de perfil si no está en caché
      if (!avatarCache.has(jid)) {
        try {
          avatarUrl = await sock.profilePictureUrl(jid, 'image');
          avatarCache.set(jid, avatarUrl);
        } catch {
          avatarCache.set(jid, avatarUrl); // fallback por si falla
        }

        await delay(500); // espera de 500ms entre cada petición a WhatsApp
      }

      try {
        const avatarRes = await fetch(avatarUrl);
        avatarBuffer = await avatarRes.buffer();
      } catch {
        const fallback = await fetch('https://i.ibb.co/TgY9v1d/placeholder.png');
        avatarBuffer = await fallback.buffer();
      }

      try {
        const form = new FormData();
        form.append('avatar', Readable.from(avatarBuffer), { filename: 'avatar.png' });

        const apiRes = await fetch('https://some-random-api.ml/canvas/trash', {
          method: 'POST',
          body: form,
        });

        if (!apiRes.ok) throw new Error(`API error ${apiRes.status}`);
        const finalBuffer = await apiRes.buffer();

        // Obtener el nombre con onWhatsApp (si es necesario)
        let name = jid.split('@')[0];
        try {
          const [contact] = await sock.onWhatsApp(jid);
          if (contact?.notify) name = contact.notify;
        } catch {}

        await sock.sendMessage(m.key.remoteJid, {
          image: finalBuffer,
          caption: `🗑️ ¡@${name} ha sido declarado TRASH oficialmente!`
        }, {
          quoted: m,
          mentions: [jid]
        });

        await delay(500); // Otro pequeño delay para evitar rate limit

      } catch (err) {
        console.error('Error generando imagen:', err);
        await sock.sendMessage(m.key.remoteJid, {
          text: `❌ No se pudo generar la imagen para @${jid.split('@')[0]}.`
        }, {
          quoted: m,
          mentions: [jid]
        });
      }
    }
  });
}
