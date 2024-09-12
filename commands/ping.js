const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong!'),
    async execute(interaction) {
        // Create the initial embed with "Ping" message
        const initialEmbed = new MessageEmbed()
            .setColor('#FFD700') // Yellow color
            .setTitle('Ping')
            .setDescription('Pinging...')
            .setTimestamp();

        // Send the initial reply
        const reply = await interaction.reply({
            embeds: [initialEmbed],
            fetchReply: true
        });

        // Calculate latency
        const latency = Date.now() - interaction.createdTimestamp;

        // Create the final embed with "Pong" message
        const finalEmbed = new MessageEmbed()
            .setColor('#FFD700') // Yellow color
            .setTitle('Pong!')
            .setDescription(`Latency is \`${latency}ms\`!`)
            .setTimestamp();

        // Delay for a cool effect
        setTimeout(() => {
            // Update the initial message with the final response
            reply.edit({ embeds: [finalEmbed] });
        }, 1000); // 1-second delay for effect
    }
};
