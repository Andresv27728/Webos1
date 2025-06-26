import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function (sock) {
  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const sender = msg.key.remoteJid;

    if (text.toLowerCase().startsWith('!reloadpl')) {
      const pluginsDir = path.join(__dirname);
      try {
        const files = fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js') && file !== 'ReloadPL.js');
        let loaded = [];

        for (const file of files) {
          const filePath = path.join(pluginsDir, file);
          const pluginUrl = `file://${filePath}?update=${Date.now()}`; // Fuerza recarga
          const { default: plugin } = await import(pluginUrl);
          if (typeof plugin === 'function') {
            plugin(sock);
            loaded.push(file);
          }
        }

        await sock.sendMessage(sender, {
          text: `✅ *Plugins recargados exitosamente:*\n${loaded.map(f => `• ${f}`).join('\n') || 'No se encontraron plugins.'}`
        });

      } catch (e) {
        console.error('❌ Error al recargar plugins:', e);
        await sock.sendMessage(sender, {
          text: `❌ Error al recargar plugins:\n${e.message}`
        });
      }
    }
  });
}
