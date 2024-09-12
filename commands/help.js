const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Provides a list of available commands'),
    async execute(interaction) {
        const commands = interaction.client.commands.map(cmd => `**/${cmd.data.name}**: ${cmd.data.description}`).join('\n');
        await interaction.reply(`Here are the available commands:\n${commands}`);
    }
};
