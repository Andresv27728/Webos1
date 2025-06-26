import fetch from 'node-fetch';

export default async function (sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    if (!messages || messages.length === 0) return;

    const m = messages[0];
    const body = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
    const isGroup = m.key.remoteJid?.endsWith('@g.us');
    const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    // Solo procesar si es comando !pfp
    if (!body.toLowerCase().startsWith('!pfp') || !isGroup || mentions.length === 0) return;

    const jid = mentions[0]; // Solo tomamos la primera mención

    let profilePic;
    try {
      profilePic = await sock.profilePictureUrl(jid, 'image');
    } catch {
      profilePic = 'https://i.ibb.co/TgY9v1d/placeholder.png';
    }

    try {
      const res = await fetch(profilePic);
      const buffer = await res.buffer();

      await sock.sendMessage(m.key.remoteJid, {
        image: buffer,
        caption: `🖼️ Esta es la foto de perfil de @${jid.split('@')[0]}`
      }, {
        quoted: m,
        mentions: [jid]
      });
    } catch (error) {
      console.error('Error al enviar la imagen de perfil:', error);
      await sock.sendMessage(m.key.remoteJid, {
        text: `❌ No pude obtener la foto de perfil de @${jid.split('@')[0]}`
      }, {
        quoted: m,
        mentions: [jid]
      });
    }
  });
}
