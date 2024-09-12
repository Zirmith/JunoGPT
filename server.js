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
client.once('ready', () => {
    botData.servers = client.guilds.cache.size;
    console.log(`Logged in as ${client.user.tag}`);
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

// Dashboard route to display bot stats
app.get('/', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>JunoGPT Bot Dashboard</title>
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        </head>
        <body>
            <h1>JunoGPT Bot Stats</h1>
            <p>Servers: ${botData.servers}</p>
            <p>Commands Executed: ${botData.commandsExecuted}</p>
            <canvas id="commandsChart" width="400" height="200"></canvas>

            <script>
                const ctx = document.getElementById('commandsChart').getContext('2d');
                const commandsChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ${JSON.stringify(Object.keys(botData.commandStats))},
                        datasets: [{
                            label: '# of Executions',
                            data: ${JSON.stringify(Object.values(botData.commandStats))},
                            backgroundColor: 'rgba(75, 192, 192, 0.2)',
                            borderColor: 'rgba(75, 192, 192, 1)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        }
                    }
                });
            </script>
        </body>
        </html>
    `);
});

// Start the Express server
app.listen(PORT, () => {
    console.log(`Dashboard running at http://localhost:${PORT}`);
});
