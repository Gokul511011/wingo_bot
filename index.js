const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');

// Configuration
const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';

// Using Proxy Endpoint to Bypass Cloudflare IP Blocks
const TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json';
const API_URL = `https://api.allorigins.win/raw?url=${encodeURIComponent(TARGET_URL)}`;

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

let lastProcessedPeriod = null;

async function fetchWinGoData() {
    try {
        const response = await axios.get(API_URL, {
            timeout: 10000
        });

        let data = response.data;
        if (typeof data === 'string') {
            data = JSON.parse(data);
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
                console.log(`Successfully sent prediction for Period: ${currentPeriod}`);
            }
        }
    } catch (error) {
        console.error('API Sync Error:', error.message);
    }
}

console.log("WinGo 1M Node.js Server Bot Started...");
setInterval(fetchWinGoData, 5000);
