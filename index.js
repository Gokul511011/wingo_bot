const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 10000;

const BOT_TOKEN = '7556271803:AAG9aZhy0sxjZN3WhFxZ_LU0KC8erzRYwAA';
const SCRAPINGANT_API_KEY = 'e69725dd04034c0abdfd7356d2a830f7';
const TARGET_CHAT_ID = '7556271803';

const RAW_TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_30S.json?ts=1786719679185';
const SCRAPINGANT_URL = 
    `https://api.scrapingant.com/v2/general?x-api-key=${SCRAPINGANT_API_KEY}` +
    `&url=${encodeURIComponent(RAW_TARGET_URL)}` +
    `&proxy_country=in&browser=false`;

// Using interval polling safely with error catching
const bot = new TelegramBot(BOT_TOKEN, { 
    polling: {
        interval: 2000,
        autoStart: true,
        params: {
            timeout: 10
        }
    } 
});

// Ignore polling conflict errors safely
bot.on('polling_error', (error) => {
    if (error.code !== 'ETELEGRAM' || !error.message.includes('409 Conflict')) {
        console.log(`Polling error: ${error.message}`);
    }
});

app.get('/', (req, res) => res.send('WinGo Bot Engine is Live!'));

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "👋 Vanakkam! WinGo Bot active-la irukku. Predictions varum!");
});

async function fetchAndSendPrediction() {
    try {
        const response = await axios.get(SCRAPINGANT_URL, { timeout: 30000 });
        let rawContent = response.data.content || response.data;
        let parsedData = typeof rawContent === 'object' ? rawContent : JSON.parse(rawContent);

        let list = Array.isArray(parsedData) ? parsedData : (parsedData?.data?.list || parsedData?.data || parsedData?.list);
        if (!list || !Array.isArray(list) || list.length === 0) return;

        let lastItem = list[0];
        let period = lastItem.issueName || lastItem.issueNumber || lastItem.period || "N/A";
        let number = lastItem.number !== undefined ? lastItem.number : lastItem.result;
        let result = number >= 5 ? "BIG" : "SMALL";

        let msg = `🔥 **WINGO LIVE ENGINE** 🔥\n📌 Period: \`${period}\`\n🎲 Number: \`${number}\`\n🎯 Prediction: **${result}**`;
        await bot.sendMessage(TARGET_CHAT_ID, msg, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error("Fetch Error:", e.message);
    }
}

async function startLoop() {
    while (true) {
        await fetchAndSendPrediction();
        await new Promise(r => setTimeout(r, 30000)); // Every 30 seconds
    }
}

app.listen(PORT, '0.0.0.0', () => {
    console.log("Bot Server listening on port " + PORT);
    startLoop();
});
