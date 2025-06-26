let mensajeEnviado = false;

export default async function (sock) {
  try {
    if (mensajeEnviado) return;

    const chats = await sock.groupFetchAllParticipating();
    const grupos = Object.entries(chats);

    const mensaje = `╭──〔  𝐈𝐭𝐬 𝐍𝐨𝐫𝐬 (𝐁𝐨𝐭) 〕──╮
│  𝐇𝐨𝐥𝐚! 𝐒𝐨𝐲 Its Nors, ᴛᴜ ʙᴏᴛ ᴀᴍɪɢᴏ y Estoy en línea 🤖 ✅
│  rECUERDA UTILIZAR !help para acceder a los comandos
│  Usa !help [número de página] para verlos comandos por pagna
│  Ejemplo: !help 1
│
│  ✐ Dev: IamLilSpooky 
│  📢 ᴄᴀɴᴀʟ ᴏғɪᴄɪᴀʟ: https://whatsapp.com/channel/0029VbAeSti2f3EKii6uLH2x
╰────────────────────────────╯`;

    for (const [id, data] of grupos) {
      await sock.sendMessage(id, { text: mensaje });
      await new Promise(resolve => setTimeout(resolve, 1500)); // espera 1.5s entre mensajes
    }

    mensajeEnviado = true;
  } catch (err) {
    console.error('❌ Error al enviar mensaje de inicio en grupos:', err);
  }
}

