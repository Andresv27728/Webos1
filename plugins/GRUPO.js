import { setTimeout as wait } from 'timers/promises';

export default async function groupPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || !m.key.remoteJid.endsWith('@g.us')) return;

    const groupId = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;
    const body = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
    const args = body.trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    // === COMANDO !group on/off (como ya lo tienes)
    if (command === '!group') {
      const option = args[0]?.toLowerCase();
      if (!['on', 'off'].includes(option)) {
        return await sock.sendMessage(groupId, {
          text: '❗ Usa: *!group on* para abrir el grupo o *!group off* para cerrarlo.'
        }, { quoted: m });
      }

      const metadata = await sock.groupMetadata(groupId);
      const participants = metadata.participants;
      const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

      const isBotAdmin = participants.some(p => p.id === botNumber && p.admin);
      const isSenderAdmin = participants.some(p => p.id === sender && p.admin);

      if (!isSenderAdmin)
        return await sock.sendMessage(groupId, { text: '⛔ Solo los *administradores* pueden usar este comando.' }, { quoted: m });

      if (!isBotAdmin)
        return await sock.sendMessage(groupId, { text: '⚠️ Necesito ser *administrador* para cambiar la configuración del grupo.' }, { quoted: m });

      const newSetting = option === 'on' ? 'not_announcement' : 'announcement';
      const statusText = option === 'on'
        ? '✅ *Grupo abierto*: todos los miembros pueden escribir.'
        : '🔒 *Grupo cerrado*: solo los administradores pueden escribir.';

      await sock.groupSettingUpdate(groupId, newSetting);
      await sock.sendMessage(groupId, { text: statusText }, { quoted: m });

      console.log(`[GROUP CONTROL] El usuario ${sender} cambió el grupo (${groupId}) a "${option}" el ${new Date().toLocaleString()}`);
    }

    // === NUEVO COMANDO !closeCD segundos mensaje
    if (command === '!close') {
      const seconds = parseInt(args[0]);
      const customMsg = args.slice(1).join(' ') || '⏳ El grupo estará cerrado temporalmente.';

      if (isNaN(seconds) || seconds <= 0) {
        return await sock.sendMessage(groupId, {
          text: '❗ Usa: *!close segundos mensaje*\nEj: !close 60 Volvemos pronto.'
        }, { quoted: m });
      }

      const metadata = await sock.groupMetadata(groupId);
      const participants = metadata.participants;
      const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

      const isBotAdmin = participants.some(p => p.id === botNumber && p.admin);
      const isSenderAdmin = participants.some(p => p.id === sender && p.admin);

      if (!isSenderAdmin)
        return await sock.sendMessage(groupId, { text: '⛔ Solo los *administradores* pueden usar este comando.' }, { quoted: m });

      if (!isBotAdmin)
        return await sock.sendMessage(groupId, { text: '⚠️ Necesito ser *administrador* para cerrar el grupo.' }, { quoted: m });

      try {
        await sock.groupSettingUpdate(groupId, 'announcement');
        await sock.sendMessage(groupId, {
          text: `🔒 *Grupo cerrado por ${seconds} segundos.*\n${customMsg}`
        });

        await wait(seconds * 1000);

        await sock.sendMessage(groupId, {
          text: `🔓 *Tiempo finalizado.* El grupo se ha reabierto.\n${customMsg}`
        });
        await sock.groupSettingUpdate(groupId, 'not_announcement');
      } catch (e) {
        console.error('❌ Error en !close:', e);
        await sock.sendMessage(groupId, {
          text: '❌ Ocurrió un error al cerrar o abrir el grupo.'
        });
      }
    }
  });
}
