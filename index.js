const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');

// 1. Serveur HTTP pour Render (Web Service)
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('SoupTeams Bot is running!\n');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur web HTTP à l'écoute sur le port ${PORT}`);
});

// 2. Initialisation du Bot Discord avec les intents nécessaires
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Connexion à la base de données SQLite
const db = new sqlite3.Database('./soupteams.db', (err) => {
    if (err) console.error('Erreur SQLite:', err.message);
    else console.log('Connecté à la base de données SOUPTEAMS.');
});

db.run(`CREATE TABLE IF NOT EXISTS bot_users (
    discord_id TEXT PRIMARY KEY,
    username TEXT,
    role TEXT
)`);

client.once('clientReady', () => {
    console.log(`Bot connecté en tant que ${client.user.tag} !`);
});
client.once('ready', () => {
    if (!client.user) return;
    console.log(`Bot connecté (ready) en tant que ${client.user.tag} !`);
});

// 3. Attribution automatique du rôle "Default" à l'arrivée d'un nouveau membre
client.on('guildMemberAdd', async member => {
    try {
        const defaultRole = member.guild.roles.cache.find(role => role.name === 'Default');
        if (defaultRole) {
            await member.roles.add(defaultRole);
            console.log(`Rôle 'Default' attribué à ${member.user.tag}`);
        } else {
            console.log("Le rôle 'Default' est introuvable sur ce serveur.");
        }
    } catch (error) {
        console.error("Erreur lors de l'attribution du rôle par défaut :", error);
    }
});

// 4. Mise à jour dynamique du pseudo : [Nom du rôle] Pseudo
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;

        if (oldRoles.size !== newRoles.size) {
            const highestRole = newMember.roles.highest;

            if (highestRole && highestRole.name !== '@everyone') {
                const baseName = newMember.user.username;
                const newNickname = `[${highestRole.name}] ${baseName}`;

                if (newMember.nickname !== newNickname) {
                    await newMember.setNickname(newNickname);
                    console.log(`Pseudo mis à jour pour ${baseName} : ${newNickname}`);
                }
            }
        }
    } catch (error) {
        console.error("Erreur lors de la mise à jour du pseudo :", error);
    }
});

// 5. Commandes !rules et !informations réservées au rôle "Founder"
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // Vérification globale du rôle Founder pour les commandes d'administration
    const hasFounderRole = message.member.roles.cache.some(role => role.name === 'Founder');

    if (message.content === '!rules') {
        if (!hasFounderRole) {
            return message.reply({ content: "❌ Tu n'as pas la permission d'utiliser cette commande (réservée aux **Founder**)." });
        }

        const rulesEmbed = new EmbedBuilder()
            .setTitle('📜 SERVER RULES')
            .setDescription('*Please follow these guidelines to ensure a fair community for everyone.*')
            .setColor(0x2F3136)
            .addFields(
                {
                    name: '🛡️ 1. No Cheating or Unfair Modifications',
                    value: 'Any client modifications, hacks, X-Ray texture packs, macros, or automated scripts giving an unfair advantage over other players will result in a permanent, unappealable ban from SoupTeams.'
                },
                {
                    name: '💬 2. Respect and Chat Etiquette',
                    value: 'Harassment, hate speech, racism, excessive toxicity, advertising other servers, or leaking personal information (doxxing) in public chat is strictly prohibited.'
                },
                {
                    name: '🐉 3. Bug Exploitation',
                    value: 'If you discover a glitch, duplication method, or map exploit, you must report it immediately to staff on Discord. Using exploits for personal gain or team advantage will lead to rollbacks and bans.'
                },
                {
                    name: '⚔️ 4. Team Regulations',
                    value: 'Team betrayals (traitoring) inside claimed territory or allied agreements are managed in-game, but intentional griefing of core team infrastructure via alt accounts is strictly forbidden.'
                }
            );

        await message.channel.send({ embeds: [rulesEmbed] });
        await message.delete().catch(() => { });
    }

    if (message.content === '!informations') {
        if (!hasFounderRole) {
            return message.reply({ content: "❌ Tu n'as pas la permission d'utiliser cette commande (réservée aux **Founder**)." });
        }

        const infoEmbed = new EmbedBuilder()
            .setTitle('🍒 About SoupTeams')
            .setDescription(
                'This server was not created with the goal of reaching 500 concurrent players. We are well aware that "PvP Soup"—especially team-based—is no longer the main trend. However, for us, it represents a golden era that left a lasting mark on our lives.\n\n' +
                'Consequently, the server doesn\'t require massive funding, and we want to be completely transparent with you about this:\n\n' +
                '• **Where funds go:** Revenue from rank purchases will be used **solely** for the domain name, the website, hosting, and server improvements.\n' +
                '• **Our goal:** Even if the server maintains a steady community of **15 to 20 concurrent players**, we will have achieved our mission!\n' +
                '• **Our commitment:** We will do our utmost to roll out updates and new features—while staying true to the OG theme—along with hosting regular events and more.\n\n' +
                '🌐 **Website:** https://soupteams.eu/\n' +
                '🎮 **Minecraft IP:** `mc.soupteams.eu`\n\n' +
                '*Thanks for being a part of this journey with us! ❤️*'
            )
            .setColor(0xE74C3C); // Joli rouge rappelant la cerise 🍒

        await message.channel.send({ embeds: [infoEmbed] });
        await message.delete().catch(() => { });
    }
});

client.login(process.env.DISCORD_TOKEN);
