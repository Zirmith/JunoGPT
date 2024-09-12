const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reload-commands')
        .setDescription('Reloads all bot commands.'),
    async execute(interaction) {
        // Check if commands are locked
        if (botData.isLocked && interaction.user.id !== process.env.BOT_OWNER_ID) {
            return interaction.reply({
                content: 'Commands are currently locked. Only the bot owner can use commands.',
                ephemeral: true
            });
        }

        try {
            // Reload command files
            client.commands.clear();
            const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

            for (const file of commandFiles) {
                const command = require(`./commands/${file}`);
                client.commands.set(command.data.name, command);
            }

            // Register commands with Discord API
            const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

            await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
                body: client.commands.map(command => command.data.toJSON()),
            });

            await interaction.reply('Successfully reloaded application commands!');
        } catch (error) {
            console.error(error);
            await interaction.reply('There was an error reloading the commands.');
        }
    },
};
