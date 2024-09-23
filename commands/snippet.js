const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('snippet')
        .setDescription('Generate a code snippet for Roblox exploits and Synapse functions using AI.')
        .addStringOption(option =>
            option.setName('language')
                .setDescription('The scripting language for the snippet')
                .setRequired(true)
                .addChoices(
                    { name: 'Lua (Roblox)', value: 'lua-roblox' },
                    { name: 'Synapse Lua', value: 'synapse-lua' },
                    { name: 'ScriptWare Lua', value: 'scriptware-lua' },
                    { name: 'Fluxus Lua', value: 'fluxus-lua' },
                    { name: 'KRNL Lua', value: 'krnl-lua' },
                    { name: 'Oxygen U Lua', value: 'oxygen-u-lua' }
                )
        )
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Description of the snippet (e.g., "Create an auto-clicker script for Roblox")')
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
        ),
    async execute(interaction) {
        const language = interaction.options.getString('language');
        const description = interaction.options.getString('description');
        const exploitLevel = interaction.options.getString('exploit_level') || 'any';

        // Custom prompt for generating snippets with specific exploit functions or Synapse methods
        const prompt = `Create a ${language} code snippet for a Roblox  function. The  level is ${exploitLevel}. The task is: ${description}.`;

        // Initial embed message while processing
        const processingEmbed = new MessageEmbed()
            .setColor('#0092e0') // Blue color
            .setTitle('Snippet Generation in Progress')
            .setDescription(`Generating a ${language} code snippet for: "${description}" with exploit level: "${exploitLevel}"`)
            .setTimestamp();

        await interaction.reply({ embeds: [processingEmbed] });

        try {
            // Request to the AI API
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

            // Split the generated snippet into chunks if necessary
            const snippetChunks = aiResponse.match(/[\s\S]{1,1014}/g); // Split into chunks of up to 1014 characters

            // Function to create an embed for a specific page
            const createEmbed = (pageNumber) => {
                const resultEmbed = new MessageEmbed()
                    .setColor('#00FF00') // Green color
                    .setTitle(`${language.charAt(0).toUpperCase() + language.slice(1)} Code Snippet`)
                    .setDescription(`Here is the generated code snippet for "${description}" with exploit level "${exploitLevel}":`)
                    .addField('Snippet', `\`\`\`${language}\n${snippetChunks[pageNumber]}\n\`\`\``)
                    .setFooter(`Page ${pageNumber + 1} of ${snippetChunks.length}`)
                    .setTimestamp();
                return resultEmbed;
            };

            let currentPage = 0;

            // Initial reply with the first embed
            const initialEmbed = createEmbed(currentPage);

            // If there's more than one page, add pagination controls
            if (snippetChunks.length > 1) {
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
                            .setDisabled(currentPage === snippetChunks.length - 1) // Disable if on the last page
                    );

                const message = await interaction.followUp({ embeds: [initialEmbed], components: [row] });

                // Collector to handle button clicks
                const collector = message.createMessageComponentCollector({ time: 60000 }); // 60 seconds

                collector.on('collect', async (i) => {
                    if (i.user.id !== interaction.user.id) return;

                    if (i.customId === 'next' && currentPage < snippetChunks.length - 1) {
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
                                        .setDisabled(currentPage === snippetChunks.length - 1)
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
            return interaction.followUp('Sorry, I couldn\'t generate a snippet at the moment.');
        }
    }
};
