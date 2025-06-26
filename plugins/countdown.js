  import { setTimeout as wait } from 'timers/promises';

export default function countdownPlugin(sock) {
  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const sender = msg.key.remoteJid;

    if (!text.toLowerCase().startsWith('!countdown')) return;

    // Extraer comando y argumentos
    const args = text.trim().split(/\s+/).slice(1);
    if (args.length === 0) {
      await sock.sendMessage(sender, { text: '❌ Uso: !countdown HH:MM:SS [mensaje opcional]' });
      return;
    }

    // Validar formato HH:MM:SS o MM:SS o SS
    const timeStr = args[0];
    const msgCustom = args.slice(1).join(' ') || '⏰ ¡El tiempo ha terminado!';

    // Función para convertir HH:MM:SS a segundos
    function parseTime(str) {
      const parts = str.split(':').map(Number);
      if (parts.some(isNaN)) return null;

      let seconds = 0;
      if (parts.length === 3) {
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        seconds = parts[0] * 60 + parts[1];
      } else if (parts.length === 1) {
        seconds = parts[0];
      } else {
        return null;
      }
      return seconds;
    }

    const totalSeconds = parseTime(timeStr);

    if (totalSeconds === null || totalSeconds <= 0) {
      await sock.sendMessage(sender, { text: '❌ Formato inválido o tiempo menor o igual a cero. Usa HH:MM:SS, MM:SS o SS' });
      return;
    }

    if (totalSeconds > 86400) { // 24 horas límite
      await sock.sendMessage(sender, { text: '❌ El tiempo máximo permitido es 24 horas (86400 segundos).' });
      return;
    }

    // Función para formatear segundos a HH:MM:SS
    function formatTime(s) {
      const h = Math.floor(s / 3600).toString().padStart(2, '0');
      const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
      const sec = (s % 60).toString().padStart(2, '0');
      return `${h}:${m}:${sec}`;
    }

    try {
      await sock.sendMessage(sender, {
        text: `⏳ Cuenta regresiva iniciada: *${formatTime(totalSeconds)}* segundos.\nMensaje final: ${msgCustom}`
      });

      // Esperar la cantidad de segundos (sin bloquear el proceso)
      await wait(totalSeconds * 1000);

      await sock.sendMessage(sender, { text: `⏰ Tiempo finalizado!\n${msgCustom}` });

    } catch (e) {
      console.error('❌ Error en countdown:', e);
      await sock.sendMessage(sender, { text: '❌ Ocurrió un error inesperado ejecutando la cuenta regresiva.' });
    }
  });
}
