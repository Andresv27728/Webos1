/**
 * Módulo que maneja el comando !suicide para WhatsApp.
 * Envía un mensaje y un GIF anime aleatorio con contexto de mención.
 */

export default function handleSuicideCommand(sock) {
  // Lista de GIFs animados relacionados con anime triste
  const animeGifs = [
    'https://media.tenor.com/NF9p1gAjM5MAAAAd/sad-anime.gif',
    'https://media.tenor.com/SqgVgK5fVdQAAAAd/sad-anime-boy.gif',
    'https://media.tenor.com/hApF7w6S9TQAAAAC/sad-anime-anime.gif',
    'https://media.tenor.com/oGHmMeqXp24AAAAC/anime-sad.gif',
    'https://media.tenor.com/VQbAfAacXcsAAAAC/anime-depression.gif',
    'https://media.tenor.com/fpbCz-ovemEAAAAd/sad-anime.gif',
    'https://media.tenor.com/xEJ-v2sl5HAAAAAC/anime-sad-depressed.gif',
    'https://media.tenor.com/BqQPAIJuRKwAAAAC/sad-anime.gif' // Nueva URL válida
  ];

  // Mensajes predeterminados para el comando
  const suicideMessages = [
    (name) => `💀 ${name} se ha suicidado... que en paz descanse.`,
    (name) => `🪦 ${name} decidió terminar con todo.`,
    (name) => `🕊️ ${name} ha dejado este mundo.`,
    (name) => `☠️ ${name} tomó una decisión fatal.`,
    (name) => `🖤 ${name} se ha ido para siempre...`
  ];

  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      if (!messages || messages.length === 0) return;

      const msg = messages[0];
      if (!msg.message) return;

      // Ignorar mensajes enviados por el bot mismo
      if (msg.key.fromMe) return;

      // Obtener ID del chat y texto
      const from = msg.key.remoteJid;
      const text = msg.message.conversation
        || msg.message.extendedTextMessage?.text
        || '';

      if (!text.trim().toLowerCase().startsWith('!suicide')) return;

      // Obtener contexto de mención y autor
      const contextInfo = msg.message.extendedTextMessage?.contextInfo;
      const mentionedJids = contextInfo?.mentionedJid || [];

      // Determinar usuario objetivo
      let targetJid;
      if (mentionedJids.length > 0) {
        targetJid = mentionedJids[0];
      } else {
        targetJid = msg.key.participant || from;
      }

      // Nombre para mencionar en el mensaje
      const targetName = `@${targetJid.split('@')[0]}`;

      // Preparar lista de menciones para WhatsApp
      const mentions = [targetJid];

      // Escoger mensaje y GIF aleatorio
      const randomMsg = suicideMessages[Math.floor(Math.random() * suicideMessages.length)](targetName);
      const randomGif = animeGifs[Math.floor(Math.random() * animeGifs.length)];

      // Enviar GIF como video con reproducción en loop + mensaje + mención
      await sock.sendMessage(from, {
        video: { url: randomGif },
        gifPlayback: true,
        caption: randomMsg,
        mentions
      });

    } catch (error) {
      console.error('❌ Error manejando comando !suicide:', error);
    }
  });
}
