const antiRaidGroups = new Set();
const actionLog = new Map();
const messageSpamLog = new Map();
const blacklistedUsers = new Set();
const groupConfig = new Map();

export default function antiRaidPlugin(sock) {
  if (!sock) return console.error('[ANTIRAID] ❌ sock no está definido');

  globalThis.sock = sock;
  const ownerId = '593XXXXXXXXX@s.whatsapp.net'; // PON TU NÚMERO AQUÍ

  // ✅ Comando !antiraid on/off/status/config
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || !m.key.remoteJid.endsWith('@g.us')) return;

    const from = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;
    const body = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
    const args = body.trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    if (command !== '!antiraid') return;

    const metadata = await sock.groupMetadata(from);
    const participants = metadata.participants;
    const isAdmin = participants.some(p => p.id === sender && p.admin);

    if (!isAdmin) {
      await sock.sendMessage(from, {
        text: '⛔ Solo los administradores pueden usar este comando.'
      }, { quoted: m });
      return;
    }

    const subcmd = args[0]?.toLowerCase();

    switch (subcmd) {
      case 'on':
        antiRaidGroups.add(from);
        groupConfig.set(from, { quarantine: true });
        await sock.sendMessage(from, {
          text: '🛡️ *Anti-Raid activado.* El grupo ahora está protegido.'
        }, { quoted: m });
        break;

      case 'off':
        antiRaidGroups.delete(from);
        groupConfig.delete(from);
        await sock.sendMessage(from, {
          text: '🔕 *Anti-Raid desactivado.* El grupo ya no está protegido.'
        }, { quoted: m });
        break;

      case 'status':
        const isOn = antiRaidGroups.has(from);
        const cfg = groupConfig.get(from) || {};
        await sock.sendMessage(from, {
          text: `📊 *Estado del Anti-Raid:*\n\nEstado: ${isOn ? '🟢 Activado' : '🔴 Desactivado'}\nModo cuarentena: ${cfg.quarantine ? '🟢 Sí' : '🔴 No'}`
        }, { quoted: m });
        break;

      case 'config':
        const option = args[1]?.toLowerCase();
        if (option === 'cuarentena') {
          const enabled = args[2] === 'on';
          const config = groupConfig.get(from) || {};
          config.quarantine = enabled;
          groupConfig.set(from, config);
          await sock.sendMessage(from, {
            text: `⚙️ Modo cuarentena ${enabled ? 'activado ✅' : 'desactivado ❌'}.`
          }, { quoted: m });
        } else {
          await sock.sendMessage(from, {
            text: '❌ Opción no reconocida. Usa: `!antiraid config cuarentena on/off`'
          }, { quoted: m });
        }
        break;

      default:
        await sock.sendMessage(from, {
          text: '📘 *Uso del comando !antiraid:*\n\n• !antiraid on - Activar\n• !antiraid off - Desactivar\n• !antiraid status - Ver estado\n• !antiraid config cuarentena on/off - Activar/desactivar modo cuarentena'
        }, { quoted: m });
        break;
    }
  });

  // 🔐 Protección contra ataques
  sock.ev.on('group-participants.update', async update => {
    const { id: groupId, participants, action, actor } = update;
    if (!antiRaidGroups.has(groupId)) return;

    const botId = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
    const now = Date.now();
    const groupActions = actionLog.get(groupId) || new Map();
    const userActions = groupActions.get(actor) || [];

    userActions.push(now);
    groupActions.set(actor, userActions.filter(t => now - t < 60000));
    actionLog.set(groupId, groupActions);

    // 🚨 Expulsión del bot
    if (action === 'remove' && participants.includes(botId)) {
      await sock.sendMessage(ownerId, {
        text: `🚨 *ALERTA: El bot fue expulsado del grupo*\nGrupo: ${groupId}\nPor: ${actor}`
      });
      return;
    }

    // 🚷 Expulsiones masivas
    if (userActions.length > 5 && actor !== ownerId && actor !== botId) {
      blacklistedUsers.add(actor);
      await sock.groupParticipantsUpdate(groupId, [actor], 'remove');
      await sock.sendMessage(groupId, {
        text: `🛡️ *Anti-Raid:* ${actor} fue expulsado por comportamiento sospechoso.`
      });

      // 🧤 Cuarentena automática
      const config = groupConfig.get(groupId) || {};
      if (config.quarantine) {
        try {
          await sock.groupSettingUpdate(groupId, 'announcement');
          await sock.sendMessage(groupId, {
            text: '🚫 *Modo Cuarentena activado automáticamente.* Solo admins pueden enviar mensajes.'
          });
        } catch (e) {
          console.error('[ANTIRAID] ❌ Error al activar cuarentena:', e);
        }
      }
    }

    // 🤖 Detección de bots sospechosos o usuarios en lista negra
    if (action === 'add') {
      for (const user of participants) {
        const isBot =
          user.includes('bot') ||
          isNaN(user.replace(/\D/g, '')) ||
          user.length < 12 ||
          blacklistedUsers.has(user);

        if (isBot && user !== botId) {
          await sock.groupParticipantsUpdate(groupId, [user], 'remove');
          await sock.sendMessage(groupId, {
            text: `🤖 Usuario ${user} fue expulsado automáticamente (sospechoso o en lista negra).`
          });
        }
      }
    }
  });

  // 📥 Protección contra spam
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || !m.key.remoteJid.endsWith('@g.us')) return;

    const from = m.key.remoteJid;
    if (!antiRaidGroups.has(from)) return;

    const sender = m.key.participant || m.key.remoteJid;
    const now = Date.now();
    const spamData = messageSpamLog.get(from) || new Map();
    const senderMsgs = spamData.get(sender) || [];

    senderMsgs.push(now);
    spamData.set(sender, senderMsgs.filter(t => now - t < 8000));
    messageSpamLog.set(from, spamData);

    if (senderMsgs.length >= 8) {
      blacklistedUsers.add(sender);
      await sock.groupParticipantsUpdate(from, [sender], 'remove');
      await sock.sendMessage(from, {
        text: `🚷 *Anti-Spam:* ${sender} fue expulsado por enviar demasiados mensajes.`
      });
    }
  });

  // 🔍 Protege de cambios al grupo
  sock.ev.on('groups.update', async updates => {
    for (const update of updates) {
      const { id, subject, desc, restrict, announce } = update;
      if (!antiRaidGroups.has(id)) return;

      const cambios = [];
      if (subject) cambios.push('nombre');
      if (desc) cambios.push('descripción');
      if (restrict !== undefined) cambios.push('permisos');
      if (announce !== undefined) cambios.push('modo de mensajes');

      if (cambios.length) {
        await sock.sendMessage(id, {
          text: `⚠️ *Anti-Raid:* Cambios detectados: ${cambios.join(', ')}.`
        });
      }
    }
  });
}
