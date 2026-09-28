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

// Automatic assignment of the "Default" role
client.on('guildMemberAdd', async member => {
    try {
        const defaultRole = member.guild.roles.cache.find(role => role.name === 'Default');
        if (defaultRole) {
            await member.roles.add(defaultRole);
            console.log(`'Default' role assigned to ${member.user.tag}`);
        }
    } catch (error) {
        console.error("Error assigning default role:", error);
    }
});

// Dynamic nickname update
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
                    console.log(`Nickname updated for ${baseName}: ${newNickname}`);
                }
            }
        }
    } catch (error) {
        console.error("Error updating nickname:", error);
    }
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
        await message.delete().catch(() => {});
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
        await message.delete().catch(() => {});
    }

    // Command to setup the ticket panel in the support channel
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
        await message.delete().catch(() => {});
    }
});

// Handling Interactions (Buttons and Modals)
client.on('interactionCreate', async interaction => {
    // 1. When clicking the "Open a Ticket" button -> Open a Modal window
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

    // 2. When the player submits the modal form
    if (interaction.isModalSubmit() && interaction.customId === 'ticket_reason_modal') {
        const reason = interaction.fields.getTextInputValue('ticket_reason_input');
        const guild = interaction.guild;
        const user = interaction.user;

        // Respond ephemerally to validate submission
        await interaction.reply({ content: `✅ Your ticket has been created successfully!`, ephemeral: true });

        // Search for Staff roles ("Founder", "Mod", "Helper")
        const founderRole = guild.roles.cache.find(r => r.name === 'Founder');
        const modRole = guild.roles.cache.find(r => r.name === 'Mod');
        const helperRole = guild.roles.cache.find(r => r.name === 'Helper');

        // Configure permissions for the new private channel
        const permissionOverwrites = [
            {
                id: guild.id, // @everyone
                deny: [PermissionsBitField.Flags.ViewChannel],
            },
            {
                id: user.id, // The player opening the ticket
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory,
                ],
            },
        ];

        // Add permissions to staff roles if they exist
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

        // Create the channel in the current category
        const ticketChannel = await guild.channels.create({
            name: `ticket-${user.username}`,
            type: ChannelType.GuildText,
            parent: interaction.channel.parentKey,
            permissionOverwrites: permissionOverwrites,
        });

        // Send the summary message inside the private channel
        const privateEmbed = new EmbedBuilder()
            .setTitle(`🎫 Ticket from ${user.username}`)
            .setDescription(`**Provided Reason:**\n> ${reason}`)
            .setColor(0x3498DB)
            .setTimestamp();

        await ticketChannel.send({
            content: `Hello <@${user.id}>, here is your support channel! The staff team (<@&${founderRole?.id}>, <@&${modRole?.id}>, <@&${helperRole?.id}>) will get back to you shortly.`,
            embeds: [privateEmbed]
        });
    }
});

client.login(process.env.DISCORD_TOKEN);
