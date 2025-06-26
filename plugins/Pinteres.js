import fetch from 'node-fetch';

export default function registerPinterestPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const msg = messages[0];
      const from = msg.key.remoteJid;
      if (!msg.message || !msg.message.conversation || msg.key.fromMe) return;

      const body = msg.message.conversation;
      if (!body.toLowerCase().startsWith('!pinteres ')) return;

      const query = body.slice(10).trim();
      if (!query) {
        await sock.sendMessage(from, { text: '❗ Escribe un término después de `!pinteres`' });
        return;
      }

      // Realizar búsqueda en Pinterest
      const searchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`;
      const response = await fetch(searchUrl);
      const html = await response.text();

      // Extraer información del primer pin (esto es un ejemplo simplificado)
      const imageUrlMatch = html.match(/"url":"(https:\/\/i\.pinimg\.com\/[^"]+)"/);
      const userMatch = html.match(/"username":"([^"]+)"/);
      const boardMatch = html.match(/"board_name":"([^"]+)"/);
      const pinUrlMatch = html.match(/"link":"(https:\/\/www\.pinterest\.com\/pin\/[^"]+)"/);

      if (!imageUrlMatch || !userMatch || !boardMatch || !pinUrlMatch) {
        await sock.sendMessage(from, { text: `❌ No se encontró información sobre *${query}* en Pinterest.` });
        return;
      }

      const imageUrl = imageUrlMatch[1].replace(/\\u002F/g, '/');
      const username = userMatch[1];
      const boardName = boardMatch[1];
      const pinUrl = pinUrlMatch[1].replace(/\\u002F/g, '/');

      // Enviar imagen y detalles al usuario
      await sock.sendMessage(from, {
        image: { url: imageUrl },
        caption:
`❀ Usuario » ${username}
❏ Tablero » ${boardName}
🜸 Link » ${pinUrl}`
      });

    } catch (err) {
      console.error('❌ Error en !pinteres:', err);
      await sock.sendMessage(messages[0].key.remoteJid, {
        text: '⚠️ Ocurrió un error al buscar en Pinterest. Intenta más tarde.'
      });
    }
  });
}
