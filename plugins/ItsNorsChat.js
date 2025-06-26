import fs from 'fs';

export default async function ItsNorschatPlugin(sock) {
  const dbDir = './db';
  const dbFile = './Categorizador/db/itsnorschat.json';

  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);
  if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, JSON.stringify({ groups: {}, active: {} }));

  let data = JSON.parse(fs.readFileSync(dbFile));
  const saveData = () => fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));

  function findResponse(groupId, message) {
    const phrases = data.groups[groupId] || [];
    if (phrases.length === 0) return null;

    const words = message.toLowerCase().split(/\s+/);
    const candidates = phrases.filter(p =>
      words.some(w => p.toLowerCase().includes(w)) &&
      p.toLowerCase() !== message.toLowerCase()
    );

    if (candidates.length === 0) return null;

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function isValidToLearn(text) {
    const lower = text.toLowerCase();
    return (
      !lower.startsWith('!') &&
      !lower.startsWith('.') &&
      !lower.startsWith('/') &&
      !lower.startsWith('#') &&
      !lower.includes('http') &&
      !/@[0-9]{5,}/.test(lower) && // evita menciones
      lower.length > 4 &&
      lower.length < 120 &&
      !/^\W+$/.test(lower) // evita solo símbolos o emojis
    );
  }

  function generateHumanLikeResponse(message) {
    const msg = message.toLowerCase();

    if (msg.includes('hola')) return '¡Hola! ¿Cómo estás? 😊';
    if (msg.includes('triste')) return 'Oh no 😢 ¿Qué pasó? Estoy aquí para escucharte.';
    if (msg.includes('feliz')) return '¡Eso me alegra! 😄 Cuéntame más.';
    if (msg.includes('ayuda')) return '¿Necesitas ayuda con algo? Estoy atento.';
    if (msg.includes('gracias')) return '¡De nada! Siempre a tu servicio 🤖';
    if (msg.includes('quién eres') || msg.includes('eres un bot'))
      return 'Soy ItsNorschat, tu bot compañero. ¡Estoy aprendiendo contigo! 🤖';

    return null;
  }

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || !m.key.remoteJid.endsWith('@g.us') || m.key.fromMe) return;

    const groupId = m.key.remoteJid;
    const sender = m.key.participant;
    const body =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      m.message.imageMessage?.caption ||
      '';

    if (!body) return;

    if (!data.groups[groupId]) data.groups[groupId] = [];
    if (typeof data.active[groupId] === 'undefined') data.active[groupId] = false;

    // Comando de control
    if (body.startsWith('!ItsNorschat')) {
      const args = body.trim().split(/\s+/);
      if (args.length < 2) {
        return await sock.sendMessage(groupId, { text: 'Uso: !ItsNorschat on/off' }, { quoted: m });
      }

      const option = args[1].toLowerCase();
      if (option === 'on') {
        data.active[groupId] = true;
        saveData();
        return await sock.sendMessage(groupId, { text: '🤖 ItsNorschat activado. Estoy aprendiendo y hablando!' }, { quoted: m });
      } else if (option === 'off') {
        data.active[groupId] = false;
        saveData();
        return await sock.sendMessage(groupId, { text: '🤖 ItsNorschat desactivado.' }, { quoted: m });
      } else {
        return await sock.sendMessage(groupId, { text: 'Opción inválida. Usa: on o off.' }, { quoted: m });
      }
    }

    if (!data.active[groupId]) return;

    const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const botMentioned = mentions.includes(sock.user.id) || body.toLowerCase().includes('itsnors');

    const lowerBody = body.toLowerCase().trim();

    // ✅ APRENDIZAJE controlado
    if (isValidToLearn(body) && !data.groups[groupId].includes(body)) {
      data.groups[groupId].push(body);
      if (data.groups[groupId].length > 500) data.groups[groupId].shift();
      saveData();
    }

    // ✅ RESPUESTA con emoción si fue mención directa
    if (botMentioned) {
      const logicalResponse = generateHumanLikeResponse(body);
      const randomResponse = findResponse(groupId, body);
      const reply = logicalResponse || randomResponse || '¿Sí? Estoy escuchando 👀';

      return await sock.sendMessage(groupId, { text: reply }, { quoted: m });
    }

    // ✅ Responde aleatoriamente solo si encuentra algo lógico
    if (Math.random() < 0.3) {
      const response = findResponse(groupId, body);
      if (response) {
        await sock.sendMessage(groupId, { text: response });
      }
    }
  });
}
