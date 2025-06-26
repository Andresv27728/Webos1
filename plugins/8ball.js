// plugins/8ball.js
const respuestas = [
  "Sí.",
  "No.",
  "Tal vez.",
  "Posiblemente.",
  "Definitivamente sí.",
  "Definitivamente no.",
  "No estoy seguro.",
  "Pregúntame más tarde.",
  "Podría ser.",
  "Lo dudo.",
  "Claro que sí.",
  "No cuentes con ello.",
  "Todo apunta a que sí.",
  "Mis fuentes dicen que no.",
];

const cooldownsPorGrupo = {};         // { remoteJid: timestamp }
const tiempoCooldownPorGrupo = {};    // { remoteJid: tiempo en ms }
const COOLDOWN_DEFECTO = 30 * 1000;   // 30 segundos
const COOLDOWN_MAXIMO = 5 * 60 * 1000; // 5 minutos

export default function (sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    const text = m.message?.conversation || m.message?.extendedTextMessage?.text;
    if (!text || !text.toLowerCase().startsWith('!8ball')) return;

    const chatID = m.key.remoteJid;
    const senderID = m.key.participant || chatID;
    const args = text.slice(6).trim().split(/\s+/);

    // Si es para cambiar el cooldown: "!8ball cooldown 60"
    if (args[0]?.toLowerCase() === "cooldown" && args[1]) {
      const nuevoCooldown = parseInt(args[1]) * 1000;
      if (isNaN(nuevoCooldown)) {
        await sock.sendMessage(chatID, { text: "❌ El tiempo debe ser un número en segundos." });
        return;
      }

      if (nuevoCooldown > COOLDOWN_MAXIMO) {
        await sock.sendMessage(chatID, {
          text: `❌ El cooldown máximo es de ${COOLDOWN_MAXIMO / 1000} segundos.`,
        });
        return;
      }

      // Verificamos si el usuario es admin del grupo (solo si es grupo)
      const isGroup = chatID.endsWith('@g.us');
      if (isGroup) {
        try {
          const metadata = await sock.groupMetadata(chatID);
          const admins = metadata.participants.filter(p => p.admin).map(p => p.id);
          if (!admins.includes(senderID)) {
            await sock.sendMessage(chatID, {
              text: "⛔ Solo los administradores pueden cambiar el cooldown.",
            });
            return;
          }
        } catch (e) {
          console.error("Error verificando admins:", e);
          await sock.sendMessage(chatID, { text: "⚠️ No se pudo verificar permisos de admin." });
          return;
        }
      }

      tiempoCooldownPorGrupo[chatID] = nuevoCooldown;
      await sock.sendMessage(chatID, {
        text: `✅ Cooldown del comando *!8ball* establecido en ${nuevoCooldown / 1000} segundos.`,
      });
      return;
    }

    const pregunta = args.join(" ").trim();
    if (!pregunta) {
      await sock.sendMessage(chatID, {
        text: "🎱 Por favor, escribe una pregunta. Ejemplo: *!8ball Voy a tener suerte hoy?*",
      });
      return;
    }

    const ahora = Date.now();
    const cooldown = tiempoCooldownPorGrupo[chatID] ?? COOLDOWN_DEFECTO;

    if (cooldownsPorGrupo[chatID] && ahora - cooldownsPorGrupo[chatID] < cooldown) {
      const restante = Math.ceil((cooldown - (ahora - cooldownsPorGrupo[chatID])) / 1000);
      await sock.sendMessage(chatID, {
        text: `⏳ Este comando está en cooldown. Intenta de nuevo en ${restante} segundo(s).`,
      });
      return;
    }

    cooldownsPorGrupo[chatID] = ahora;

    const respuesta = respuestas[Math.floor(Math.random() * respuestas.length)];
    await sock.sendMessage(chatID, {
      text: `🎱 *Pregunta:* ${pregunta}\n🧠 *Respuesta:* ${respuesta}`,
    });
  });
}
