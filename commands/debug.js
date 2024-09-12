const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');
const axios = require('axios');
const { Readable } = require('stream');

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
            try {
                const response = await axios.get(fileUrl, { responseType: 'stream' });
                codeContent = await streamToString(response.data);

                // Set file path based on language
                filePath = path.join(tmpdir(), `debug-${Date.now()}${fileExtension}`);
                fs.writeFileSync(filePath, codeContent);
            } catch (error) {
                console.error('Error downloading the file:', error);
                return interaction.reply('There was an error downloading the file.');
            }
        } else {
            filePath = path.join(tmpdir(), `debug-${Date.now()}.${language}`);
            fs.writeFileSync(filePath, codeContent);
        }

        let prompt;

        switch (language) {
            case 'java':
                prompt = `Debug the following Java code and provide feedback. Separate the response into sections: Code Review, Output, Feedback, Suggestions.\n\n${codeContent}`;
                break;
            case 'javascript':
                prompt = `Debug the following JavaScript code and provide feedback. Separate the response into sections: Code Review, Output, Feedback, Suggestions.\n\n${codeContent}`;
                break;
            case 'python':
                prompt = `Debug the following Python code and provide feedback. Separate the response into sections: Code Review, Output, Feedback, Suggestions.\n\n${codeContent}`;
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

            // Split the response into sections
            const sections = {
                codeReview: aiResponse.match(/(?<=--- Code Review ---)[\s\S]*?(?=--- Output ---)/)?.[0]?.trim() || 'No Code Review available.',
                output: aiResponse.match(/(?<=--- Output ---)[\s\S]*?(?=--- Feedback ---)/)?.[0]?.trim() || 'No Output available.',
                feedback: aiResponse.match(/(?<=--- Feedback ---)[\s\S]*?(?=--- Suggestions ---)/)?.[0]?.trim() || 'No Feedback available.',
                suggestions: aiResponse.match(/(?<=--- Suggestions ---)[\s\S]*$/)?.[0]?.trim() || 'No Suggestions available.'
            };

            // Create embeds for each section
            const embeds = [
                new MessageEmbed()
                    .setColor('#FFFF00')
                    .setTitle(`${language.charAt(0).toUpperCase() + language.slice(1)} Code Debugging (Code Review)`)
                    .addField('Code Review', `\`\`\`\n${sections.codeReview}\n\`\`\``)
                    .setTimestamp(),
                new MessageEmbed()
                    .setColor('#FFFF00')
                    .setTitle(`${language.charAt(0).toUpperCase() + language.slice(1)} Code Debugging (Output)`)
                    .addField('Output', `\`\`\`\n${sections.output}\n\`\`\``)
                    .setTimestamp(),
                new MessageEmbed()
                    .setColor('#FFFF00')
                    .setTitle(`${language.charAt(0).toUpperCase() + language.slice(1)} Code Debugging (Feedback)`)
                    .addField('Feedback', `\`\`\`\n${sections.feedback}\n\`\`\``)
                    .setTimestamp(),
                new MessageEmbed()
                    .setColor('#FFFF00')
                    .setTitle(`${language.charAt(0).toUpperCase() + language.slice(1)} Code Debugging (Suggestions)`)
                    .addField('Suggestions', `\`\`\`\n${sections.suggestions}\n\`\`\``)
                    .setTimestamp()
            ];

            // Send paginated embeds with message buttons
            let currentPage = 0;

            const message = await interaction.followUp({ embeds: [embeds[currentPage]], components: [getRow(currentPage, embeds.length)] });

            const filter = i => i.customId === 'prev' || i.customId === 'next';

            const collector = message.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async i => {
                if (i.customId === 'next' && currentPage < embeds.length - 1) {
                    currentPage++;
                } else if (i.customId === 'prev' && currentPage > 0) {
                    currentPage--;
                }
                await i.update({ embeds: [embeds[currentPage]], components: [getRow(currentPage, embeds.length)] });
            });

            collector.on('end', () => {
                message.edit({ components: [] });
            });

        } catch (error) {
            console.error('Error interacting with AI API:', error);
            return interaction.followUp('Sorry, I couldn\'t generate a response at the moment.');
        } finally {
            // Clean up temporary files
            fs.unlinkSync(filePath);
        }
    }
};

// Helper function to handle buttons
function getRow(currentPage, totalPages) {
    return new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId('prev')
                .setLabel('Previous')
                .setStyle('PRIMARY')
                .setDisabled(currentPage === 0),
            new MessageButton()
                .setCustomId('next')
                .setLabel('Next')
                .setStyle('PRIMARY')
                .setDisabled(currentPage === totalPages - 1)
        );
}

// Helper function to convert stream to string
async function streamToString(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        stream.on('error', reject);
    });
}
