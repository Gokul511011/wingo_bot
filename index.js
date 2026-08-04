const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Dummy HTTP Server to satisfy Render Web Service Port Binding
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('WinGo Prediction Bot is Active!'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Telegram & ScraperAPI Configuration
const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';
const SCRAPER_API_KEY = 'f12c59abca9948a7cc85a14de5a93719';

const TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json';
// ScraperAPI proxy endpoint to bypass Cloudflare 403 blocks
const API_URL = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(TARGET_URL)}`;

const bot = new TelegramBot(BOT_TOKEN, { polling: false });
let lastProcessedPeriod = null;

async function fetchWinGoData() {
    try {
        const response = await axios.get(API_URL, { timeout: 25000 });
        let data = response.data;
        
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) {}
        }

        if (data && data.data && data.data.list) {
            const history = data.data.list;
            if (history.length === 0) return;

            const latest = history[0];
            const currentPeriod = latest.issueName || latest.period;

            if (currentPeriod !== lastProcessedPeriod) {
                lastProcessedPeriod = currentPeriod;
                
                const number = parseInt(latest.number);
                const size = number >= 5 ? 'BIG 🟩' : 'SMALL 🟥';
                const color = (number === 0 || number === 5) ? 'VIOLET 🟪' : (number % 2 === 0 ? 'RED 🟥' : 'GREEN 🟩');

                const message = `🎲 **KING PREDICTION - WIN GO 1M** 🎲\n\n` +
                                `📌 **Period:** \`${currentPeriod}\` \n` +
                                `🎯 **Result Number:** \`${number}\` \n` +
                                `📊 **Result:** \`${size}\` \n` +
                                `🎨 **Color:** \`${color}\` \n\n` +
                                `🔥 Keep Trading & Win Big! 🔥`;

                await bot.sendMessage(CHANNEL_ID, message, { parse_mode: 'Markdown' });
                console.log(`[SUCCESS] Sent prediction for Period: ${currentPeriod}`);
            }
        }
    } catch (error) {
        console.error('[SYNC ERROR]:', error.message);
    }
}

console.log("WinGo Bot Started with ScraperAPI Bypass...");
// ScraperAPI call frequency set to 10 seconds to respect free limit & update period
setInterval(fetchWinGoData, 10000);const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Dummy HTTP Server to satisfy Render Web Service Port Binding
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('WinGo Prediction Bot is Running 24/7!'));
app.listen(PORT, () => console.log(`Web Server running on port ${PORT}`));

// Configuration
const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';
const bot = new TelegramBot(BOT_TOKEN, { polling: false });

let lastProcessedPeriod = null;

// Multi-Proxy Mirror List to bypass 403 Block
const TARGET_API = 'https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json';
const PROXY_LIST = [
    `https://corsproxy.io/?${encodeURIComponent(TARGET_API)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(TARGET_API)}`
];

let proxyIndex = 0;

async function fetchWinGoData() {
    const currentProxy = PROXY_LIST[proxyIndex];
    try {
        const response = await axios.get(currentProxy, { timeout: 8000 });
        let data = response.data;
        
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) {}
        }

        if (data && data.data && data.data.list) {
            const history = data.data.list;
            if (history.length === 0) return;

            const latest = history[0];
            const currentPeriod = latest.issueName || latest.period;

            if (currentPeriod !== lastProcessedPeriod) {
                lastProcessedPeriod = currentPeriod;
                
                const number = parseInt(latest.number);
                const size = number >= 5 ? 'BIG 🟩' : 'SMALL 🟥';
                const color = (number === 0 || number === 5) ? 'VIOLET 🟪' : (number % 2 === 0 ? 'RED 🟥' : 'GREEN 🟩');

                const message = `🎲 **KING PREDICTION - WIN GO 1M** 🎲\n\n` +
                                `📌 **Period:** \`${currentPeriod}\` \n` +
                                `🎯 **Result Number:** \`${number}\` \n` +
                                `📊 **Result:** \`${size}\` \n` +
                                `🎨 **Color:** \`${color}\` \n\n` +
                                `🔥 Keep Trading & Win Big! 🔥`;

                await bot.sendMessage(CHANNEL_ID, message, { parse_mode: 'Markdown' });
                console.log(`[SUCCESS] Sent prediction for Period: ${currentPeriod}`);
            }
        }
    } catch (error) {
        console.error(`[SYNC ERROR] Proxy ${proxyIndex + 1} Failed:`, error.message);
        // Rotate to next proxy if 403 or network fail
        proxyIndex = (proxyIndex + 1) % PROXY_LIST.length;
    }
}

console.log("WinGo 1M Node.js Server Bot Started...");
setInterval(fetchWinGoData, 5000);
