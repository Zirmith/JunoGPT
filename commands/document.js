const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed, MessageAttachment } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');
const { exec } = require('child_process');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('document')
        .setDescription('Generate documentation for your code or ask about Synapse functions using AI.')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Choose whether to generate documentation or ask a question')
                .setRequired(true)
                .addChoices(
                    { name: 'Documentation', value: 'documentation' },
                    { name: 'Question', value: 'question' }
                )
        )
        .addStringOption(option =>
            option.setName('function')
                .setDescription('The Synapse function or code to generate documentation for or ask a question about')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('format')
                .setDescription('The format for the documentation (only for documentation type)')
                .addChoices(
                    { name: 'PDF', value: 'pdf' },
                    { name: 'Word', value: 'word' },
                    { name: 'Text', value: 'txt' }
                )
        ),
    async execute(interaction) {
        const type = interaction.options.getString('type');
        const functionOrCode = interaction.options.getString('function');
        const format = interaction.options.getString('format');

        let prompt;

        if (type === 'documentation') {
            prompt = `Generate detailed documentation for the following Roblox Synapse function or exploit code:\n\n${functionOrCode}`;
        } else {
            prompt = `Provide an explanation or answer the following question related to Roblox Synapse functions:\n\n${functionOrCode}`;
        }
        
        await interaction.deferReply(); // Defer the reply to give time for processing

        try {
            // Call AI API to generate the documentation or answer the question
            const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
                contents: [{ parts: [{ text: prompt }] }]
            });

            const resultText = response.data.candidates[0].content.parts[0].text;

            if (type === 'documentation') {
                // Determine the file format and generate the file
                const fileName = `documentation-${Date.now()}.${format === 'pdf' ? 'pdf' : format === 'word' ? 'docx' : 'txt'}`;
                const filePath = path.join(tmpdir(), fileName);

                // Writing the documentation based on the format selected
                if (format === 'pdf' || format === 'word') {
                    fs.writeFileSync(`${filePath}.md`, resultText);
                    exec(`pandoc ${filePath}.md -o ${filePath}`, (error) => {
                        if (error) throw error;
                        fs.unlinkSync(`${filePath}.md`);
                    });
                } else {
                    // Simply save the text content as a `.txt` file
                    fs.writeFileSync(filePath, resultText);
                }

                // Prepare the file as an attachment
                const fileAttachment = new MessageAttachment(filePath, fileName);

                // Send the generated file to the user
                const resultEmbed = new MessageEmbed()
                    .setColor('#00FF00')
                    .setTitle(`Documentation for Synapse Function`)
                    .setDescription(`Here's the generated documentation in **${format.toUpperCase()}** format.`);

                await interaction.followUp({ embeds: [resultEmbed], files: [fileAttachment] });

                // Clean up the file after sending
                setTimeout(() => fs.unlinkSync(filePath), 60000); // Delete the file after 1 minute
            } else {
                // Respond with the answer to the user's question
                const resultEmbed = new MessageEmbed()
                    .setColor('#00FF00')
                    .setTitle('Answer to your Synapse Function Question')
                    .setDescription(resultText);

                await interaction.followUp({ embeds: [resultEmbed] });
            }
        } catch (error) {
            console.error('Error generating response:', error);
            await interaction.followUp('Sorry, an error occurred while generating the response.');
        }
    }
};
