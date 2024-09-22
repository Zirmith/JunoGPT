const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('createcontent')
        .setDescription('Generate content using AI with a specified exploit level and content type.')
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Description of the content to generate (e.g., "Create a teleport script for Roblox")')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('exploit_level')
                .setDescription('Specify the exploit level (e.g., Full, Partial, Basic)')
                .setRequired(false)
                .addChoices(
                    { name: 'Full', value: 'full' },
                    { name: 'Partial', value: 'partial' },
                    { name: 'Basic', value: 'basic' }
                )
        )
        .addStringOption(option =>
            option.setName('content_type')
                .setDescription('Type of content to generate (e.g., "code", "image", "story")')
                .setRequired(false)
                .addChoices(
                    { name: 'Code Snippet', value: 'code' },
                    { name: 'Image', value: 'image' },
                    { name: 'Story', value: 'story' }
                )
        ),
    async execute(interaction) {
        const description = interaction.options.getString('description');
        const exploitLevel = interaction.options.getString('exploit_level') || 'any';
        const contentType = interaction.options.getString('content_type') || 'code';

        const prompt = `Create ${contentType} content with an exploit level of ${exploitLevel}. The task is: ${description}.`;

        const processingEmbed = new MessageEmbed()
            .setColor('#0092e0')
            .setTitle('Content Generation in Progress')
            .setDescription(`Generating ${contentType} content for: "${description}" with exploit level: "${exploitLevel}"`)
            .setTimestamp();

        await interaction.reply({ embeds: [processingEmbed] });

        try {
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GOOGLE_API_KEY}`,
                {
                    contents: [
                        {
                            parts: [
                                {
                                    text: prompt
                                }
                            ]
                        }
                    ]
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            const aiResponse = response.data.candidates[0].content.parts[0].text;

            // Split the generated content into chunks to avoid message length limits
            const contentChunks = aiResponse.match(/[\s\S]{1,1014}/g); // Split into chunks of up to 1014 characters

            // Function to create an embed for a specific page
            const createEmbed = (pageNumber) => {
                const resultEmbed = new MessageEmbed()
                    .setColor('#00FF00')
                    .setTitle(`${contentType.charAt(0).toUpperCase() + contentType.slice(1)} Content`)
                    .setDescription(`Here is the generated ${contentType} content for "${description}" with exploit level "${exploitLevel}":`)
                    .addField('Generated Content', `\`\`\`${contentChunks[pageNumber]}\`\`\``)
                    .setFooter(`Page ${pageNumber + 1} of ${contentChunks.length}`)
                    .setTimestamp();
                return resultEmbed;
            };

            let currentPage = 0;

            // Initial reply with the first embed
            const initialEmbed = createEmbed(currentPage);

            // If there's more than one page, add pagination controls
            if (contentChunks.length > 1) {
                const row = new MessageActionRow()
                    .addComponents(
                        new MessageButton()
                            .setCustomId('prev')
                            .setLabel('◀️')
                            .setStyle('PRIMARY')
                            .setDisabled(currentPage === 0), // Disable if on the first page
                        new MessageButton()
                            .setCustomId('next')
                            .setLabel('▶️')
                            .setStyle('PRIMARY')
                            .setDisabled(currentPage === contentChunks.length - 1) // Disable if on the last page
                    );

                const message = await interaction.followUp({ embeds: [initialEmbed], components: [row] });

                // Collector to handle button clicks
                const collector = message.createMessageComponentCollector({ time: 60000 }); // 60 seconds

                collector.on('collect', async (i) => {
                    if (i.user.id !== interaction.user.id) return;

                    if (i.customId === 'next' && currentPage < contentChunks.length - 1) {
                        currentPage++;
                    } else if (i.customId === 'prev' && currentPage > 0) {
                        currentPage--;
                    }

                    // Update the embed and button states
                    await i.update({
                        embeds: [createEmbed(currentPage)],
                        components: [
                            new MessageActionRow()
                                .addComponents(
                                    new MessageButton()
                                        .setCustomId('prev')
                                        .setLabel('◀️')
                                        .setStyle('PRIMARY')
                                        .setDisabled(currentPage === 0),
                                    new MessageButton()
                                        .setCustomId('next')
                                        .setLabel('▶️')
                                        .setStyle('PRIMARY')
                                        .setDisabled(currentPage === contentChunks.length - 1)
                                )
                        ]
                    });
                });

                collector.on('end', () => {
                    message.edit({ components: [] }); // Remove buttons after timeout
                });
            } else {
                await interaction.followUp({ embeds: [initialEmbed] });
            }
        } catch (error) {
            console.error('Error interacting with AI API:', error);
            return interaction.followUp('Sorry, I couldn\'t generate the requested content at the moment.');
        }
    }
};
