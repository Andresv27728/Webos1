import fetch from 'node-fetch'; // Asegúrate de instalar node-fetch si usas Node 16

const API_KEY = '5A0485D675FD677EF2535B15179CFCEF';

export default function (sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    const text = m.message.conversation || m.message?.extendedTextMessage?.text;
    if (!text || !text.startsWith('!ip')) return;

    const partes = text.trim().split(/\s+/);
    const ip = partes[1];

    if (!ip) {
      await sock.sendMessage(m.key.remoteJid, {
        text: "❌ Por favor, proporciona una dirección IP. Ejemplo: *!ip 8.8.8.8*"
      });
      return;
    }

    try {
      const res = await fetch(`https://api.ip2location.io/?key=${API_KEY}&ip=${ip}`);
      const data = await res.json();

      if (data.error || data.country_name === "-") {
        await sock.sendMessage(m.key.remoteJid, {
          text: `❌ No se pudo obtener información para la IP proporcionada.`
        });
        return;
      }

      const mapaUrl = `https://www.google.com/maps/search/?api=1&query=${data.latitude},${data.longitude}`;

      const mensaje = `
🌐 *Información para la IP:* \`${ip}\`

📍 *País:* ${data.country_name}
📛 *Región:* ${data.region_name}
🏙️ *Ciudad:* ${data.city_name}
📮 *Código Postal:* ${data.zip_code}
🛰️ *ISP:* ${data.isp}
🏢 *Dominio:* ${data.domain}
🌎 *Latitud / Longitud:* ${data.latitude}, ${data.longitude}
⏰ *Zona Horaria:* ${data.time_zone}
📌 *Mapa:* ${mapaUrl}

ℹ️ *Tipo de uso:* ${data.usage_type}
🔗 *ASN:* ${data.asn} (${data.as})
🛡️ *Proxy:* ${data.is_proxy === "TRUE" ? "Sí" : "No"}
`.trim();

      await sock.sendMessage(m.key.remoteJid, {
        text: mensaje
      });

    } catch (error) {
      console.error('❌ Error al consultar la IP:', error);
      await sock.sendMessage(m.key.remoteJid, {
        text: "❌ Ocurrió un error al consultar la IP. Intenta más tarde."
      });
    }
  });
}
