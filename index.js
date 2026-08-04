const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server to satisfy Render Service
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('WinGo Ultra Prediction Engine is Active!'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Configuration
const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';
const SCRAPER_API_KEY = 'f12c59abca9948a7cc85a14de5a93719';

const TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json';
const API_URL = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(TARGET_URL)}`;

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

let lastSentPeriod = "";
let lastPredictedResult = null;
let lastPredictedPeriod = null;

let totalWins = 0;
let totalLosses = 0;

function calculateTwoNumbers(predResult) {
    if (predResult === "BIG") {
        return "7 , 8";
    } else {
        return "2 , 3";
    }
}

// Low-Loss Smart Pattern Algorithm
function processUltraEngine(history) {
    try {
        let lastItem = history[0];
        let actualNum = parseInt(lastItem.number !== undefined ? lastItem.number : lastItem.result);
        let actualResult = actualNum >= 5 ? "BIG" : "SMALL";
        let actualPeriod = String(lastItem.issueName || lastItem.issueNumber || lastItem.period || lastItem.issue);

        let resultBanner = "";
        if (lastPredictedPeriod && lastPredictedPeriod === actualPeriod) {
            if (lastPredictedResult === actualResult) {
                totalWins++;
                resultBanner = `🌸💐🎉 **WINNER!** 🎉💐🌸\n\n`;
            } else {
                totalLosses++;
                resultBanner = `💪🔥 **CHEAR UP! NEXT TRY!** 🔥💪\n\n`;
            }
        }

        let nextPeriod = String(BigInt(actualPeriod) + 1n);

        // Fetch last 10 historical entries
        let historyNumbers = history.slice(0, 10).map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let resultsList = historyNumbers.map(n => n >= 5 ? "BIG" : "SMALL");

        let predResult = "BIG";

        // Strategy 1: Dragon Trend Following (3 consecutive matches)
        if (resultsList[0] === resultsList[1] && resultsList[1] === resultsList[2]) {
            predResult = resultsList[0]; 
        } 
        // Strategy 2: Alternate Pattern Catching (AB AB Pattern)
        else if (resultsList[0] !== resultsList[1] && resultsList[1] !== resultsList[2]) {
            predResult = resultsList[0] === "BIG" ? "SMALL" : "BIG";
        } 
        // Strategy 3: Standard Majority Balancing
        else {
            let bCount = historyNumbers.filter(n => n >= 5).length;
            predResult = bCount <= 5 ? "BIG" : "SMALL";
        }

        let colorStr = predResult === "BIG" ? "🟢 GREEN" : "🔴 RED";
        let numbersStr = calculateTwoNumbers(predResult);

        return { nextPeriod, predResult, colorStr, numbersStr, resultBanner };
    } catch (e) {
        console.error("Pattern Engine Error:", e.message);
        return null;
    }
}

async function fetchWinGoData() {
    try {
        const response = await axios.get(API_URL, { timeout: 25000 });
        let data = response.data;

        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) {}
        }

        let list = data?.data?.list || data?.list || data;

        if (Array.isArray(list) && list.length > 0) {
            let pred = processUltraEngine(list);

            if (pred && pred.nextPeriod !== lastSentPeriod) {
                let msg = `${pred.resultBanner}` +
                          `📌 **PERIOD NUMBER**: \`${pred.nextPeriod}\`\n\n` +
                          `🎯 **TARGET**: **${pred.predResult}**\n` +
                          `🔢 **NUMBER**: \`${pred.numbersStr}\`\n` +
                          `🎨 **COLOUR**: ${pred.colorStr}\n\n` +
                          `🏆 **WIN**: ${totalWins}\n` +
                          `💔 **LOSS**: ${totalLosses}`;

                await bot.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' });
                lastSentPeriod = pred.nextPeriod;
                lastPredictedPeriod = pred.nextPeriod;
                lastPredictedResult = pred.predResult;
                console.log(`[SUCCESS] Sent Prediction for Period: ${pred.nextPeriod}`);
            }
        }
    } catch (error) {
        console.error('[SYNC ERROR]:', error.message);
    }
}

console.log("WinGo Ultra Bot Started on Cloud...");
// Checks API every 8 seconds
setInterval(fetchWinGoData, 8000);
