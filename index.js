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

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

app.get('/', (req, res) => res.send('Bot is active and running!'));

// Test command to check if bot responds instantly
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "🚀 Bot active-la irukku! WinGo data fetch aaguthu...");
    fetchAndSendPrediction(msg.chat.id);
});

async function fetchAndSendPrediction(chatId) {
    try {
        const response = await axios.get(SCRAPINGANT_URL, { timeout: 30000 });
        let rawContent = response.data.content || response.data;
        let parsedData = typeof rawContent === 'object' ? rawContent : JSON.parse(rawContent);

        let list = Array.isArray(parsedData) ? parsedData : (parsedData?.data?.list || parsedData?.data || parsedData?.list);
        if (!list || !Array.isArray(list) || list.length === 0) {
            bot.sendMessage(chatId, "⚠️ API-la irunthu data varala. Check ScrapingAnt credits.");
            return;
        }

        let lastItem = list[0];
        let period = lastItem.issueName || lastItem.issueNumber || lastItem.period || "N/A";
        let number = lastItem.number !== undefined ? lastItem.number : lastItem.result;
        let result = number >= 5 ? "BIG" : "SMALL";

        let msg = `🔥 **TEST PREDICTION ENGINE** 🔥\n📌 Period: \`${period}\`\n🎲 Last Number: \`${number}\`\n🎯 Trend Guess: **${result}**`;
        bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
}

app.listen(PORT, '0.0.0.0', () => {
    console.log("Server listening on port " + PORT);
});
