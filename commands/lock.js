const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');

let isLocked = false; // Global variable to keep track of the lock status

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Locks all other commands. Only available to the bot owner.'),
    async execute(interaction) {
        // Check if the user is the bot owner
        if (interaction.user.id !== process.env.BOT_OWNER_ID) {
            return interaction.reply({
                content: 'You do not have permission to use this command.',
                ephemeral: true
            });
        }

        // Toggle the lock status
        isLocked = !isLocked;
        
        const status = isLocked ? 'locked' : 'unlocked';
        
        // Send a confirmation message
        const embed = new MessageEmbed()
            .setColor(isLocked ? '#FF0000' : '#00FF00') // Red for locked, green for unlocked
            .setTitle('Command Lock Status')
            .setDescription(`All commands have been ${status}.`)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }
};

