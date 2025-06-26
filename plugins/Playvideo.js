import fs from 'fs';
import util from 'util';
import yts from 'yt-search';
import fetch from 'node-fetch';
import ytdlp from 'yt-dlp-exec';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';

const unlinkPromise = util.promisify(fs.unlink);
const statPromise = util.promisify(fs.stat);

// Asegurar que exista la carpeta playvideos/
const videoFolder = path.resolve('./Categorizador/Multimedia Play/playvideos');
if (!fs.existsSync(videoFolder)) {
  fs.mkdirSync(videoFolder, { recursive: true });
}

// Función para formatear tamaño del archivo
function formatBytes(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function registerVideoPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const msg = messages[0];
      const from = msg.key.remoteJid;
      if (!msg.message || !msg.message.conversation || msg.key.fromMe) return;

      const body = msg.message.conversation;
      if (!body.toLowerCase().startsWith('!video ')) return;

      const query = body.slice(7).trim();
      if (!query) {
        await sock.sendMessage(from, { text: '❗ Escribe el nombre de un video después de `!video`' });
        return;
      }

      const search = await yts(query);
      const video = search.videos[0];
      if (!video) {
        await sock.sendMessage(from, { text: '❌ No se encontró el video.' });
        return;
      }

      const { title, timestamp, url, author, image } = video;
      const videoFile = path.join(videoFolder, `video_${Date.now()}.mp4`);

      await sock.sendMessage(from, {
        image: { url: image },
        caption:
`「✦」Descargando *${title}*

> ✐ Canal » ${author.name}
> ⴵ Duración » ${timestamp}
> ✰ Calidad: 720p
> 🜸 Link » ${url}`
      });

      // Descargar video
      await ytdlp(url, {
        format: 'mp4',
        output: videoFile,
        quiet: true,
        ffmpegLocation: ffmpegPath,
      });

      const stats = await statPromise(videoFile);
      const size = formatBytes(stats.size);

      await sock.sendMessage(from, {
        video: { url: videoFile },
        mimetype: 'video/mp4',
        caption:
`> ✐ Canal » ${author.name}
> ⴵ Duración » ${timestamp}
> ✰ Calidad: 720p
> ❒ Tamaño » ${size}
> 🜸 Link » ${url}`
      });

      // Eliminar archivo tras 10 segundos
      setTimeout(async () => {
        if (fs.existsSync(videoFile)) {
          try {
            await unlinkPromise(videoFile);
            console.log(`✅ Eliminado: ${videoFile}`);
          } catch (err) {
            console.error(`❌ No se pudo eliminar: ${videoFile}`, err);
          }
        }
      }, 10000);

    } catch (err) {
      console.error('❌ Error en !video:', err);
      await sock.sendMessage(messages[0].key.remoteJid, {
        text: '⚠️ Ocurrió un error al procesar el video. Intenta nuevamente.'
      });
    }
  });
}
