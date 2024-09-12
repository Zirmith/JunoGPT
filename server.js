const { Client, Intents, Collection } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const express = require('express');
const fs = require('fs');
require('dotenv').config();

// Initialize the Discord bot client
const client = new Client({
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]
});

// Create a collection to hold commands
client.commands = new Collection();

// Load all command files from the 'commands' folder
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

// Register commands with Discord API
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
            body: client.commands.map(command => command.data.toJSON()),
        });

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

// Stats storage to track server and command execution stats
let botData = {
    servers: 0,
    commandsExecuted: 0,
    commandStats: {}
};

// Discord bot events
// Discord bot events
client.once('ready', () => {
    botData.servers = client.guilds.cache.size;
    console.log(`Logged in as ${client.user.tag}`);
    
    // Set the bot status to idle and cycling activity/status
    const activities = [
        'Helping with coding questions',
        'Tracking command usage stats',
        'Monitoring server performance',
        'Providing real-time programming assistance',
    ];

    let i = 0;

    // Function to cycle through activities
    const cycleActivities = () => {
        client.user.setPresence({
            status: 'idle',
            activities: [{ name: activities[i], type: 'PLAYING' }],
        });
        i = (i + 1) % activities.length;
    };

    // Initial activity
    cycleActivities();
    
    // Cycle activities every 10 seconds
    setInterval(cycleActivities, 10000);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction);

        // Track command usage
        botData.commandsExecuted++;
        botData.commandStats[interaction.commandName] = (botData.commandStats[interaction.commandName] || 0) + 1;
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error executing that command!', ephemeral: true });
    }
});

// Log in to Discord with your bot token
client.login(process.env.TOKEN);

// Initialize the Express app
const app = express();
const PORT = 3000;

// Serve static files for charts or other frontend assets (optional)
app.use(express.static('public'));

// Dashboard route to display bot invite page
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta name="description" content="JunoGPT Bot - Your advanced coding assistant. View bot details and invite it to your server.">
            <meta property="og:title" content="JunoGPT Bot Invite Page">
            <meta property="og:description" content="Explore JunoGPT Bot's features and invite it to your Discord server. Get real-time updates and stats about the bot's usage.">
            <meta property="og:image" content="https://cdn.discordapp.com/banners/1283784636287156284/a_363525613836d9c62b50f1861667a48d.gif?size=4096">
            <meta property="og:url" content="/">
            <title>JunoGPT Bot Invite</title>
            <link rel="stylesheet" href="styles.css">
        </head>
        <body>
            <div class="container">
                <div class="card">
                    <div class="banner">
                        <img src="https://cdn.discordapp.com/banners/1283784636287156284/a_363525613836d9c62b50f1861667a48d.gif?size=4096" alt="JunoGPT Bot Banner" class="banner-image">
                    </div>
                    <div class="bot-info">
                        <img src="https://cdn.discordapp.com/avatars/1283784636287156284/a_ad38c8225d6996edf714eaee5becf747.gif?size=4096" alt="JunoGPT Bot Avatar" class="bot-avatar">
                        <h1>JunoGPT</h1>
                        <p><strong>Servers:</strong> ${botData.servers}</p>
                        <p><strong>Commands Executed:</strong> ${botData.commandsExecuted}</p>
                        <a href="https://discord.com/oauth2/authorize?client_id=1283784636287156284&permissions=8&integration_type=0&scope=bot" class="invite-button" target="_blank">Invite JunoGPT to Your Server</a>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Route for Linked Roles Verification URL
app.get('/verification', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>Linked Roles Verification</title>
        </head>
        <body>
            <h1>Linked Roles Verification</h1>
            <p>This is the Linked Roles Verification URL for your application.</p>
        </body>
        </html>
    `);
});

// Route for Terms of Service URL
app.get('/terms', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>Terms of Service</title>
        </head>
        <body>
            <h1>Terms of Service</h1>
            <p>This is the Terms of Service for your application.</p>
        </body>
        </html>
    `);
});

// Route for Privacy Policy URL
app.get('/privacy', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>Privacy Policy</title>
        </head>
        <body>
            <h1>Privacy Policy</h1>
            <p>This is the Privacy Policy for your application.</p>
        </body>
        </html>
    `);
});

// Start the Express server
app.listen(PORT, () => {
    console.log(`Dashboard running at http://localhost:${PORT}`);
});
