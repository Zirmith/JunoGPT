const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('debug')
        .setDescription('Get help with debugging your code.')
        .addStringOption(option =>
            option.setName('language')
                .setDescription('The programming language of your code')
                .setRequired(true)
                .addChoices(
                    { name: 'Java', value: 'java' },
                    { name: 'JavaScript', value: 'javascript' },
                    { name: 'Python', value: 'python' }
                )
        )
        .addStringOption(option =>
            option.setName('code')
                .setDescription('The code you need help with')
                .setRequired(false)
        )
        .addAttachmentOption(option =>
            option.setName('file')
                .setDescription('Upload a file containing your code')
                .setRequired(false)
        ),
    async execute(interaction) {
        const language = interaction.options.getString('language');
        const code = interaction.options.getString('code');
        const file = interaction.options.getAttachment('file');

        // Determine if code is provided as text or via file upload
        let codeContent = code || '';
        let filePath;

        if (file) {
            const fileUrl = file.url;
            const fileExtension = path.extname(file.name).toLowerCase();

            // Download the file from Discord's CDN
            const response = await fetch(fileUrl);
            codeContent = await response.text();

            // Set file path based on language
            filePath = path.join(tmpdir(), `debug-${Date.now()}${fileExtension}`);
            fs.writeFileSync(filePath, codeContent);
        } else {
            filePath = path.join(tmpdir(), `debug-${Date.now()}.${language === 'java' ? 'java' : language}`);
            fs.writeFileSync(filePath, codeContent);
        }

        let prompt;

        switch (language) {
            case 'java':
                prompt = `Debug the following Java code and provide feedback:\n\n${codeContent}`;
                break;
            case 'javascript':
                prompt = `Debug the following JavaScript code and provide feedback:\n\n${codeContent}`;
                break;
            case 'python':
                prompt = `Debug the following Python code and provide feedback:\n\n${codeContent}`;
                break;
            default:
                return interaction.reply('Unsupported language.');
        }

        // Send an initial message with an embed indicating processing
        const processingEmbed = new MessageEmbed()
            .setColor('#FFFF00') // Yellow color
            .setTitle('Code Debugging')
            .setDescription(`Processing your ${language} code, please wait...`)
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

            // Pagination logic if response exceeds Discord's embed field limit
            const splitResponse = aiResponse.match(/[\s\S]{1,1000}/g); // Split response into chunks of 1000 characters

            const pages = splitResponse.map((chunk, index) => {
                return new MessageEmbed()
                    .setColor('#FFFF00')
                    .setTitle(`${language.charAt(0).toUpperCase() + language.slice(1)} Code Debugging (Page ${index + 1}/${splitResponse.length})`)
                    .setDescription(`Here is the debugging feedback for your ${language} code:`)
                    .addField('Output', `\`\`\`\n${chunk}\n\`\`\``)
                    .setFooter(`Page ${index + 1} of ${splitResponse.length}`)
                    .setTimestamp();
            });

            // Send paginated embeds
            let currentPage = 0;

            const message = await interaction.followUp({ embeds: [pages[currentPage]] });

            if (pages.length > 1) {
                // React with previous/next buttons
                await message.react('⬅️');
                await message.react('➡️');

                const filter = (reaction, user) => {
                    return ['⬅️', '➡️'].includes(reaction.emoji.name) && user.id === interaction.user.id;
                };

                const collector = message.createReactionCollector({ filter, time: 60000 });

                collector.on('collect', reaction => {
                    if (reaction.emoji.name === '➡️') {
                        if (currentPage < pages.length - 1) {
                            currentPage++;
                            message.edit({ embeds: [pages[currentPage]] });
                        }
                    } else if (reaction.emoji.name === '⬅️') {
                        if (currentPage > 0) {
                            currentPage--;
                            message.edit({ embeds: [pages[currentPage]] });
                        }
                    }
                });

                collector.on('end', () => {
                    message.reactions.removeAll();
                });
            }
        } catch (error) {
            console.error('Error interacting with AI API:', error);
            return interaction.followUp('Sorry, I couldn\'t generate a response at the moment.');
        } finally {
            // Clean up temporary files
            fs.unlinkSync(filePath);
        }
    }
};
