const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed, MessageAttachment } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');
const archiver = require('archiver');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('imagine')
        .setDescription('Generate any code for any language or purpose.')
        .addStringOption(option =>
            option.setName('request')
                .setDescription('Describe what you want to create (e.g., "HTML landing page using CSS").')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('language')
                .setDescription('The programming language to generate the code in.')
                .setRequired(true)
        ),
    async execute(interaction) {
        const request = interaction.options.getString('request');
        const language = interaction.options.getString('language');
        const prompt = `Create the following project using ${language}: ${request}`;

        await interaction.deferReply(); // Defer to allow processing time

        try {
            // Generate code via AI
            const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
                contents: [{ parts: [{ text: prompt + ": dont explain anything and dont include the ``` stuff for syntax " }] }]
            });

            const generatedCode = response.data.candidates[0].content.parts[0].text;

            // Create temporary directory and files for the project
            const projectDir = path.join(tmpdir(), `project-${Date.now()}`);
            if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir);

            // File extension based on language
            let fileExtension = '';
            switch (language.toLowerCase()) {
                case 'html': fileExtension = 'html'; break;
                case 'javascript': fileExtension = 'js'; break;
                case 'python': fileExtension = 'py'; break;
                case 'java': fileExtension = 'java'; break;
                default: fileExtension = 'txt'; break;
            }

            // Save generated code to a file
            const filePath = path.join(projectDir, `main.${fileExtension}`);
            fs.writeFileSync(filePath, generatedCode);

            // Create a zip file for the project
            const zipPath = path.join(tmpdir(), `project-${Date.now()}.zip`);
            const output = fs.createWriteStream(zipPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            // Finalize the archive once the stream finishes
            output.on('close', async () => {
                const fileSize = archive.pointer();
                console.log(`ZIP file size: ${fileSize} bytes`);

                const zipAttachment = new MessageAttachment(zipPath, 'project.zip');

                const resultEmbed = new MessageEmbed()
                    .setColor('#00FF00')
                    .setTitle(`Generated ${language} Project`)
                    .setDescription(`Here is the generated code for your request: "${request}"`)
                    .addField('Project size', `${(fileSize / 1024).toFixed(2)} KB`);

                await interaction.followUp({ embeds: [resultEmbed], files: [zipAttachment] });

                // Clean up files
                fs.unlinkSync(filePath);
                fs.unlinkSync(zipPath);
                fs.rmdirSync(projectDir);
            });

            archive.pipe(output);
            archive.directory(projectDir, false);
            archive.finalize();

        } catch (error) {
            console.error('Error generating code:', error);
            await interaction.followUp('Sorry, an error occurred while generating the code.');
        }
    }
};
