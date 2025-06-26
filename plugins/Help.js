const COMMANDS = [
  { command: '!help [página]', description: 'Muestra esta lista de comandos con paginación.' },
  { command: '!gay, !printgay, !gei + [Mencion usuario]', description: 'Con este comandos puedes convertir el perfil del usuario mencionado con la bandera gay.' },
  { command: '!pfp', description: 'Este comando muestra la foto de perfil del usuario mencionado.'},
  { command: '!romance <Mencion usuario 1 > + <Mencion usuario2 >', description: 'Muestra un porcentaje de compatibilidad entre dos usuarios.'},
  { command: '!toimg', description: 'Cnvierte un sticker a una imagen.'},
  { command: '!banana + <Mencion usuario>', description: 'Mide la longitud de tu banana o de otro usuario.'},
  { command: '!tts <mensaje> ', description: 'Convierte tu texto a voz con la inteligencia artificial de google.'},
  { command: '!promote <Mencion usuario> ', description: 'Promueves al uuario mencionado a administrador.'},
  { command: '!demote', description: 'despromueves al usuario mencionado de administrador.'},
  { command: '!s', description: 'Convietes un sticker a una imagen.'},
  { command: '!warn + <Mencion usuario> + <Mensaje>', description: 'Adviertes al usuario mencionado.'},
  { command: '!spy + <responder Foto,audio,video>', description: '[Command Premium] Este comando reenvia la foto,video o audio que respondiste si esta enviado solo para usa sola vez'},
  { command: '!moneda', description: 'Muestra Cara o sello' },
  { command: '!8ball <mensaje>', description: 'Bot responde a tu pregunta con si o no.' },
  { command: '!play <nombre canción>', description: 'Descarga y reproduce el audio de YouTube.' },
  { command: '!wiki <término>', description: 'Busca información en Wikipedia.' },
  { command: '!google <consulta>', description: 'Busca resultados en Google (DuckDuckGo).' },
  { command: '!pinterest <término>', description: 'Busca imágenes en Pinterest.' },
  { command: '!group <on/off>', description: 'Permite cerrar el accesso a los mensajes y comandos en el grupo para los miembros solo los administradores puede hablar.' },
  { command: '!close + <Numero en segundos> + <texto>', description: 'Permite cerrar el accesso a los mensajes y comandos en el grupo para los miembros por un defiido tiempo en segundos y solo los administradores puede hablar.'},
  // Puedes agregar más comandos aquí
];

const COMMANDS_PER_PAGE = 5;

const cooldownUsers = new Map();

function extractMessageText(msg) {
  if (msg.message?.conversation) return msg.message.conversation;
  if (msg.message?.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
  if (msg.message?.imageMessage?.caption) return msg.message.imageMessage.caption;
  if (msg.message?.videoMessage?.caption) return msg.message.videoMessage.caption;
  if (msg.message?.buttonsResponseMessage?.selectedButtonId) return msg.message.buttonsResponseMessage.selectedButtonId;
  if (msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId) return msg.message.listResponseMessage.singleSelectReply.selectedRowId;
  return '';
}

export default function registerHelpPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const msg = messages[0];
      if (!msg.message || msg.key.fromMe) return;

      const from = msg.key.remoteJid;
      const userId = msg.key.participant || from;

      const body = extractMessageText(msg).trim();
      if (!body.toLowerCase().startsWith('!help')) return;

      const now = Date.now();
      if (cooldownUsers.has(userId)) {
        const last = cooldownUsers.get(userId);
        if (now - last < 5000) {
          await sock.sendMessage(from, {
            text: '⏳ Por favor espera unos segundos antes de pedir ayuda otra vez.'
          });
          return;
        }
      }
      cooldownUsers.set(userId, now);

      // Procesar número de página
      let page = 0;
      const parts = body.split(' ');
      if (parts.length > 1) {
        const p = parseInt(parts[1], 10);
        if (!isNaN(p) && p >= 0) page = p;
      }

      const totalPages = Math.ceil(COMMANDS.length / COMMANDS_PER_PAGE);

      // Página inicial personalizada
      if (page === 0) {
        const welcomeMessage = `
      ╭───〔 𝐈𝐧𝐟𝐨 𝐝𝐞 𝐈𝐭𝐬 𝐍𝐨𝐫𝐬 (𝐁𝐨𝐭) 〕───╮
      │  𝐇𝐨𝐥𝐚! 𝐒𝐨𝐲 *Its Nors*, ᴛᴜ ʙᴏᴛ ᴀᴍɪɢᴏ 🤖
      │  ᴀǫᴜí ᴛɪᴇɴᴇs ʟᴀ ʟɪsᴛᴀ ᴅᴇ ᴄᴏᴍᴀɴᴅᴏs 📚
      │
      │  Usa *!help [número de página]* para verlos.
      │  Ejemplo: *!help 1*
      │
      │  ✐ Dev: IamLilSpooky 
      │  📢 ᴄᴀɴᴀʟ ᴏғɪᴄɪᴀʟ: https://whatsapp.com/channel/0029VbAeSti2f3EKii6uLH2x
      ╰────────────────────────────╯`;

        await sock.sendMessage(from, { text: welcomeMessage.trim() });
        return;
      }


      if (page > totalPages) {
        await sock.sendMessage(from, {
          text: `❌ La página *${page}* no existe. Hay *${totalPages}* páginas disponibles.`
        });
        return;
      }

      const start = (page - 1) * COMMANDS_PER_PAGE;
      const end = start + COMMANDS_PER_PAGE;
      const pageCommands = COMMANDS.slice(start, end);

      let helpText = '📚 *Lista de comandos disponibles:*\n\n';
      pageCommands.forEach((cmd) => {
        helpText += `🔹 *${cmd.command}*\n   ➤ ${cmd.description}\n\n`;
      });
      helpText += `Página *${page}* de *${totalPages}*\n`;
      helpText += 'Escribe `!help [número]` para ir a otra página.';

      await sock.sendMessage(from, { text: helpText });

    } catch (error) {
      console.error('❌ Error en plugin !help:', error);
    }
  });
}
