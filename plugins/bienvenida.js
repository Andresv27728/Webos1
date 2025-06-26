import fs from "fs";
import path from "path";
import { downloadMediaMessage } from "@whiskeysockets/baileys";

export default async function bienvenidaPlugin(sock) {
  const dbDir = "./Categorizador/db";
  const file = `${dbDir}/bienvenidas.json`;
  const mediaDir = "./Categorizador/media";
  const picDir = "./Categorizador/media/pic";

  const esperaDescripcion = {};
  const esperaImagen = {};

  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({}));
  if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir);
  if (!fs.existsSync(picDir)) fs.mkdirSync(picDir);

  let bienvenidas = JSON.parse(fs.readFileSync(file));

  const saveData = () => {
    fs.writeFileSync(file, JSON.stringify(bienvenidas, null, 2));
  };

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0];
    if (!m.message || !m.key.remoteJid.endsWith("@g.us")) return;

    const groupId = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;
    const body =
      m.message?.conversation || m.message?.extendedTextMessage?.text || "";
    const isImageMsg = m.message?.imageMessage;

    if (
      esperaImagen[groupId] &&
      esperaImagen[groupId] === sender &&
      isImageMsg
    ) {
      try {
        const buffer = await downloadMediaMessage(
          m,
          "buffer",
          {},
          { logger: console },
        );
        const fileName = `${groupId}.jpg`;
        const savePath = path.join(picDir, fileName);
        fs.writeFileSync(savePath, buffer);

        if (!bienvenidas[groupId]) bienvenidas[groupId] = { enabled: true };
        bienvenidas[groupId].imagen = fileName;
        delete esperaImagen[groupId];
        saveData();

        return await sock.sendMessage(
          groupId,
          {
            text: "✅ Imagen de bienvenida guardada correctamente.",
          },
          { quoted: m },
        );
      } catch (err) {
        console.error("Error al guardar imagen:", err);
        return await sock.sendMessage(
          groupId,
          {
            text: "❌ Error al guardar la imagen. Asegúrate de enviar una imagen válida.",
          },
          { quoted: m },
        );
      }
    }

    if (esperaDescripcion[groupId] && esperaDescripcion[groupId] === sender) {
      if (!bienvenidas[groupId]) bienvenidas[groupId] = { enabled: true };
      bienvenidas[groupId].mensaje = body;
      delete esperaDescripcion[groupId];
      saveData();
      return await sock.sendMessage(
        groupId,
        {
          text: "✅ Descripción de bienvenida guardada correctamente.",
          mentions: [sender],
        },
        { quoted: m },
      );
    }

    const args = body.trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    if (command === "!bienvenida") {
      const accion = args[0]?.toLowerCase();

      if (!accion) {
        return await sock.sendMessage(
          groupId,
          {
            text: "✳️ Usa: *!bienvenida on*, *!bienvenida off*, *!bienvenida prueba*, *!bienvenida description*, *!bienvenida setpic*",
          },
          { quoted: m },
        );
      }

      if (accion === "on") {
        if (!bienvenidas[groupId]) bienvenidas[groupId] = {};
        bienvenidas[groupId].enabled = true;
        if (!bienvenidas[groupId].mensaje) {
          bienvenidas[groupId].mensaje =
            `🎉 ¡Bienvenido/a al grupo (usermention)}!\nEsperamos que la pases genial 💫`;
        }
        saveData();
        return await sock.sendMessage(
          groupId,
          {
            text: "✅ El sistema de bienvenida ha sido *activado*.",
          },
          { quoted: m },
        );
      } else if (accion === "off") {
        if (!bienvenidas[groupId]) bienvenidas[groupId] = {};
        bienvenidas[groupId].enabled = false;
        saveData();
        return await sock.sendMessage(
          groupId,
          {
            text: "⛔ El sistema de bienvenida ha sido *desactivado*.",
          },
          { quoted: m },
        );
      } else if (accion === "description") {
        const admins = (await sock.groupMetadata(groupId)).participants
          .filter((p) => p.admin !== null)
          .map((p) => p.id);

        if (!admins.includes(sender)) {
          return await sock.sendMessage(
            groupId,
            {
              text: "❌ Solo los administradores pueden cambiar la descripción de bienvenida.",
            },
            { quoted: m },
          );
        }

        esperaDescripcion[groupId] = sender;
        return await sock.sendMessage(
          groupId,
          {
            text: `✍️ Escribe un mensaje personalizado. Ejemplo:
Hola (usermention)} bienvenido a (groupname)}!

Placeholders disponibles:
| Placeholder           | Descripción                          |
|-----------------------|--------------------------------------|
| (user)}               | Mención directa                      |
| (usermention)}        | Igual que (user)}                    |
| (username)}           | Nombre visible del usuario           |
| (usernumber)}         | Número sin @s.whatsapp.net          |
| (group)}              | Nombre del grupo                     |
| (groupname)}          | Alias de (group)}                    |
| (groupid)}            | ID del grupo                         |
| (membercount)}        | Total de miembros del grupo          |
| (date)}               | Fecha actual (DD/MM/YYYY)            |
| (time)}               | Hora actual (HH:MM:SS)               |`,
          },
          { quoted: m },
        );
      } else if (accion === "setpic") {
        const admins = (await sock.groupMetadata(groupId)).participants
          .filter((p) => p.admin !== null)
          .map((p) => p.id);

        if (!admins.includes(sender)) {
          return await sock.sendMessage(
            groupId,
            {
              text: "❌ Solo los administradores pueden cambiar la imagen de bienvenida.",
            },
            { quoted: m },
          );
        }

        esperaImagen[groupId] = sender;
        return await sock.sendMessage(
          groupId,
          {
            text: "📸 Envíame una imagen ahora para usarla en la bienvenida.",
          },
          { quoted: m },
        );
      } else if (accion === "prueba") {
        if (!bienvenidas[groupId]?.enabled) {
          return await sock.sendMessage(
            groupId,
            {
              text: "⚠️ La bienvenida está *desactivada*. Usa *!bienvenida on* para activarla.",
            },
            { quoted: m },
          );
        }

        return await enviarBienvenida(sock, groupId, sender, m);

      } else if (accion === "forzar") {
        let targetUser = null;

        if (m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
          targetUser = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }

        if (!targetUser && m.message?.extendedTextMessage?.contextInfo?.participant) {
          targetUser = m.message.extendedTextMessage.contextInfo.participant;
        }

        if (!targetUser) {
          return await sock.sendMessage(
            groupId,
            {
              text: "⚠️ Debes mencionar a un usuario o responder a su mensaje para usar este comando.",
            },
            { quoted: m }
          );
        }

        if (!bienvenidas[groupId]?.enabled) {
          return await sock.sendMessage(
            groupId,
            {
              text: "⚠️ La bienvenida está *desactivada*. Usa *!bienvenida on* para activarla.",
            },
            { quoted: m }
          );
        }

        return await enviarBienvenida(sock, groupId, targetUser, m);
      } else {
        return await sock.sendMessage(
          groupId,
          {
            text: "⚠️ Opción inválida. Usa *on*, *off*, *description*, *setpic*, o *prueba*.",
          },
          { quoted: m },
        );
      }
    }
  });

  sock.ev.on("group-participants.update", async (update) => {
    try {
      const { id, participants, action } = update;
      if (action !== "add") return;
      if (!bienvenidas[id]?.enabled) return;

      for (const user of participants) {
        await enviarBienvenida(sock, id, user);
      }
    } catch (error) {
      console.error("Error en bienvenidaPlugin grupo:", error);
    }
  });

  async function enviarBienvenida(sock, groupId, userId, quotedMsg = null) {
    try {
      const groupMetadata = await sock.groupMetadata(groupId);
      const groupName = groupMetadata.subject;
      const memberCount = groupMetadata.participants.length;
      const number = userId.split("@")[0];
      const now = new Date();
      const date = now.toLocaleDateString("es-ES");
      const time = now.toLocaleTimeString("es-ES");

      let username = number;
      try {
        const contacto = sock.contacts?.[userId] || {};
        if (contacto.name) username = contacto.name;
        else if (contacto.notify) username = contacto.notify;
      } catch (e) {
        console.error("No se pudo obtener nombre del usuario:", e);
      }

      let mensaje =
        bienvenidas[groupId]?.mensaje ||
        `🎉 ¡Bienvenido/a al grupo (usermention)}!\nEsperamos que la pases genial 💫`;

      mensaje = mensaje
        .replace(/\(user(?:mention)?\)}/g, `@${number}`)
        .replace(/\(username\)}/g, username)
        .replace(/\(usernumber\)}/g, number)
        .replace(/\(group(?:name)?\)}/g, groupName)
        .replace(/\(groupid\)}/g, groupId)
        .replace(/\(membercount\)}/g, memberCount)
        .replace(/\(date\)}/g, date)
        .replace(/\(time\)}/g, time);

      let archivoPath = null;
      if (bienvenidas[groupId]?.imagen) {
        const customPath = path.join(picDir, bienvenidas[groupId].imagen);
        if (fs.existsSync(customPath)) archivoPath = customPath;
      }

      if (!archivoPath) {
        const archivos = fs
          .readdirSync(mediaDir)
          .filter((file) => /\.(jpe?g|png|gif|webp)$/i.test(file));
        if (archivos.length > 0) archivoPath = path.join(mediaDir, archivos[0]);
      }

      if (archivoPath) {
        if (/\.gif$/i.test(archivoPath)) {
          await sock.sendMessage(
            groupId,
            {
              video: { url: archivoPath },
              gifPlayback: true,
              caption: mensaje,
              mentions: [userId],
            },
            { quoted: quotedMsg },
          );
        } else {
          await sock.sendMessage(
            groupId,
            {
              image: { url: archivoPath },
              caption: mensaje,
              mentions: [userId],
            },
            { quoted: quotedMsg },
          );
        }
      } else {
        await sock.sendMessage(
          groupId,
          {
            text: mensaje,
            mentions: [userId],
          },
          { quoted: quotedMsg },
        );
      }
    } catch (err) {
      console.error("Error al enviar bienvenida:", err);
    }
  }
}