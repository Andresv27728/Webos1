import { isNSFWEnabled } from './nsfw.js';

const analGIFs = [
  'https://hentaigifz.com/deep-anal-2/',
  'https://img.xbooru.com//images/263/ef53f1f95b54a282e0c33e8bb8265b04.gif?858775',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTzdOcXqveYnwMUNFiQCIOfUoOsmzc1aE2fEw&s',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQNrFtUzMeEg4oDV6hPmhAIgWE1vZs4mXrS2Q&s',
  'https://analporngifs.com/content/2022/07/hentai-anal_001.gif',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQGXp6i2tVco6F4DejHQcJLUdOE5hnCY_43WsobKJFDpQbsRYPFKsWMjLH3cTC9LLSlDZE&usqp=CAU',
   'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRRSg9EhZ5TUcgevNDm2m0Vb84LfGktsXB7bovYbgVjO4nCEdZzUdTEngdMchQjG9fzKKk&usqp=CAU',
   'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSe3GZbkQEAFdA4tBrVFmHnqPJUzrQEzXN_oeD0QQD0xrFYt19CrhYsNeDZfd7B7HlJiGA&usqp=CAU',
   'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRaB5C2cdZA-VvwIUrOgzO2BZlKqmDnWJpHuQtC9B4eFzP2b3iZdwiwl6mwKd8-LmoF1XA&usqp=CAU',
   'https://www.tagstube.com/wp-content/uploads/cache-e21155888465eabf55d969bc601f08b2/2016/01/Hentai-Anal-Gif-1.gif',
   'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRpAflev7cn6U7TSqK1RZLoy9RsZy7u_lsWCJoexf4C_xRAPX81WUe4KHXM3whvb0tVeh8&usqp=CAU',
   'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQVc8vF0U9VihY3Hg29Gc4ZsPxNCEPbBcnp68upOLkL-VbkA7CLOaPhNNTqil8eZ0fHOkA&usqp=CAU',
   'https://www.tagstube.com/wp-content/uploads/cache-e21155888465eabf55d969bc601f08b2/2016/01/Hentai-Anal-Gif-2.gif',
   'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRUtjQyKkMs5oqbVPsryNPe54bRIsDIkaKHrg&s',
   'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTIOanesmFv8Tm6WtHqrcyC7vztC-zHhekHH2rdMidjh-gtl93S8wMcAHMVpVZ9Z7FGNmk&usqp=CAU',
   'https://cdn.sex.com/images/pinporn/2022/05/20/27313884.gif',
   'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTlZ_NA8n57mlIfOqjNImLoFI9LHbqm8rgXa7XITOaoAeqo8WKMU6XZJnM8MHN7a-8hm_w&usqp=CAU',
  
];

export default function analPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages?.[0];
    if (!msg || !msg.message || msg.key?.fromMe) return;

    try {
      const from = msg.key.remoteJid;
      const sender = msg.key.participant || msg.key.remoteJid;
      const text = extractText(msg)?.trim().toLowerCase();

      if (!text?.startsWith('!anal')) return;

      if (!isNSFWEnabled(from)) {
        return await sock.sendMessage(from, {
          text: '🔞 Los comandos NSFW están desactivados en este chat.\nActívalos con *!nsfw on*.',
          quoted: msg,
        });
      }

      const mentionedJids = getMentionedUsers(msg);
      if (mentionedJids.length === 0) {
        return await sock.sendMessage(from, {
          text: '⚠️ Debes mencionar a alguien para usar este comando.\nEjemplo: *!anal @usuario*',
          quoted: msg,
        });
      }

      const target = mentionedJids[0];
      if (target === sender) {
        return await sock.sendMessage(from, {
          text: '😅 No puedes hacerte eso a ti mismo... ¿o sí? 😂',
          quoted: msg,
        });
      }

      const gifURL = analGIFs[Math.floor(Math.random() * analGIFs.length)];
      const senderName = sender.split('@')[0];
      const targetName = target.split('@')[0];

      const caption = `🔞 @${senderName} le ha hecho una travesura por detrás a @${targetName}... 😳🔥`;

      await sock.sendMessage(from, {
        video: { url: gifURL },
        gifPlayback: true,
        caption,
        mentions: [sender, target],
        quoted: msg,
      });

    } catch (err) {
      console.error('[NSFW Anal Plugin] Error:', err);
      await sock.sendMessage(msg?.key?.remoteJid || '', {
        text: '❌ Error al ejecutar el comando. Intenta de nuevo más tarde.',
        quoted: msg,
      });
    }
  });
}

// 🔍 Extrae texto de diferentes tipos de mensajes
function extractText(msg) {
  return msg.message?.conversation
    || msg.message?.extendedTextMessage?.text
    || msg.message?.imageMessage?.caption
    || msg.message?.videoMessage?.caption
    || '';
}

// 📌 Obtiene menciones del mensaje si existen
function getMentionedUsers(msg) {
  return msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
}
