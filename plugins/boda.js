// plugins/boda.js
export default async function bodaPlugin(sock) {
  const casados = new Map();
  const divorciados = [];
  const propuestas = new Map(); // clave = target, valor = { from, timeout }

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message) return;

    const isGroup = m.key.remoteJid.endsWith('@g.us');
    const sender = m.key.participant || m.key.remoteJid;
    const body = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
    const args = body.trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    if (!command || !command.startsWith('!')) return;

    // comando !married
    if (command === '!married') {
      const subCommand = args[0]?.toLowerCase();

      if (subCommand === 'accept' || subCommand === 'denied') {
        const propuesta = propuestas.get(sender);
        if (!propuesta) {
          return await sock.sendMessage(m.key.remoteJid, {
            text: '❌ No tienes ninguna solicitud de matrimonio pendiente.',
          }, { quoted: m });
        }

        const { from, timeout } = propuesta;
        const parejaKey = [from, sender].sort().join('+');

        if (subCommand === 'accept') {
          if (casados.has(parejaKey)) {
            return await sock.sendMessage(m.key.remoteJid, {
              text: '❌ Ya están casados.',
            }, { quoted: m });
          }

          casados.set(parejaKey, { fecha: new Date().toLocaleDateString(), pareja: parejaKey });
          clearTimeout(timeout);
          propuestas.delete(sender);

          const texto = `💍 *${getMentionName(from)}* y *${getMentionName(sender)}* se han casado 💞 ¡Felicidades!`;
          const mentions = [from, sender];

          await sock.sendMessage(from, { text: texto, mentions });
          await sock.sendMessage(sender, { text: texto, mentions });
          if (isGroup) {
            await sock.sendMessage(m.key.remoteJid, { text: texto, mentions });
          }

        } else if (subCommand === 'denied') {
          clearTimeout(timeout);
          propuestas.delete(sender);

          const texto = `❌ *${getMentionName(sender)}* ha rechazado la propuesta de matrimonio de *${getMentionName(from)}*`;
          await sock.sendMessage(from, { text: texto });
          if (isGroup) {
            await sock.sendMessage(m.key.remoteJid, { text: texto });
          }
        }

        return;
      }

      // !married @user
      const mention = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      if (!mention) {
        return await sock.sendMessage(m.key.remoteJid, {
          text: '❌ Menciona a alguien para casarte.',
        }, { quoted: m });
      }

      if (mention === sender) {
        return await sock.sendMessage(m.key.remoteJid, {
          text: '❌ No puedes casarte contigo mismo.',
        }, { quoted: m });
      }

      const parejaKey = [sender, mention].sort().join('+');
      if (casados.has(parejaKey)) {
        return await sock.sendMessage(m.key.remoteJid, {
          text: '❌ Ya están casados.',
        }, { quoted: m });
      }

      if (propuestas.has(mention)) {
        return await sock.sendMessage(m.key.remoteJid, {
          text: '❌ Esa persona ya tiene una solicitud pendiente.',
        }, { quoted: m });
      }

      // Guardar propuesta y timeout
      const timeout = setTimeout(() => {
        propuestas.delete(mention);
        sock.sendMessage(sender, {
          text: `⌛ La solicitud de matrimonio a *${getMentionName(mention)}* ha expirado.`,
        });
      }, 10 * 60 * 1000); // 10 minutos

      propuestas.set(mention, { from: sender, timeout });

      const textoGrupo = `💍 ${getMentionName(sender)} quiere casarse con ${getMentionName(mention)}\n\n` +
        `${getMentionName(mention)}, responde con *!married accept* o *!married denied* para aceptar o rechazar.`;

      const mentions = [sender, mention];

      if (isGroup) {
        await sock.sendMessage(m.key.remoteJid, { text: textoGrupo, mentions }, { quoted: m });
      }

      // Mensaje privado al mentionado
      await sock.sendMessage(mention, {
        text: `💍 *${getMentionName(sender)}* quiere casarse contigo.\n\nResponde con *!married accept* o *!married denied* para confirmar.`,
        mentions: [sender],
      });
    }

    // comando !divorse
    if (command === '!divorse') {
      const mention = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      if (!mention) {
        return await sock.sendMessage(m.key.remoteJid, {
          text: '❌ Menciona a alguien para divorciarte.',
        }, { quoted: m });
      }

      const parejaKey = [sender, mention].sort().join('+');
      if (!casados.has(parejaKey)) {
        return await sock.sendMessage(m.key.remoteJid, {
          text: '❌ No están casados.',
        }, { quoted: m });
      }

      casados.delete(parejaKey);
      divorciados.push({ fecha: new Date().toLocaleDateString(), pareja: parejaKey });

      const texto = `💔 *${getMentionName(sender)}* y *${getMentionName(mention)}* se han divorciado.`;
      await sock.sendMessage(m.key.remoteJid, {
        text: texto,
        mentions: [sender, mention],
      }, { quoted: m });
    }

    // comando !list
    if (command === '!list') {
      let texto = '💞 *MARRIED LIST*\n';
      for (const { fecha, pareja } of Array.from(casados.values())) {
        const [p1, p2] = pareja.split('+');
        texto += `\n👩‍❤️‍👨 *${getMentionName(p1)}* y *${getMentionName(p2)}* están casados [${fecha}]`;
      }

      if (divorciados.length) {
        texto += '\n\n💔 *DIVORCED LIST*\n';
        for (const { fecha, pareja } of divorciados) {
          const [p1, p2] = pareja.split('+');
          texto += `\n💔 *${getMentionName(p1)}* y *${getMentionName(p2)}* se han divorciado [${fecha}]`;
        }
      }

      await sock.sendMessage(m.key.remoteJid, {
        text: texto,
        mentions: Array.from(new Set(texto.match(/\d{10,}@s\.whatsapp\.net/g))) || [],
      }, { quoted: m });
    }
  });

  function getMentionName(jid) {
    return `@${jid.split('@')[0]}`;
  }
}
