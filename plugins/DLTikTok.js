import fetch from 'node-fetch';

export default function (sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    const text = m.message.conversation || m.message?.extendedTextMessage?.text;
    if (!text || !text.startsWith('!tiktok')) return;

    const partes = text.trim().split(/\s+/);
    const url = partes[1];

    if (!url || !url.includes('tiktok')) {
      await sock.sendMessage(m.key.remoteJid, {
        text: "❌ Por favor, proporciona un enlace válido de TikTok. Ejemplo:\n*!tiktok https://www.tiktok.com/@usuario/video/1234567890*"
      });
      return;
    }

    try {
      const response = await fetch(`https://api.tikwm.com/video?url=${encodeURIComponent(url)}`);
      const data = await response.json();

      if (data.code !== 0 || !data.data || !data.data.play) {
        await sock.sendMessage(m.key.remoteJid, {
          text: "❌ No se pudo descargar el video. Asegúrate de que el enlace sea válido."
        });
        return;
      }

      const videoUrl = data.data.play;
      const titulo = data.data.title || "Video de TikTok";

      await sock.sendMessage(m.key.remoteJid, {
        video: { url: videoUrl },
        caption: `🎵 *TikTok Descargado sin marca de agua*\n📝 ${titulo}`
      });
    } catch (err) {
      console.error('❌ Error al descargar el video de TikTok:', err);
      await sock.sendMessage(m.key.remoteJid, {
        text: "❌ Hubo un error al intentar descargar el video. Inténtalo más tarde."
      });
    }
  });
}
