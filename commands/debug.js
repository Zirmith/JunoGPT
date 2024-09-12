const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed, MessageAttachment } = require('discord.js');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');

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
        
        let execCommand;
        const tempDir = path.dirname(filePath);
        let classPath, logFilePath;

        switch (language) {
            case 'java':
                classPath = path.join(tempDir, 'Main.class');
                logFilePath = path.join(tempDir, 'compile.log');
                execCommand = `javac ${filePath} 2> ${logFilePath}`;
                break;
            case 'javascript':
                execCommand = `node ${filePath}`;
                break;
            case 'python':
                execCommand = `python ${filePath}`;
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

        // Compile or run the code
        exec(execCommand, (error, stdout, stderr) => {
            if (language === 'java') {
                if (error) {
                    // Read the log file
                    const compileLog = fs.readFileSync(logFilePath, 'utf8');

                    const embed = new MessageEmbed()
                        .setColor('#FFFF00') // Yellow color
                        .setTitle('Java Code Debugging')
                        .setDescription('There was an error compiling your Java code.')
                        .addField('Error', `\`\`\`\n${compileLog}\n\`\`\``)
                        .setFooter('Make sure your code is valid Java code.')
                        .setTimestamp();

                    return interaction.followUp({ embeds: [embed] });
                }

                if (!fs.existsSync(classPath)) {
                    const embed = new MessageEmbed()
                        .setColor('#FFFF00') // Yellow color
                        .setTitle('Java Code Debugging')
                        .setDescription('Compilation was successful, but no class file was generated.')
                        .setFooter('Check your code for errors.')
                        .setTimestamp();

                    return interaction.followUp({ embeds: [embed] });
                }

                // Execute the compiled Java code
                exec(`java -cp ${tempDir} Main`, (execError, execStdout, execStderr) => {
                    const resultEmbed = new MessageEmbed()
                        .setColor('#FFFF00') // Yellow color
                        .setTitle('Java Code Debugging')
                        .setDescription('Your Java code execution result:')
                        .addField('Output', `\`\`\`\n${execStdout}\n\`\`\``)
                        .addField('Errors', `\`\`\`\n${execStderr || execError?.message || 'No errors'}\n\`\`\``)
                        .setFooter('Here is your result and logs.')
                        .setTimestamp();

                    const classFileAttachment = new MessageAttachment(classPath, 'Main.class');

                    interaction.followUp({ embeds: [resultEmbed], files: [classFileAttachment] });
                });
            } else if (language === 'javascript' || language === 'python') {
                const resultEmbed = new MessageEmbed()
                    .setColor('#FFFF00') // Yellow color
                    .setTitle(`${language.charAt(0).toUpperCase() + language.slice(1)} Code Debugging`)
                    .setDescription(`Your ${language} code execution result:`)
                    .addField('Output', `\`\`\`\n${stdout}\n\`\`\``)
                    .addField('Errors', `\`\`\`\n${stderr || error?.message || 'No errors'}\n\`\`\``)
                    .setFooter('Here is your result and logs.')
                    .setTimestamp();

                interaction.followUp({ embeds: [resultEmbed] });
            }

            // Clean up temporary files
            fs.unlinkSync(filePath);
            if (language === 'java') {
                fs.unlinkSync(logFilePath);
                if (fs.existsSync(classPath)) fs.unlinkSync(classPath);
            }
        });
    }
};
