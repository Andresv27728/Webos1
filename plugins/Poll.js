import { delay } from '@whiskeysockets/baileys';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Convierte duración en formato DDD:HH:MM:SS a milisegundos
const parseDuration = (str) => {
    // Validamos con regex que sea formato correcto
    if (!/^\d{3}:\d{2}:\d{2}:\d{2}$/.test(str)) return 0;

    const [d, h, m, s] = str.split(':').map(x => parseInt(x));
    if ([d, h, m, s].some(isNaN)) return 0;

    return (((d * 24 + h) * 60 + m) * 60 + s) * 1000;
};

// Analiza el comando !poll de forma robusta
// Formato esperado:
// !poll ¿Pregunta completa? opción1, opción2, opción3 (enable|disable) (DDD:HH:MM:SS)
// (enable|disable) y duración son opcionales, y el texto puede contener espacios y signos de interrogación
const parsePollCommand = (text) => {
    // Eliminamos el prefijo y recortamos
    const withoutPrefix = text.trim().slice(5).trim();

    // Buscamos duracion y modo al final, si existen (entre paréntesis)
    // Expresión para extraer (enable) o (disable) y (DDD:HH:MM:SS)
    const modeRegex = /\((enable|disable)\)$/i;
    const durationRegex = /\((\d{3}:\d{2}:\d{2}:\d{2})\)$/;

    let mode = null;
    let durationStr = null;

    let tempStr = withoutPrefix;

    // Extraer duración si existe
    const durMatch = tempStr.match(durationRegex);
    if (durMatch) {
        durationStr = durMatch[1];
        tempStr = tempStr.slice(0, durMatch.index).trim();
    }

    // Extraer modo si existe
    const modeMatch = tempStr.match(modeRegex);
    if (modeMatch) {
        mode = modeMatch[1].toLowerCase();
        tempStr = tempStr.slice(0, modeMatch.index).trim();
    }

    // Ahora tempStr tiene "Pregunta opciones"
    // Separa pregunta de opciones por la última interrogación seguida de espacio
    // Ejemplo: "¿Cuál es tu color favorito? rojo, azul, verde"
    // Se busca el último signo de interrogación y se parte ahí

    // Encontrar índice último '?' que tiene espacio después
    const lastQuestionMarkIdx = tempStr.lastIndexOf('?');

    if (lastQuestionMarkIdx === -1) return null; // no hay pregunta

    const question = tempStr.slice(0, lastQuestionMarkIdx + 1).trim();
    const optionsRaw = tempStr.slice(lastQuestionMarkIdx + 1).trim();

    if (!optionsRaw) return null; // no hay opciones

    const options = optionsRaw.split(',').map(opt => opt.trim()).filter(Boolean);
    if (options.length < 2) return null; // se necesitan al menos 2 opciones

    return {
        question,
        options,
        multiple: mode === 'enable', // true si enable, false si disable o null
        durationStr,
        durationMs: durationStr ? parseDuration(durationStr) : null
    };
};

export default function (sock) {
    const polls = new Map();

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        // Obtener texto del mensaje
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const sender = msg.key.remoteJid;

        // Comando !poll
        if (text.toLowerCase().startsWith('!poll')) {
            const data = parsePollCommand(text);
            if (!data) {
                await sock.sendMessage(sender, {
                    text: '❌ Formato inválido.\nEjemplo:\n!poll ¿Cuál es tu color favorito? rojo, azul, verde (enable) (000:00:01:00)'
                });
                return;
            }

            const { question, options, multiple, durationStr, durationMs } = data;

            try {
                const pollMsg = await sock.sendMessage(sender, {
                    poll: {
                        name: question,
                        values: options,
                        selectableCount: multiple ? options.length : 1
                    }
                });

                const pollId = pollMsg.key.id;
                const poll = {
                    id: pollId,
                    question,
                    options,
                    multiple,
                    sender,
                    participants: new Map()
                };

                polls.set(pollId, poll);

                if (durationMs) {
                    poll.endAt = Date.now() + durationMs;

                    await sock.sendMessage(sender, {
                        text: `🕒 *Encuesta programada*\nDuración: ${durationStr}\nSe enviarán resultados automáticamente al finalizar.`
                    });

                    setTimeout(async () => {
                        const p = polls.get(pollId);
                        if (!p) return;

                        // Procesar resultados
                        const results = Array(p.options.length).fill(null).map(() => []);

                        for (const [user, votes] of p.participants.entries()) {
                            votes.forEach(voteIndex => {
                                if (results[voteIndex]) {
                                    results[voteIndex].push(user);
                                }
                            });
                        }

                        let resultText = `📊 *Resultados de la encuesta:*\n*${p.question}*\nDuración: ${durationStr}\n\n`;

                        p.options.forEach((opt, i) => {
                            const voters = results[i];
                            const mentions = voters.map(jid => `@${jid.split('@')[0]}`);
                            resultText += `• *${opt}* (${voters.length} votos)\n  ${mentions.join(', ') || '—'}\n\n`;
                        });

                        await sock.sendMessage(sender, {
                            text: resultText.trim(),
                            mentions: [...p.participants.keys()]
                        });

                        polls.delete(pollId);
                    }, durationMs);
                }

            } catch (e) {
                console.error('❌ Error al crear encuesta:', e);
                await sock.sendMessage(sender, { text: `❌ Error al crear la encuesta: ${e.message}` });
            }
        }

        // Registrar votos en encuestas activas
        if (msg.message?.pollUpdateMessage) {
            const updates = msg.message.pollUpdateMessage?.pollUpdates;
            if (!Array.isArray(updates)) return;

            for (const update of updates) {
                const pollId = update.pollCreationMessageKey?.id;
                const poll = polls.get(pollId);
                if (!poll) continue;

                const voter = msg.key.participant || msg.key.remoteJid;
                poll.participants.set(voter, update.selectedOptions || []);
            }
        }
    });
}
