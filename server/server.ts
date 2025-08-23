import dotenv from 'dotenv';
import express from 'express';
import { NonThreadGuildBasedChannel, Client, Collection, Guild, DMChannel } from 'discord.js-selfbot-v13';
import { channel } from 'diagnostics_channel';

dotenv.config({path: '.env'});
const app = express();
const port = Number(process.env.PORT ?? 3000);
const token: string = process.env.DISCORD_TOKEN ?? "";
const client = new Client();

let channelCache: Map<string, Collection<string, NonThreadGuildBasedChannel>> = new Map();

// cache ttl in milliseconds
const CACHE_TTL: number = 5 * 60 * 1000;
let lastCacheUpdate: number = 0;
let liveCache: boolean = false;

//#region -- cache functions -- //
async function updateChannelCache() {
    const now = Date.now();

    if (now - lastCacheUpdate < CACHE_TTL && channelCache.size > 0) {
        return;
    }

    try {
        liveCache = false;
        const guilds = client.guilds.cache;

        for( const [guildId, guild] of guilds) {
            await addGuildToCache(guild, guildId);
        }

        lastCacheUpdate = now;
        console.log("Channel cache updated...");
        liveCache = true;
    } catch (error) {
        console.error("Failed to update channel cache...", error);
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
    }

    catch (error) {
        console.error("Unable to fetch channels for guild %d", guildId);
    }
}

//#endregion -- cache functions -- //

//#region -- main events -- //

// guild create event
client.on('guildCreate', async (guild) => {
    console.log("Guild created: %s", guild.name);

    if (liveCache) {
        try {
                await addGuildToCache(guild, guild.id);
            } catch (error) {
                console.error("Unable to add guild to cache: %s", guild.name);
            }
    }
});

// guild delete / ban / leave event
client.on('guildDelete', async (guild) => {
    console.log("Guild deleted: %s", guild.name);

    if (liveCache) {
        try {
            channelCache.delete(guild.id);
        } catch (error) {
            console.error("Unable to remove guild from cache: %s", guild.name);
        }   
    }
});

// channel create event
client.on('channelCreate', async (channel) => {
    console.log("Channel %s created in guild %s", channel.name, channel.guild.name);

    if (liveCache) {
        try {
            channelCache.get(channel.guildId)?.set(channel.id, channel);
        } catch (error) {
            console.error("Unable to add channel to cache: %s", channel.name);
        }
    }
});

// channel delete event
client.on('channelDelete', async (channel) => {

    if (channel instanceof DMChannel) {
        console.log("Channel id %s deleted (DM) between %s", channel.id, channel.recipient.username);
        return;
    }

    console.log("Channel %s deleted in guild %s", channel.name, channel.guild.name);

    if (liveCache) {
        try {
            channelCache.get(channel.guildId)?.delete(channel.id);
        } catch (error) {
            console.error("Unable to remove channel from cache: %s", channel.id);
        }
    }
});

//#endregion -- cache events -- //

client.on('ready', async () => {
    console.log(`${client.user?.username} is ready!`);

    try {
        updateChannelCache();
        console.log("Servers cached...");
    } catch (error) {
        console.error('Failed to hydrate cache on ready...', error);
    }

    app.get('/api/discord/servers', async (req, res) => {
        console.log("Servers requested");

        // livecache validation not needed as cache always hydrated
        res.json(client.guilds.cache.map(server => {
            return {
                id: server.id,
                members: server.memberCount,
                name: server.name,
            }
        }));
    });

    app.get('/api/discord/servers/:guildId', async (req, res) => {
        console.log("Server id %s requested", req.params.guildId);
        
        if(client.guilds.cache.get(req.params.guildId) === undefined) {
            res.status(404).json({ error: 'Server not found' });
            return;
        }

        if (!liveCache) {
            console.log("Live cache not available, hard fetching channels for server %s", client.guilds.cache.get(req.params.guildId)?.name);
            const server = await client.guilds.fetch(req.params.guildId);
            const channels = await server.channels.fetch();

            // i hate javascript why do i have to confirm it isnt null
            res.json(channels
                .filter((channel) => {return channel && channel.viewable;})
                .map(channel => {
                return {
                    id: channel!.id,
                    name: channel!.name,
                }
            }));
        }

        else{
            const server = channelCache.get(req.params.guildId)?.map(channel => {
                return {
                    id: channel.id,
                    name: channel.name,
                }
            });

            res.json(server);
        }
    });
});

client.login(token);

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});