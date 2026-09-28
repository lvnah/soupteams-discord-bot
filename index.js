const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionsBitField } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');

// 1. HTTP Server for Render (Web Service)
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('SoupTeams Bot is running!\n');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`HTTP web server listening on port ${PORT}`);
});

// 2. Discord Bot Initialization with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// SQLite Database Connection
const db = new sqlite3.Database('./soupteams.db', (err) => {
    if (err) console.error('SQLite error:', err.message);
    else console.log('Connected to SOUPTEAMS SQLite database.');
});

db.run(`CREATE TABLE IF NOT EXISTS bot_users (
    discord_id TEXT PRIMARY KEY,
    username TEXT,
    role TEXT
)`);

client.once('clientReady', () => {
    console.log(`Bot logged in as ${client.user.tag}!`);
});
client.once('ready', () => {
    if (!client.user) return;
    console.log(`Bot logged in (ready) as ${client.user.tag}!`);
});

// Helper function to send logs to a specific channel named "logs"
async function sendLog(guild, embed) {
    try {
        const logChannel = guild.channels.cache.find(c => c.name === 'logs' && c.type === ChannelType.GuildText);
        if (logChannel) {
            await logChannel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error("Error sending log:", error);
    }
}

// Automatic assignment of the "Default" role & Logs
client.on('guildMemberAdd', async member => {
    try {
        const defaultRole = member.guild.roles.cache.find(role => role.name === 'Default');
        if (defaultRole) {
            await member.roles.add(defaultRole);
        }

        const logEmbed = new EmbedBuilder()
            .setTitle('📥 Member Joined')
            .setDescription(`**${member.user.tag}** (<@${member.user.id}>) has joined the server.`)
            .setColor(0x2ECC71)
            .setTimestamp();
        await sendLog(member.guild, logEmbed);
    } catch (error) {
        console.error("Error on member add:", error);
    }
});

client.on('guildMemberRemove', async member => {
    const logEmbed = new EmbedBuilder()
        .setTitle('📤 Member Left')
        .setDescription(`**${member.user.tag}** has left the server.`)
        .setColor(0xE74C3C)
        .setTimestamp();
    await sendLog(member.guild, logEmbed);
});

// Dynamic nickname update & Logs
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

                    const logEmbed = new EmbedBuilder()
                        .setTitle('✏️ Nickname Updated')
                        .setDescription(`User: <@${newMember.id}>\nNew Nickname: **${newNickname}**`)
                        .setColor(0xF1C40F)
                        .setTimestamp();
                    await sendLog(newMember.guild, logEmbed);
                }
            }
        }
    } catch (error) {
        console.error("Error updating nickname:", error);
    }
});

// Message Logs (Deleted & Edited)
client.on('messageDelete', async message => {
    if (!message.guild || message.author?.bot) return;
    const logEmbed = new EmbedBuilder()
        .setTitle('🗑️ Message Deleted')
        .setDescription(`**Author:** <@${message.author.id}>\n**Channel:** <#${message.channel.id}>\n**Content:**\n> ${message.content || '[Embed or Attachment]'}`)
        .setColor(0xE67E22)
        .setTimestamp();
    await sendLog(message.guild, logEmbed);
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (!newMessage.guild || newMessage.author?.bot || oldMessage.content === newMessage.content) return;
    const logEmbed = new EmbedBuilder()
        .setTitle('✏️ Message Edited')
        .setDescription(`**Author:** <@${newMessage.author.id}>\n**Channel:** <#${newMessage.channel.id}>\n**Before:**\n> ${oldMessage.content}\n**After:**\n> ${newMessage.content}`)
        .setColor(0x3498DB)
        .setTimestamp();
    await sendLog(newMessage.guild, logEmbed);
});

