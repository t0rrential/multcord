import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { NonThreadGuildBasedChannel, Client, Collection, Guild, DMChannel } from 'discord.js-selfbot-v13';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

dotenv.config({path: '.env'});

const app: any = express();

// Enable CORS for all routes
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'],
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());
const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer });
const port = Number(process.env.PORT ?? 3000);
const client = new Client();

let channelCache: Map<string, Collection<string, NonThreadGuildBasedChannel>> = new Map();

let liveCache: boolean = false;

//#region -- cache functions -- //

async function ensureGuildChannelsCached(guildId: string) {
    // Check if this specific guild's channels are cached
    if (channelCache.has(guildId)) {
        return;
    }

    try {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
            await addGuildToCache(guild, guildId);
            console.log(`Channels cached for guild: ${guild.name}`);
        }
    } catch (error) {
        console.error(`Failed to cache channels for guild ${guildId}:`, error);
    }
}

async function addGuildToCache(guild: Guild, guildId: string) {
    try {
        // get channels from the shallow guild
        const channels = await guild.channels.fetch();
        const validChannels = new Collection<string, NonThreadGuildBasedChannel>();

        // add channels to cache
        channels.forEach((channel, id) => {
            if (channel) {
                validChannels.set(id, channel);
            }
        });

        channelCache.set(guildId, validChannels);
    } catch (error) {
        console.error("Unable to fetch channels for guild %d", guildId);
    }
}

//#endregion -- cache functions -- //

//#region -- main events -- //

// guild create event
client.on('guildCreate', async (guild) => {
    console.log("Guild created: %s", guild.name);
    // Don't auto-cache new guilds - wait for request
});

// guild delete / ban / leave event
client.on('guildDelete', async (guild) => {
    console.log("Guild deleted: %s", guild.name);
    // Remove from cache if it exists
    channelCache.delete(guild.id);
});

// channel create event
client.on('channelCreate', async (channel) => {
    console.log("Channel %s created in guild %s", channel.name, channel.guild.name);
    // Add to cache if guild is already cached
    if (channelCache.has(channel.guildId)) {
        channelCache.get(channel.guildId)?.set(channel.id, channel);
    }
});

// channel delete event
client.on('channelDelete', async (channel) => {

    if (channel instanceof DMChannel) {
        console.log("Channel id %s deleted (DM) between %s", channel.id, channel.recipient.username);
        return;
    }

    console.log("Channel %s deleted in guild %s", channel.name, channel.guild.name);
    // Remove from cache if guild is cached
    if (channelCache.has(channel.guildId)) {
        channelCache.get(channel.guildId)?.delete(channel.id);
    }
});

//#endregion -- cache events -- //

//#region -- websocket events -- //

let channels = new Set();
let connectedClient: WebSocket | null = null;

wss.on('connection', (ws) => {
    console.log("Client connected to websocket.");
    connectedClient = ws;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            if (data.type === 'subscribe') {
                console.log("Client subscribed to channel %s", data.channelId);
                channels.add(data.channelId);
            }

            if (data.type === 'unsubscribe') {
                console.log("Client unsubscribed from channel %s", data.channelId);
                channels.delete(data.channelId);
            }
        } catch (error) {
            console.error("Error parsing message: %s", error);
        }
    });

    ws.on('close', () => {
        console.log("Client disconnected from websocket.");
        connectedClient = null;
    });
});

client.on('messageCreate', (message) => {
    const channelId = message.channel.id;

    if (channels.has(channelId) && connectedClient && connectedClient.readyState === WebSocket.OPEN) {
        connectedClient.send(JSON.stringify({
            type: 'newMessage',
            payload: {
                channelId,
                author: message.author.id,
                authorIcon: message.author.displayAvatarURL(),
                content: message.content ?? '',
                timestamp: message.createdTimestamp,
            }
        }));
    }
});

//#endregion -- websocket events -- //

// main routes
client.on('ready', async () => {
    console.log(`${client.user?.username} is ready!`);
    console.log("Server ready - using lazy loading for channels");

    app.get('/api/discord/servers', async (req, res) => {
        console.log("Servers requested");

        // livecache validation not needed as cache always hydrated
        res.json(client.guilds.cache.map(server => {
            return {
                id: server.id,
                members: server.memberCount,
                name: server.name,
                icon: server.icon,
            }
        }));
    });

    app.get('/api/discord/servers/:guildId', async (req, res) => {
        console.log("Server id %s requested", req.params.guildId);
        
        if(client.guilds.cache.get(req.params.guildId) === undefined) {
            console.log("Server not found in cache");
            res.status(404).json({ error: 'Server not found' });
            return;
        }

        // Lazy load channels for this specific guild
        await ensureGuildChannelsCached(req.params.guildId);

        const cachedChannels = channelCache.get(req.params.guildId);
        console.log(`Cached channels for ${req.params.guildId}:`, cachedChannels?.size || 0);
        
        if (cachedChannels) {
            const channels = cachedChannels.map(channel => {
                return {
                    id: channel.id,
                    name: channel.name,
                }
            });
            console.log(`Returning ${channels.length} channels`);
            res.json(channels);
        } else {
            // Fallback to hard fetch if caching failed
            console.log("Cache miss, hard fetching channels for server %s", client.guilds.cache.get(req.params.guildId)?.name);
            const server = await client.guilds.fetch(req.params.guildId);
            const channels = await server.channels.fetch();

            const filteredChannels = channels
                .filter((channel) => {return channel && channel.viewable;})
                .map(channel => {
                return {
                    id: channel!.id,
                    name: channel!.name,
                }
            });
            console.log(`Hard fetch returned ${filteredChannels.length} channels`);
            res.json(filteredChannels);
        }
    });
});

client.login(process.env.DISCORD_TOKEN);

// Start the HTTP server (which includes the WebSocket server)
httpServer.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

// Proper cleanup on shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    httpServer.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\nShutting down server...');
    httpServer.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});