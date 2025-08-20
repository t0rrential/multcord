import dotenv from 'dotenv';
import express from 'express';
import { Client, Collection, Guild, OAuth2Guild } from 'discord.js-selfbot-v13';

dotenv.config({path: '../.env'});
const app = express();
let token: string = process.env.DISCORD_TOKEN; // prod use only
const port = 3000;
const client = new Client();

let servers: Collection<string, OAuth2Guild> = new Collection();

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

            return {
                id: fullServer.id,
                members: fullServer.memberCount,
                name: fullServer.name,
            }
        }));
    });

    app.get('/api/discord/servers/:channelId', async (req, res) => {
        const server = await servers.filter(server => server.id === req.params.channelId);
        const fullServer = await server[0].fetch(); // fetch server, i hate filter

        res.json(fullServer.channels.map(channel => {
            return {
                id: channel.id,
                name: channel.name,
            }
        }));
    });
})

client.login(token);