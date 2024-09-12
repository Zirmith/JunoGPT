const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed, MessageAttachment } = require('discord.js');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
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
                .setRequired(true)
        ),
    async execute(interaction) {
        const language = interaction.options.getString('language');
        const code = interaction.options.getString('code');
        const tempDir = path.join(tmpdir(), `debug-${Date.now()}`);
        fs.mkdirSync(tempDir, { recursive: true });
        let filePath, classPath, logFilePath, execCommand;

        // Set file paths and commands based on the language
        switch (language) {
            case 'java':
                filePath = path.join(tempDir, 'Main.java');
                classPath = path.join(tempDir, 'Main.class');
                logFilePath = path.join(tempDir, 'compile.log');
                execCommand = `javac ${filePath} 2> ${logFilePath}`;
                break;
            case 'javascript':
                filePath = path.join(tempDir, 'script.js');
                execCommand = `node ${filePath}`;
                break;
            case 'python':
                filePath = path.join(tempDir, 'script.py');
                execCommand = `python ${filePath}`;
                break;
            default:
                return interaction.reply('Unsupported language.');
        }

        // Save the code to a file
        fs.writeFileSync(filePath, code);

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
            fs.rmdirSync(tempDir, { recursive: true });
        });
    }
};
