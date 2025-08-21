import dotenv from 'dotenv';
import express from 'express';
import { Client, Collection, OAuth2Guild } from 'discord.js-selfbot-v13';

dotenv.config({path: '.env'});
const app = express();
const port = Number(process.env.PORT ?? 3000);
const token: string = process.env.DISCORD_TOKEN ?? "";
const client = new Client();

let servers: Collection<string, OAuth2Guild> = new Collection(); // shallow guilds ; need to fetch to get full guild

async function updateServers() {
    servers = await client.guilds.fetch();
}

client.on('guildCreate', async (guild) => {
    updateServers();
});

client.on('ready', async () => {
    console.log(`${client.user?.username} is ready!`);

    app.get('/api/discord/servers', async (req, res) => {
        res.json(servers.map(async server => {
            const fullServer = await server.fetch();
            console.log("/discord/servers hit");

            return {
                id: fullServer.id,
                members: fullServer.memberCount,
                name: fullServer.name,
            }
        }));

        console.log(servers);
    });

    app.get('/api/discord/servers/:channelId', async (req, res) => {
        const server = await servers.filter(server => server.id === req.params.channelId);
        const fullServer = await server[0].fetch(); // fetch server, i hate filter

        // add catch for no server found later

        res.json(fullServer.channels.map(channel => {
            return {
                id: channel.id,
                name: channel.name,
            }
        }));
    });

    // error handler
    app.use((err: unknown, _req, res, _next) => {
        console.error('Unhandled error in request:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    });
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

client.login(token);