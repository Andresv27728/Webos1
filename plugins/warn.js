import fs from 'fs';

const WARN_FILE = './Categorizador/db/warns.json';
const ALERTS_FILE = './warn_alerts.json';

const loadWarns = () => fs.existsSync(WARN_FILE) ? JSON.parse(fs.readFileSync(WARN_FILE)) : {};
const saveWarns = (data) => fs.writeFileSync(WARN_FILE, JSON.stringify(data, null, 2));

const loadAlerts = () => fs.existsSync(ALERTS_FILE) ? JSON.parse(fs.readFileSync(ALERTS_FILE)) : {};
const saveAlerts = (data) => fs.writeFileSync(ALERTS_FILE, JSON.stringify(data, null, 2));

// Sistema de caché para evitar el error rate-overlimit
const groupCache = new Map();
const getGroupMetadata = async (jid, sock) => {
  if (groupCache.has(jid)) return groupCache.get(jid);
  const metadata = await sock.groupMetadata(jid);
  groupCache.set(jid, metadata);
  setTimeout(() => groupCache.delete(jid), 300000); // caché 5 min
  return metadata;
};

export default function warnPlugin(sock) {
  const warns = loadWarns();
  const alertPrefs = loadAlerts();

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages?.[0];
    if (!msg || !msg.message || !msg.key.remoteJid.endsWith('@g.us')) return;

    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const content = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

    // ✅ Uso de caché para evitar sobrecarga
    const groupMeta = await getGroupMetadata(from, sock);
    const isAdmin = groupMeta.participants.find(p => p.id === sender)?.admin;

    // !warn @user motivo
    if (content.startsWith('!warn')) {
      if (!isAdmin) return sock.sendMessage(from, { text: '❌ Solo los administradores pueden usar este comando.', quoted: msg });

      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      const motivo = content.split(' ').slice(2).join(' ').trim();

      if (!mentioned || !motivo) {
        return sock.sendMessage(from, {
          text: '❌ Uso incorrecto. Ejemplo:\n!warn @usuario razón',
          quoted: msg,
        });
      }

      warns[from] = warns[from] || {};
      warns[from][mentioned] = warns[from][mentioned] || [];

      warns[from][mentioned].push({
        motivo,
        fecha: new Date().toISOString(),
        admin: sender,
      });

      const totalWarns = warns[from][mentioned].length;
      saveWarns(warns);

      await sock.sendMessage(from, {
        text: `⚠️ El usuario @${mentioned.split('@')[0]} ha sido advertido.\nMotivo: *${motivo}*\nAdvertencia ${totalWarns}/3.`,
        mentions: [mentioned],
        quoted: msg,
      });

      if (totalWarns >= 3) {
        try {
          await sock.groupParticipantsUpdate(from, [mentioned], 'remove');
        } catch (err) {
          warns[from]._waitlist = warns[from]._waitlist || [];
          if (!warns[from]._waitlist.includes(mentioned)) warns[from]._waitlist.push(mentioned);
          saveWarns(warns);
          await sock.sendMessage(from, {
            text: `❗ No se pudo expulsar a @${mentioned.split('@')[0]} automáticamente. Se añadió a la lista de espera.`,
            mentions: [mentioned],
          });
        }
      }
    }

    // !warnlist
    if (content === '!warnlist' && isAdmin) {
      const waitlist = warns[from]?._waitlist || [];
      if (waitlist.length === 0) {
        return sock.sendMessage(from, { text: '✅ La lista de espera está vacía.', quoted: msg });
      }
      const lista = waitlist.map(jid => `- @${jid.split('@')[0]}`).join('\n');
      await sock.sendMessage(from, {
        text: `📝 Usuarios con 3 warns que no pudieron ser expulsados:\n${lista}`,
        mentions: waitlist,
        quoted: msg,
      });
    }

    // !warn alert privado/grupo
    if (content.startsWith('!warn alert') && isAdmin) {
      const tipo = content.split(' ')[2];
      if (!['privado', 'grupo'].includes(tipo)) {
        return sock.sendMessage(from, {
          text: '❌ Uso incorrecto. Escribe:\n!warn alert privado\no\n!warn alert grupo',
          quoted: msg,
        });
      }
      alertPrefs[from] = tipo;
      saveAlerts(alertPrefs);
      await sock.sendMessage(from, {
        text: `🔔 Las alertas de warns serán enviadas por: *${tipo.toUpperCase()}*`,
        quoted: msg,
      });
    }
  });

  // ⏰ Recordatorio automático cada 3 días
  setInterval(async () => {
    for (const group in warns) {
      const waitlist = warns[group]?._waitlist || [];
      if (waitlist.length === 0) continue;

      const tipo = alertPrefs[group] || 'grupo';
      const mensaje = `⏰ Recordatorio: estos usuarios tienen 3 warns y están en la lista de espera:\n` +
        waitlist.map(jid => `- @${jid.split('@')[0]}`).join('\n');

      try {
        const groupMeta = await getGroupMetadata(group, sock);
        if (tipo === 'grupo') {
          await sock.sendMessage(group, {
            text: mensaje,
            mentions: waitlist,
          });
        } else {
          const admins = groupMeta.participants.filter(p => p.admin);
          for (const admin of admins) {
            await sock.sendMessage(admin.id, {
              text: `🔔 Recordatorio del grupo *${group}*:\n` + mensaje,
              mentions: waitlist,
            });
          }
        }
      } catch (err) {
        console.error('Error al enviar recordatorio:', err.message);
      }
    }
  }, 1000 * 60 * 60 * 24 * 3); // cada 3 días
}

