import fs from 'fs';

export default async function antifloodPlugin(sock) {
  const dbFile = './Categorizador/db/antiflood.json';
  if (!fs.existsSync('./db')) fs.mkdirSync('./db');
  if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, JSON.stringify({
    settings: {},
    data: {},
    logs: {
      logGroupId: null, // Grupo donde se envían logs, null si desactivado
      whitelist: [] // Lista de JIDs excluidos del antiflood
    }
  }, null, 2));

  let floodDB = JSON.parse(fs.readFileSync(dbFile));

  const FLOOD_LIMIT = 5; // mensajes máximos en ventana de tiempo
  const TIME_WINDOW = 8000; // 8 segundos
  const RESET_WARNINGS_TIME = 10 * 60 * 1000; // 10 minutos
  const MAX_WARNINGS = 3; // 3 advertencias para expulsar

  const saveDB = () => fs.writeFileSync(dbFile, JSON.stringify(floodDB, null, 2));

  // Comando para controlar antiflood y logs
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || !m.key.remoteJid.endsWith('@g.us') || m.key.fromMe) return;

    const groupId = m.key.remoteJid;
    const sender = m.key.participant;
    const body = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
    const args = body.trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();

    if (command === '!antiflood') {
      const isAdmin = await isUserAdmin(sock, groupId, sender);
      if (!isAdmin) return sock.sendMessage(groupId, { text: '⛔ Solo admins pueden usar este comando.' }, { quoted: m });

      const subcmd = args[0]?.toLowerCase();

      if (subcmd === 'on') {
        floodDB.settings[groupId] = true;
        saveDB();
        return sock.sendMessage(groupId, { text: '✅ Antiflood activado.' }, { quoted: m });
      }

      if (subcmd === 'off') {
        delete floodDB.settings[groupId];
        saveDB();
        return sock.sendMessage(groupId, { text: '⛔ Antiflood desactivado.' }, { quoted: m });
      }

      if (subcmd === 'status') {
        const active = floodDB.settings[groupId] ? '✅ Activado' : '⛔ Desactivado';
        const userWarns = floodDB.data[groupId] || {};
        const warnList = Object.entries(userWarns)
          .filter(([_, data]) => data.warnings > 0)
          .map(([jid, data]) => `- @${jid.split('@')[0]}: ${data.warnings} advertencia(s)`)
          .join('\n') || 'Ninguna advertencia registrada.';
        const msg = `🛡️ Estado antiflood: ${active}\n\n⚠️ Advertencias:\n${warnList}`;
        return sock.sendMessage(groupId, { text: msg, mentions: Object.keys(userWarns) }, { quoted: m });
      }

      if (subcmd === 'whitelist') {
        // admin puede añadir o remover usuarios de whitelist
        const action = args[1]?.toLowerCase();
        const userToWL = args[2];
        if (!action || !['add', 'remove'].includes(action) || !userToWL) {
          return sock.sendMessage(groupId, { text: 'Uso: !antiflood whitelist add|remove <jid>' }, { quoted: m });
        }

        if (action === 'add') {
          if (!floodDB.logs.whitelist.includes(userToWL)) {
            floodDB.logs.whitelist.push(userToWL);
            saveDB();
            return sock.sendMessage(groupId, { text: `✅ ${userToWL} añadido a whitelist.` }, { quoted: m });
          } else {
            return sock.sendMessage(groupId, { text: `ℹ️ ${userToWL} ya está en whitelist.` }, { quoted: m });
          }
        } else if (action === 'remove') {
          const index = floodDB.logs.whitelist.indexOf(userToWL);
          if (index !== -1) {
            floodDB.logs.whitelist.splice(index, 1);
            saveDB();
            return sock.sendMessage(groupId, { text: `✅ ${userToWL} removido de whitelist.` }, { quoted: m });
          } else {
            return sock.sendMessage(groupId, { text: `ℹ️ ${userToWL} no estaba en whitelist.` }, { quoted: m });
          }
        }
      }

      if (subcmd === 'setlog') {
        // Setear grupo para logs
        const logGroup = args[1];
        if (!logGroup || !logGroup.endsWith('@g.us')) {
          return sock.sendMessage(groupId, { text: 'Uso: !antiflood setlog <groupid>' }, { quoted: m });
        }
        floodDB.logs.logGroupId = logGroup;
        saveDB();
        return sock.sendMessage(groupId, { text: `✅ Grupo para logs seteado a ${logGroup}` }, { quoted: m });
      }

      return sock.sendMessage(groupId, { text: 'Comando inválido. Opciones:\n!antiflood on\n!antiflood off\n!antiflood status\n!antiflood whitelist add|remove <jid>\n!antiflood setlog <groupid>' }, { quoted: m });
    }
  });

  // Detección y manejo antiflood
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || !m.key.remoteJid.endsWith('@g.us') || m.key.fromMe) return;

    const groupId = m.key.remoteJid;
    const sender = m.key.participant;
    const now = Date.now();

    if (!floodDB.settings[groupId]) return;

    // Ignorar admins y whitelist
    const isAdmin = await isUserAdmin(sock, groupId, sender);
    if (isAdmin) return;
    if (floodDB.logs.whitelist.includes(sender)) return;

    // Inicializar datos
    if (!floodDB.data[groupId]) floodDB.data[groupId] = {};
    if (!floodDB.data[groupId][sender]) {
      floodDB.data[groupId][sender] = {
        timestamps: [],
        warnings: 0,
        lastWarn: 0
      };
    }

    const userData = floodDB.data[groupId][sender];

    // Filtrar timestamps viejos y añadir el actual
    userData.timestamps = userData.timestamps.filter(ts => now - ts <= TIME_WINDOW);
    userData.timestamps.push(now);

    // Resetear advertencias si ha pasado tiempo
    if (now - userData.lastWarn > RESET_WARNINGS_TIME) {
      userData.warnings = 0;
    }

    if (userData.timestamps.length > FLOOD_LIMIT) {
      userData.warnings += 1;
      userData.lastWarn = now;
      userData.timestamps = [];

      if (userData.warnings >= MAX_WARNINGS) {
        // Expulsar
        try {
          await sock.sendMessage(groupId, {
            text: `🚫 @${sender.split('@')[0]} expulsado por flood reiterado (3 advertencias).`,
            mentions: [sender]
          });

          await sock.groupParticipantsUpdate(groupId, [sender], 'remove');

          // Enviar log si está configurado
          if (floodDB.logs.logGroupId) {
            await sock.sendMessage(floodDB.logs.logGroupId, {
              text: `📢 Usuario @${sender.split('@')[0]} expulsado por flood reiterado en grupo ${groupId}.`,
              mentions: [sender]
            });
          }
        } catch {
          await sock.sendMessage(groupId, {
            text: `❗ No pude expulsar a @${sender.split('@')[0]}. ¿Soy admin?`,
            mentions: [sender]
          });
        }
        delete floodDB.data[groupId][sender];
      } else {
        await sock.sendMessage(groupId, {
          text: `⚠️ @${sender.split('@')[0]}, no hagas spam. Advertencia ${userData.warnings}/3.`,
          mentions: [sender]
        });
      }
      saveDB();
    }
  });

  // Función util para saber si alguien es admin
  async function isUserAdmin(sock, groupId, userJid) {
    try {
      const metadata = await sock.groupMetadata(groupId);
      const participant = metadata.participants.find(p => p.id === userJid);
      return participant?.admin === 'admin' || participant?.admin === 'superadmin';
    } catch {
      return false;
    }
  }
}
