// plugins/spam.js

import fs from 'fs';

const COOLDOWN_PATH = './Categorizador/db/cooldowns_spam.json';
const COOLDOWN_MS = 5 * 60 * 60 * 1000; // 5 horas en ms

function loadCooldowns() {
  if (!fs.existsSync(COOLDOWN_PATH)) fs.writeFileSync(COOLDOWN_PATH, '{}');
  return JSON.parse(fs.readFileSync(COOLDOWN_PATH));
}

function saveCooldowns(data) {
  fs.writeFileSync(COOLDOWN_PATH, JSON.stringify(data, null, 2));
}

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

export default function (sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    // Obtener texto del mensaje (chat simple o extendido)
    const text = m.message.conversation || m.message.extendedTextMessage?.text;
    if (!text || !text.startsWith('!spam')) return;

    const cooldowns = loadCooldowns();
    const from = m.key.participant || m.key.remoteJid;
    const remoteJid = m.key.remoteJid;
    const now = Date.now();

    // Validar cooldown
    const lastUse = cooldowns[from];
    if (lastUse && now - lastUse < COOLDOWN_MS) {
      const remaining = COOLDOWN_MS - (now - lastUse);
      const h = Math.floor(remaining / 3600000);
      const min = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);

      await sock.sendMessage(remoteJid, {
        text: `⏳ Ya usaste este comando. Espera ${h}h ${min}m ${s}s para volver a usarlo.`,
        mentions: [from]
      });
      return;
    }

    // Extraer argumentos
    const args = text.trim().split(/ +/).slice(1);
    if (args.length < 2) {
      await sock.sendMessage(remoteJid, {
        text: '❌ Uso incorrecto.\n\nFormato:\n!spam <cantidad> <mensaje>'
      });
      return;
    }

    const cantidad = parseInt(args[0]);
    if (isNaN(cantidad) || cantidad <= 0 || cantidad > 50) {
      await sock.sendMessage(remoteJid, {
        text: '❌ La cantidad debe ser un número entre 1 y 50.'
      });
      return;
    }

    const mensaje = args.slice(1).join(' ');

    // Detectar menciones en el mensaje original
    let mentions = [];
    if (m.message.extendedTextMessage?.contextInfo?.mentionedJid) {
      mentions = m.message.extendedTextMessage.contextInfo.mentionedJid;
    }

    for (let i = 0; i < cantidad; i++) {
      await sock.sendMessage(remoteJid, {
        text: mensaje,
        mentions
      });
      await delay(800);
    }

    cooldowns[from] = now;
    saveCooldowns(cooldowns);

    await sock.sendMessage(remoteJid, {
      text: `✅ Se enviaron ${cantidad} mensajes. Podrás usar este comando de nuevo en 5 horas.`,
      mentions: [from]
    });
  });
}
