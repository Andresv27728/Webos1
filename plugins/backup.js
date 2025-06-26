import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import fetch from 'node-fetch';

const BACKUP_DIR = './Backup';

function generateBackupID(length = 12) {
  return randomBytes(length).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, length);
}

function saveJSON(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function readJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function deleteFolderRecursive(folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach(file => {
      const curPath = path.join(folderPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(folderPath);
  }
}

export default function backupPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages?.[0];
    if (!msg || !msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const body = msg.message?.conversation?.trim();
    if (!body?.startsWith('!backup')) return;

    const args = body.split(' ');
    const isGroup = from.endsWith('@g.us');
    if (!isGroup) return await sock.sendMessage(from, { text: '❌ Solo puede usarse en grupos.', quoted: msg });

    // === !backup create ===
    if (body.startsWith('!backup create')) {
      const metadata = await sock.groupMetadata(from);
      const backupID = generateBackupID();
      const backupPath = path.join(BACKUP_DIR, from, backupID);
      const infoPath = path.join(backupPath, 'info.json');

      const admins = metadata.participants.filter(p => p.admin).map(p => p.id);
      const data = {
        id: from,
        name: metadata.subject,
        description: metadata.desc || '',
        settings: {
          announcement: metadata.announce ?? false,
          restrict: metadata.restrict ?? false,
        },
        admins,
        createdAt: new Date().toISOString(),
      };

      saveJSON(infoPath, data);

      // Foto de perfil
      try {
        const url = await sock.profilePictureUrl(from, 'image');
        if (url) {
          const buffer = Buffer.from(await (await fetch(url)).arrayBuffer());
          fs.writeFileSync(path.join(backupPath, 'profile.jpg'), buffer);
        }
      } catch {}

      await sock.sendMessage(from, {
        text: `✅ *Backup creado exitosamente*\n\n📦 ID: ${backupID}\n\nUsa:\n• !backup info ${backupID}\n• !backup load ${backupID}`,
        quoted: msg
      });
      return;
    }

    // === !backup info <id> ===
    if (body.startsWith('!backup info')) {
      const backupID = args[2];
      if (!backupID) {
        return await sock.sendMessage(from, {
          text: '❌ Uso: !backup info <backup_id>',
          quoted: msg
        });
      }

      const infoPath = path.join(BACKUP_DIR, from, backupID, 'info.json');
      const info = readJSON(infoPath);
      if (!info) {
        return await sock.sendMessage(from, {
          text: '❌ Backup no encontrado.',
          quoted: msg
        });
      }

      const text =
        `📦 *Backup ${backupID}*\n\n` +
        `📛 Nombre: ${info.name}\n` +
        `📝 Descripción: ${info.description || '—'}\n` +
        `🔒 Solo admins pueden escribir: ${info.settings.announcement ? 'Sí' : 'No'}\n` +
        `✏️ Solo admins pueden editar info: ${info.settings.restrict ? 'Sí' : 'No'}\n` +
        `🛡️ Admins: ${info.admins.length}\n` +
        `🕒 Creado: ${new Date(info.createdAt).toLocaleString()}`;

      return await sock.sendMessage(from, { text, quoted: msg });
    }

    // === !backup load <id> ===
    if (body.startsWith('!backup load')) {
      const backupID = args[2];
      if (!backupID) {
        return await sock.sendMessage(from, {
          text: '❌ Uso: !backup load <backup_id>',
          quoted: msg
        });
      }

      const base = path.join(BACKUP_DIR, from, backupID);
      const info = readJSON(path.join(base, 'info.json'));
      if (!info) {
        return await sock.sendMessage(from, {
          text: '❌ Backup no encontrado.',
          quoted: msg
        });
      }

      try {
        await sock.groupUpdateSubject(from, info.name);
        await sock.groupUpdateDescription(from, info.description);
        await sock.groupSettingUpdate(from, 'announcement', info.settings.announcement ? 'on' : 'off');
        await sock.groupSettingUpdate(from, 'restrict', info.settings.restrict ? 'on' : 'off');
      } catch (e) {
        console.warn('[!] Error restaurando configuración:', e.message);
      }

      const metadata = await sock.groupMetadata(from);
      const currentAdmins = metadata.participants.filter(p => p.admin).map(p => p.id);
      const toPromote = info.admins.filter(j => !currentAdmins.includes(j));
      for (const jid of toPromote) {
        try {
          await sock.groupParticipantsUpdate(from, [jid], 'promote');
        } catch (e) {
          console.warn(`[!] No se pudo promover a ${jid}:`, e.message);
        }
      }

      const imgPath = path.join(base, 'profile.jpg');
      if (fs.existsSync(imgPath)) {
        try {
          await sock.updateProfilePicture(from, fs.readFileSync(imgPath));
        } catch (e) {
          console.warn('[!] Error al restaurar imagen:', e.message);
        }
      }

      return await sock.sendMessage(from, {
        text: `✅ Backup *${backupID}* restaurado correctamente.`,
        quoted: msg
      });
    }

    // === !backup list ===
    if (body === '!backup list') {
      const groupBackupPath = path.join(BACKUP_DIR, from);
      if (!fs.existsSync(groupBackupPath)) {
        return await sock.sendMessage(from, {
          text: '📭 Este grupo aún no tiene backups.',
          quoted: msg
        });
      }

      const backups = fs.readdirSync(groupBackupPath).filter(f => fs.existsSync(path.join(groupBackupPath, f, 'info.json')));
      if (backups.length === 0) {
        return await sock.sendMessage(from, {
          text: '📭 No hay backups registrados para este grupo.',
          quoted: msg
        });
      }

      const list = backups.map((id, i) => `• ${i + 1}. ${id}`).join('\n');
      return await sock.sendMessage(from, {
        text: `📦 *Backups disponibles (${backups.length}):*\n\n${list}`,
        quoted: msg
      });
    }

    // === !backup delete <id> ===
    if (body.startsWith('!backup delete')) {
      const backupID = args[2];
      if (!backupID) {
        return await sock.sendMessage(from, {
          text: '❌ Uso: !backup delete <backup_id>',
          quoted: msg
        });
      }

      const dirPath = path.join(BACKUP_DIR, from, backupID);
      if (!fs.existsSync(dirPath)) {
        return await sock.sendMessage(from, {
          text: '❌ No se encontró ningún backup con ese ID en este grupo.',
          quoted: msg
        });
      }

      try {
        deleteFolderRecursive(dirPath);
        return await sock.sendMessage(from, {
          text: `🗑️ Backup *${backupID}* eliminado correctamente.`,
          quoted: msg
        });
      } catch (e) {
        return await sock.sendMessage(from, {
          text: `❌ Error eliminando backup: ${e.message}`,
          quoted: msg
        });
      }
    }
  });
}
