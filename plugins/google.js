import fetch from 'node-fetch';

export default function registerDuckDuckPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || !msg.message.conversation || msg.key.fromMe) return;

    const body = msg.message.conversation;
    if (!body.toLowerCase().startsWith('!google ')) return;

    const query = body.slice(8).trim();
    const from = msg.key.remoteJid;

    if (!query) {
      await sock.sendMessage(from, { text: '❌ Debes escribir una búsqueda. Ejemplo: !google qué es la luna' });
      return;
    }

    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.AbstractText) {
        const message = `🔎 Resultado para: *${query}*\n\n` +
                        `📌 *${data.Heading}*\n` +
                        `📝 ${data.AbstractText}\n` +
                        `🔗 ${data.AbstractURL || 'https://duckduckgo.com/?q=' + encodeURIComponent(query)}`;
        await sock.sendMessage(from, { text: message });
      } else if (data.Results && data.Results.length > 0) {
        // Mostrar hasta 3 resultados con título y enlace
        const results = data.Results.slice(0, 3).map(r => `• ${r.Text}\n${r.FirstURL}`).join('\n\n');
        const message = `🔎 Resultados para: *${query}*\n\n${results}`;
        await sock.sendMessage(from, { text: message });
      } else {
        await sock.sendMessage(from, { text: `❌ No se encontraron resultados para: ${query}` });
      }

    } catch (err) {
      console.error('Error en búsqueda DuckDuckGo:', err);
      await sock.sendMessage(from, { text: '⚠️ Ocurrió un error al buscar información.' });
    }
  });
}
