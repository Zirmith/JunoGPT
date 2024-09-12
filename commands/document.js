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
        .setDescription('Generate documentation for your code using AI.')
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
                .setDescription('The code to generate documentation for')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('format')
                .setDescription('The format for the documentation')
                .setRequired(true)
                .addChoices(
                    { name: 'PDF', value: 'pdf' },
                    { name: 'Word', value: 'word' },
                    { name: 'Text', value: 'txt' }
                )
        ),
    async execute(interaction) {
        const language = interaction.options.getString('language');
        const code = interaction.options.getString('code');
        const format = interaction.options.getString('format');

        const prompt = `Generate detailed documentation for the following ${language} code:\n\n${code}`;
        
        await interaction.deferReply(); // Defer the reply to give time for processing

        try {
            // Call AI API to generate the documentation
            const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
                contents: [{ parts: [{ text: prompt }] }]
            });

            const documentation = response.data.candidates[0].content.parts[0].text;

            // Determine the file format and generate the file
            const fileName = `documentation-${Date.now()}.${format === 'pdf' ? 'pdf' : format === 'word' ? 'docx' : 'txt'}`;
            const filePath = path.join(tmpdir(), fileName);

            // Writing the documentation based on the format selected
            if (format === 'pdf') {
                // Generate a PDF using a command-line tool like `pandoc` or a library
                fs.writeFileSync(`${filePath}.md`, documentation);
                exec(`pandoc ${filePath}.md -o ${filePath}`, (error) => {
                    if (error) throw error;
                    fs.unlinkSync(`${filePath}.md`);
                });
            } else if (format === 'word') {
                // Generate a Word document using `pandoc`
                fs.writeFileSync(`${filePath}.md`, documentation);
                exec(`pandoc ${filePath}.md -o ${filePath}`, (error) => {
                    if (error) throw error;
                    fs.unlinkSync(`${filePath}.md`);
                });
            } else {
                // Simply save the text content as a `.txt` file
                fs.writeFileSync(filePath, documentation);
            }

            // Prepare the file as an attachment
            const fileAttachment = new MessageAttachment(filePath, fileName);

            // Send the generated file to the user
            const resultEmbed = new MessageEmbed()
                .setColor('#00FF00')
                .setTitle(`Documentation for ${language} Code`)
                .setDescription(`Here's the generated documentation in **${format.toUpperCase()}** format.`);

            await interaction.followUp({ embeds: [resultEmbed], files: [fileAttachment] });

            // Clean up the file after sending
            setTimeout(() => fs.unlinkSync(filePath), 60000); // Delete the file after 1 minute
        } catch (error) {
            console.error('Error generating documentation:', error);
            await interaction.followUp('Sorry, an error occurred while generating the documentation.');
        }
    }
};
