import dotenv from 'dotenv';
import express from 'express';
import { Client } from 'discord.js-selfbot-v13';

dotenv.config({path: '../.env'});
const app = express();
let token: string = process.env.DISCORD_TOKEN; // prod use only
const port = 3000;
const client = new Client();

client.on('ready', async () => {
    console.log(`${client.user?.username} is ready!`);
})

console.log(process.env.DISCORD_TOKEN);
client.login(token);