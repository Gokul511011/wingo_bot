const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server for Render
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('WinGo Aligned Table Bot Active!'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Configuration
const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';
const SCRAPER_API_KEY = 'f12c59abca9948a7cc85a14de5a93719';

const TARGET_URL = '[https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json](https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json)';
const API_URL = `[http://api.scraperapi.com](http://api.scraperapi.com)?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(TARGET_URL)}`;

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

let lastSentPeriod = "";
let lastPredictedResult = null;
let lastPredictedPeriod = null;

let totalWins = 0;
let totalLosses = 0;
let maintenanceLevel = 1;

// Martingale Level Amounts
const levelAmounts = {
    1: "₹10",
    2: "₹30",
    3: "₹90",
    4: "₹270",
    5: "₹810",
    6: "₹2430",
    7: "₹7290"
};

let historyLog = []; // Limit: 20 rows

function calculateTwoNumbers(predResult) {
    return predResult === "BIG" ? "7, 8" : "2, 3";
}

function processUltraEngine(history) {
    try {
        let lastItem = history[0];
        let actualNum = parseInt(lastItem.number !== undefined ? lastItem.number : lastItem.result);
        let actualResult = actualNum >= 5 ? "BIG" : "SMALL";
        let actualPeriod = String(lastItem.issueName || lastItem.issueNumber || lastItem.period || lastItem.issue);

        let lastStatus = "";

        if (lastPredictedPeriod && lastPredictedPeriod === actualPeriod) {
            if (lastPredictedResult === actualResult) {
                totalWins++;
                lastStatus = "✅ WIN";
                maintenanceLevel = 1; // Reset Level
            } else {
                totalLosses++;
                lastStatus = "❌ LOSS";
                maintenanceLevel++; // Increase Level
            }

            // Auto-Reset Table after 20 Rows
            if (historyLog.length >= 20) {
                historyLog = [];
            }

            historyLog.unshift({
                sno: String(historyLog.length + 1).padStart(2, '0'),
                period: actualPeriod.slice(-4),
                actual: actualResult,
                num: String(actualNum),
                target: lastPredictedResult,
                status: lastStatus
            });
        }

        let nextPeriod = String(BigInt(actualPeriod) + 1n);

        let historyNumbers = history.slice(0, 10).map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let resultsList = historyNumbers.map(n => n >= 5 ? "BIG" : "SMALL");

        let predResult = "BIG";
        if (resultsList[0] === resultsList[1] && resultsList[1] === resultsList[2]) {
            predResult = resultsList[0]; 
        } else if (resultsList[0] !== resultsList[1] && resultsList[1] !== resultsList[2]) {
            predResult = resultsList[0] === "BIG" ? "SMALL" : "BIG";
        } else {
            let bCount = historyNumbers.filter(n => n >= 5).length;
            predResult = bCount <= 5 ? "BIG" : "SMALL";
        }

        let colorStr = predResult === "BIG" ? "🟢 GREEN" : "🔴 RED";
        let numbersStr = calculateTwoNumbers(predResult);

        return { nextPeriod, predResult, colorStr, numbersStr };
    } catch (e) {
        console.error("Engine Error:", e.message);
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
                
                let currentAmount = levelAmounts[maintenanceLevel] || ("Level " + maintenanceLevel);

                let tableHeader = "👑 **[ WINGO 1M OFFICIAL BOT ]** 👑\n" +
                                 "━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
                                 "📌 **PERIOD:** `" + pred.nextPeriod + "`\n" +
                                 "🎯 **TARGET:** **" + pred.predResult + "**\n" +
                                 "🔢 **NUMBERS:** `" + pred.numbersStr + "`\n" +
                                 "🎨 **COLOUR:** " + pred.colorStr + "\n" +
                                 "💰 **LEVEL AMOUNT:** **Level " + maintenanceLevel + " (" + currentAmount + ")**\n" +
                                 "━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

                let gridMsg = "```text\n" +
                              "📊 WINGO 1M\n" +
                              "─────────────────────────────────────────────\n" +
                              "SNO  PERIOD  ACTUAL  NUM  TARGET  RESULT\n" +
                              "─────────────────────────────────────────────\n";

                if (historyLog.length === 0) {
                    gridMsg += "NEW TABLE OPENED / WAITING FOR RESULTS...\n";
                } else {
                    historyLog.forEach((row, idx) => {
                        let sno = String(idx + 1).padStart(2, '0').padEnd(5, ' ');
                        let prd = String(row.period).padEnd(8, ' ');
                        let act = String(row.actual).padEnd(8, ' ');
                        let num = String(row.num).padEnd(5, ' ');
                        let tgt = String(row.target).padEnd(8, ' ');
                        let st = row.status;
                        gridMsg += sno + prd + act + num + tgt + st + "\n";
                    });
                }

                gridMsg += "─────────────────────────────────────────────\n" +
                           "TOTAL WINS: " + totalWins + "  |  TOTAL LOSS: " + totalLosses + "\n" +
                           "```";

                let finalMessage = tableHeader + gridMsg;

                await bot.sendMessage(CHANNEL_ID, finalMessage, { parse_mode: 'Markdown' });
                
                lastSentPeriod = pred.nextPeriod;
                lastPredictedPeriod = pred.nextPeriod;
                lastPredictedResult = pred.predResult;
                console.log("[SUCCESS] Aligned Table Sent: " + pred.nextPeriod);
            }
        }
    } catch (error) {
        console.error('[SYNC ERROR]:', error.message);
    }
}

console.log("WinGo Aligned Table Bot Active...");
setInterval(fetchWinGoData, 8000);
