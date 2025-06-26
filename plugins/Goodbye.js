import fs from 'fs';

export default async function goodbayPlugin(sock) {
  const file = './Categorizador/db/goodbay.json';

  // Crea la base si no existe
  if (!fs.existsSync('./db')) fs.mkdirSync('./db');
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({}));

  let goodbayData = JSON.parse(fs.readFileSync(file));

  const saveData = () => {
    fs.writeFileSync(file, JSON.stringify(goodbayData, null, 2));
  };

  // Manejo de comandos
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || !m.key.remoteJid.endsWith('@g.us')) return;

    const groupId = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;
    const body = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
    const args = body.trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    if (!command || !command.startsWith('!')) return;

    if (command === '!goodbye') {
      if (!args[0]) return await sock.sendMessage(groupId, { text: '✳️ Usa: *!goodbay on* o *!goodbay off*' }, { quoted: m });

      const accion = args[0].toLowerCase();

      if (accion === 'on') {
        goodbayData[groupId] = true;
        saveData();
        await sock.sendMessage(groupId, { text: '✅ El sistema de despedida ha sido *activado* en este grupo.' }, { quoted: m });
      } else if (accion === 'off') {
        delete goodbayData[groupId];
        saveData();
        await sock.sendMessage(groupId, { text: '⛔ El sistema de despedida ha sido *desactivado* en este grupo.' }, { quoted: m });
      } else {
        await sock.sendMessage(groupId, { text: '⚠️ Opción inválida. Usa *on* o *off*.' }, { quoted: m });
      }
    }
  });

  // Despedida automática
  sock.ev.on('group-participants.update', async (update) => {
    const { id, participants, action } = update;
    if (action !== 'remove') return;
    if (!goodbayData[id]) return;

    for (const user of participants) {
      await sock.sendMessage(id, {
        text: `👋 ${getMentionName(user)} ha salido del grupo. ¡Hasta pronto!`,
        mentions: [user],
      });
    }
  });

  // Utilidad: mostrar @usuario
  function getMentionName(jid) {
    return `@${jid.split('@')[0]}`;
  }
}
