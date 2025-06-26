// plugins/Moneda.js

export default function (sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    const text = m.message?.conversation || m.message?.extendedTextMessage?.text;
    if (!text || !text.startsWith('!moneda')) return;

    const resultado = Math.random() < 0.5 ? '🪙 Cara' : '🪙 Sello';

    await sock.sendMessage(m.key.remoteJid, {
      text: `🪙 *Resultado:* ${resultado}`
    });
  });
}
