export default async function tagAllPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || !m.key.remoteJid.endsWith('@g.us')) return;
    const groupId = m.key.remoteJid;
    const body = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
    const args = body.trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    if (command !== '!tag') return;

    // Obtener los participantes del grupo
    const metadata = await sock.groupMetadata(groupId);
    const participantes = metadata.participants.map(p => p.id).filter(id => id !== sock.user.id); // opcional: excluye al bot

    const mensaje = args.join(' ') || '👋';

    await sock.sendMessage(groupId, {
      text: mensaje,
      mentions: participantes
    }, { quoted: m });
  });
}
