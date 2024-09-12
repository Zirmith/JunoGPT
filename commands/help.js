const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Provides a list of available commands'),
    async execute(interaction) {
        const commands = interaction.client.commands.map(cmd => ({
            name: `/${cmd.data.name}`,
            description: cmd.data.description
        }));

        const pageSize = 10; // Number of commands per page
        const pages = [];

        // Split commands into pages
        for (let i = 0; i < commands.length; i += pageSize) {
            const pageCommands = commands.slice(i, i + pageSize);
            const description = pageCommands.map(cmd => `**${cmd.name}**: ${cmd.description}`).join('\n');

            const embed = new MessageEmbed()
                .setColor('#FFD700') // Yellow color
                .setTitle('Available Commands')
                .setDescription(description)
                .setFooter({ text: `Page ${Math.ceil(i / pageSize) + 1} of ${Math.ceil(commands.length / pageSize)}` })
                .setTimestamp();

            pages.push(embed);
        }

        let currentPage = 0;

        const message = await interaction.reply({
            embeds: [pages[currentPage]],
            fetchReply: true
        });

        // Add reactions for pagination
        await message.react('◀️');
        await message.react('▶️');

        const filter = (reaction, user) => {
            return ['◀️', '▶️'].includes(reaction.emoji.name) && user.id === interaction.user.id;
        };

        const collector = message.createReactionCollector({ filter, time: 60000 });

        collector.on('collect', reaction => {
            if (reaction.emoji.name === '▶️') {
                currentPage = (currentPage + 1) % pages.length;
            } else if (reaction.emoji.name === '◀️') {
                currentPage = (currentPage - 1 + pages.length) % pages.length;
            }

            message.edit({ embeds: [pages[currentPage]] });
            reaction.users.remove(interaction.user.id);
        });

        collector.on('end', () => {
            message.reactions.removeAll().catch(error => console.error('Failed to clear reactions:', error));
        });
    }
};
