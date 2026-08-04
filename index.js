const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');

// Configuration
const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';
const API_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json';

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

let lastProcessedPeriod = null;

async function fetchWinGoData() {
    try {
        const response = await axios.get(API_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Referer': 'https://ar-lottery01.com/'
            },
            timeout: 5000
        });

        if (response.data && response.data.data && response.data.data.list) {
            const history = response.data.data.list;
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
setInterval(fetchWinGoData, 3000);const fetch = require('node-fetch');

const BOT_TOKEN = "8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU";
const CHAT_ID = "-1002486828817";
const API_URL = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json";

let lastSentPeriod = "";
let lastPredictedResult = null;
let lastPredictedPeriod = null;

let totalWins = 0;
let totalLosses = 0;

async function sendTelegramMessage(text) {
    try {
        let encodedText = encodeURIComponent(text);
        let url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodedText}&parse_mode=Markdown`;
        let res = await fetch(url);
        let data = await res.json();
        return data.ok;
    } catch (e) {
        return false;
    }
}

function calculateTwoNumbers(predResult) {
    return predResult === "BIG" ? "7 , 8" : "2 , 3";
}

function processUltraEngine(history) {
    try {
        let lastItem = history[0];
        let actualNum = parseInt(lastItem.number !== undefined ? lastItem.number : lastItem.result);
        let actualResult = actualNum >= 5 ? "BIG" : "SMALL";
        let actualPeriod = String(lastItem.issueNumber || lastItem.period || lastItem.issue);

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
        let historyNumbers = history.slice(0, 10).map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let bCount = historyNumbers.filter(n => n >= 5).length;
        
        let predResult = bCount <= 5 ? "BIG" : "SMALL";
        let colorStr = predResult === "BIG" ? "🟢 GREEN" : "🔴 RED";
        let numbersStr = calculateTwoNumbers(predResult);

        return { nextPeriod, predResult, colorStr, numbersStr, resultBanner };
    } catch (e) {
        return null;
    }
}

async function processEngine() {
    try {
        let res = await fetch(API_URL);
        let data = await res.json();
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

                let sent = await sendTelegramMessage(msg);
                if (sent) {
                    lastSentPeriod = pred.nextPeriod;
                    lastPredictedPeriod = pred.nextPeriod;
                    lastPredictedResult = pred.predResult;
                    console.log(`Sent prediction for ${pred.nextPeriod}`);
                }
            }
        }
    } catch (err) {
        console.log("API Sync Error...");
    }
}

console.log("WinGo 1M Node.js Server Bot Started...");
setInterval(processEngine, 3000);
