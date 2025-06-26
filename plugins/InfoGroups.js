export default function (sock) {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const sender = msg.key.remoteJid;

        if (!text.toLowerCase().startsWith('!grupos')) return;

        const args = text.trim().split(' ');
        const isAdminOnly = text.toLowerCase().startsWith('!gruposadmin');
        const page = parseInt(args[1]) || 1;
        const itemsPerPage = 5;

        try {
            const chats = await sock.groupFetchAllParticipating();
            let groupList = Object.values(chats);

            if (isAdminOnly) {
                const botNumber = sock.user.id.split(':')[0];
                groupList = groupList.filter(group => {
                    const botData = group.participants.find(p => p.id.includes(botNumber));
                    return botData?.admin === 'admin' || botData?.admin === 'superadmin';
                });
            }

            if (groupList.length === 0) {
                await sock.sendMessage(sender, {
                    text: isAdminOnly
                        ? '🤖 No soy administrador en ningún grupo.'
                        : '🤖 No estoy en ningún grupo actualmente.'
                });
                return;
            }

            const totalPages = Math.ceil(groupList.length / itemsPerPage);
            if (page < 1 || page > totalPages) {
                await sock.sendMessage(sender, {
                    text: `❌ Página inválida. Elige una entre 1 y ${totalPages}.`
                });
                return;
            }

            const start = (page - 1) * itemsPerPage;
            const groupsToShow = groupList.slice(start, start + itemsPerPage);

            const botNumber = sock.user.id.split(':')[0];
            let response = `📊 *Grupos (${groupList.length} total) — Página ${page}/${totalPages}:*\n\n`;

            for (const group of groupsToShow) {
                const groupName = group.subject;
                const memberCount = group.participants.length;
                const owner = group.owner || 'Desconocido';
                const mentionOwner = owner.includes('@') ? `@${owner.split('@')[0]}` : owner;

                const botParticipant = group.participants.find(p => p.id.includes(botNumber));
                const botRank = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin'
                    ? 'Administrador'
                    : 'Miembro';

                let inviteLink = 'No disponible';
                try {
                    const code = await sock.groupInviteCode(group.id);
                    inviteLink = `https://chat.whatsapp.com/${code}`;
                } catch {}

                response += `📌 *${groupName}*\n👥 ${memberCount} miembros\n👑 Propietario: ${mentionOwner}\n🔗 Link: ${inviteLink}\n🛡️ RangoBot: ${botRank}\n\n`;
            }

            await sock.sendMessage(sender, {
                text: response.trim(),
                mentions: groupsToShow.map(g => g.owner).filter(Boolean)
            });

        } catch (err) {
            console.error('❌ Error al obtener grupos:', err);
            await sock.sendMessage(sender, {
                text: '❌ Ocurrió un error al obtener la lista de grupos.'
            });
        }
    });
}