// Administrator commands (!rules, !informations, !setup-ticket)
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const hasFounderRole = message.member.roles.cache.some(role => role.name === 'Founder');

    if (message.content === '!rules') {
        if (!hasFounderRole) return message.reply({ content: "❌ This command is restricted to **Founder**." });

        const rulesEmbed = new EmbedBuilder()
            .setTitle('📜 SERVER RULES')
            .setDescription('*Please follow these guidelines to ensure a fair community for everyone.*')
            .setColor(0x2F3136)
            .addFields(
                { name: '🛡️ 1. No Cheating or Unfair Modifications', value: 'Any client modifications, hacks, X-Ray texture packs, macros, or automated scripts giving an unfair advantage over other players will result in a permanent, unappealable ban from SoupTeams.' },
                { name: '💬 2. Respect and Chat Etiquette', value: 'Harassment, hate speech, racism, excessive toxicity, advertising other servers, or leaking personal information (doxxing) in public chat is strictly prohibited.' },
                { name: '🐉 3. Bug Exploitation', value: 'If you discover a glitch, duplication method, or map exploit, you must report it immediately to staff on Discord. Using exploits for personal gain or team advantage will lead to rollbacks and bans.' },
                { name: '⚔️ 4. Team Regulations', value: 'Team betrayals (traitoring) inside claimed territory or allied agreements are managed in-game, but intentional griefing of core team infrastructure via alt accounts is strictly forbidden.' }
            );

        await message.channel.send({ embeds: [rulesEmbed] });
        await message.delete().catch(() => { });
    }

    if (message.content === '!informations') {
        if (!hasFounderRole) return message.reply({ content: "❌ This command is restricted to **Founder**." });

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
            .setColor(0xE74C3C);

        await message.channel.send({ embeds: [infoEmbed] });
        await message.delete().catch(() => { });
    }

    if (message.content === '!setup-ticket') {
        if (!hasFounderRole) return message.reply({ content: "❌ This command is restricted to **Founder**." });

        const ticketEmbed = new EmbedBuilder()
            .setTitle('🎫 SOUPTEAMS SUPPORT')
            .setDescription('Need help or want to contact the staff? Click the button below to open a ticket.')
            .setColor(0x3498DB);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('open_ticket_modal').setLabel('Open a Ticket').setStyle(ButtonStyle.Primary).setEmoji('🎫')
        );

        await message.channel.send({ embeds: [ticketEmbed], components: [row] });
        await message.delete().catch(() => { });
    }
});

// Handling Interactions (Buttons, Modals)
client.on('interactionCreate', async interaction => {
    // 1. Open Ticket Modal
    if (interaction.isButton() && interaction.customId === 'open_ticket_modal') {
        const modal = new ModalBuilder()
            .setCustomId('ticket_reason_modal')
            .setTitle('Ticket Reason');

        const reasonInput = new TextInputBuilder()
            .setCustomId('ticket_reason_input')
            .setLabel('Briefly explain your reason:')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Ex: Connection issue, store bug, question...')
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
    }

    // 2. Submit Ticket Modal & Create Private Channel
    if (interaction.isModalSubmit() && interaction.customId === 'ticket_reason_modal') {
        const reason = interaction.fields.getTextInputValue('ticket_reason_input');
        const guild = interaction.guild;
        const user = interaction.user;

        await interaction.reply({ content: `✅ Your ticket has been created successfully!`, ephemeral: true });

        const founderRole = guild.roles.cache.find(r => r.name === 'Founder');
        const modRole = guild.roles.cache.find(r => r.name === 'Mod');
        const helperRole = guild.roles.cache.find(r => r.name === 'Helper');

        const permissionOverwrites = [
            {
                id: guild.id,
                deny: [PermissionsBitField.Flags.ViewChannel],
            },
            {
                id: user.id,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory,
                ],
            },
        ];

        [founderRole, modRole, helperRole].forEach(role => {
            if (role) {
                permissionOverwrites.push({
                    id: role.id,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory,
                    ],
                });
            }
        });

        const ticketChannel = await guild.channels.create({
            name: `ticket-${user.username}`,
            type: ChannelType.GuildText,
            parent: interaction.channel.parentKey,
            permissionOverwrites: permissionOverwrites,
        });

        const privateEmbed = new EmbedBuilder()
            .setTitle(`🎫 Ticket from ${user.username}`)
            .setDescription(`**Provided Reason:**\n> ${reason}`)
            .setColor(0x3498DB)
            .setTimestamp();

        // Add a close button inside the private ticket channel
        const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );

        await ticketChannel.send({
            content: `Hello <@${user.id}>, here is your support channel! The staff team (<@&${founderRole?.id}>, <@&${modRole?.id}>, <@&${helperRole?.id}>) will get back to you shortly.`,
            embeds: [privateEmbed],
            components: [closeRow]
        });
    }

    // 3. Close Ticket Button
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await interaction.reply({ content: `🔒 Closing this ticket in 3 seconds...`, ephemeral: false });
        setTimeout(async () => {
            try {
                await interaction.channel.delete();
            } catch (err) {
                console.error("Error deleting ticket channel:", err);
            }
        }, 3000);
    }
});

client.login(process.env.DISCORD_TOKEN);
