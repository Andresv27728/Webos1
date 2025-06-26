import chalk from 'chalk';

export default function giveawayPlugin(sock) {
  const giveaways = {};

  const timeToMs = (input) => {
    const match = input.match(/^(\d+)(s|m|h)$/);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2];
    return unit === 's' ? value * 1000
         : unit === 'm' ? value * 60 * 1000
         : unit === 'h' ? value * 60 * 60 * 1000
         : null;
  };

  console.log(chalk.green('[✅ Plugin de Sorteos Cargado]'));

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;

    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
    if (!body || !body.startsWith('!giveaway')) return;

    const args = body.trim().split(' ').slice(1);

    // Validación de argumentos mínimos
    if (args.length < 3) {
      await sock.sendMessage(from, {
        text: `❌ *Uso incorrecto del comando*\n\nEjemplo:\n*!giveaway Nitro 1m 2*\n\nFormato válido de tiempo: 10s, 5m, 1h`,
      });
      return;
    }

    const timeArg = args[args.length - 2];
    const winnersArg = args[args.length - 1];
    const prize = args.slice(0, -2).join(' ');

    const ms = timeToMs(timeArg);
    const winnersCount = parseInt(winnersArg);

    if (!prize || isNaN(winnersCount) || !ms) {
      await sock.sendMessage(from, {
        text: `❌ *Parámetros inválidos*\n\nFormato correcto:\n*!giveaway <premio> <duración> <#ganadores>*\nEjemplo: *!giveaway Nitro 1m 2*`,
      });
      return;
    }

    // Enviar mensaje del sorteo
    const giveawayMessage = await sock.sendMessage(from, {
      text: `🎉 *¡SORTEO INICIADO!* 🎉\n\n🎁 *Premio:* ${prize}\n🕒 *Duración:* ${timeArg}\n🏆 *Ganadores:* ${winnersCount}\n👤 *Organizador:* @${sender.split('@')[0]}\n\nReacciona con 🎉 para participar.`,
      mentions: [sender],
    });

    const messageId = giveawayMessage.key.id;

    // Reacción del bot para marcar el emoji
    await sock.sendMessage(from, {
      react: {
        text: '🎉',
        key: giveawayMessage.key
      }
    });

    giveaways[messageId] = {
      prize,
      winnersCount,
      participants: new Set(),
      chatId: from,
    };

    // Temporizador para finalizar el sorteo
    setTimeout(async () => {
      const giveaway = giveaways[messageId];
      if (!giveaway) return;

      const allParticipants = Array.from(giveaway.participants);
      const realParticipants = allParticipants.filter(jid => jid !== sock.user.id);

      if (realParticipants.length === 0) {
        await sock.sendMessage(from, {
          text: `❌ El sorteo de *${prize}* terminó sin participantes.`,
        });
      } else {
        const winners = [];
        while (winners.length < giveaway.winnersCount && realParticipants.length > 0) {
          const index = Math.floor(Math.random() * realParticipants.length);
          winners.push(realParticipants.splice(index, 1)[0]);
        }

        const mentions = winners.map(w => `@${w.split('@')[0]}`).join('\n');
        await sock.sendMessage(from, {
          text: `🏆 *¡SORTEO FINALIZADO!* 🏆\n\n🎁 *Premio:* ${prize}\n🎉 *Ganadores:*\n${mentions}`,
          mentions: winners
        });
      }

      delete giveaways[messageId];
    }, ms);
  });

  // Manejo de reacciones
  sock.ev.on('messages.reaction', async (reactionUpdate) => {
    try {
      const { key, reaction, sender } = reactionUpdate;
      if (!key?.id || !reaction) return;

      const giveaway = giveaways[key.id];
      if (!giveaway) return;

      if (reaction === '🎉') {
        giveaway.participants.add(sender);
      }
    } catch (err) {
      console.error('[❌ Error en reacción de sorteo]:', err);
    }
  });
}
