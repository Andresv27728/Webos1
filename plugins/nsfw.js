// Archivo: plugins/nsfw.js
import fs from 'fs';

const NSFW_FILE = './Categorizador/db/nsfw.json';

function loadNSFWSettings() {
  if (!fs.existsSync(NSFW_FILE)) {
    fs.writeFileSync(NSFW_FILE, JSON.stringify({}));
  }
  return JSON.parse(fs.readFileSync(NSFW_FILE));
}

function saveNSFWSettings(data) {
  fs.writeFileSync(NSFW_FILE, JSON.stringify(data, null, 2));
}

export function isNSFWEnabled(jid) {
  const data = loadNSFWSettings();
  return data[jid] === true;
}

export default function nsfwPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages?.[0];
    if (!msg?.message) return;

    const from = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      '';

    if (!text.startsWith('!nsfw ')) return;

    const args = text.trim().split(' ');
    const state = args[1]?.toLowerCase();

    const settings = loadNSFWSettings();

    if (state === 'on') {
      settings[from] = true;
      saveNSFWSettings(settings);
      await sock.sendMessage(from, {
        text: '🔓 Los comandos NSFW han sido *activados* en este chat.',
        quoted: msg,
      });
    } else if (state === 'off') {
      settings[from] = false;
      saveNSFWSettings(settings);
      await sock.sendMessage(from, {
        text: '🔒 Los comandos NSFW han sido *desactivados* en este chat.',
        quoted: msg,
      });
    } else {
      await sock.sendMessage(from, {
        text: '⚠️ Usa *!nsfw on* o *!nsfw off* para controlar los comandos NSFW.',
        quoted: msg,
      });
    }
  });
}
