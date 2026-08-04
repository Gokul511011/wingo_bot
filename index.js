const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server to keep Render active
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('WinGo Maintenance & History Bot Active!'));
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
let maintenanceLevel = 1; // Money Management Level (Martingale)
let historyLog = []; // Stores last 6 prediction histories

function calculateTwoNumbers(predResult) {
    return predResult === "BIG" ? "7 , 8" : "2 , 3";
}

function processUltraEngine(history) {
    try {
        let lastItem = history[0];
        let actualNum = parseInt(lastItem.number !== undefined ? lastItem.number : lastItem.result);
        let actualResult = actualNum >= 5 ? "BIG" : "SMALL";
        let actualPeriod = String(lastItem.issueName || lastItem.issueNumber || lastItem.period || lastItem.issue);

        let actualColor = (actualNum === 0 || actualNum === 5) ? "🟪 VIOLET" : (actualNum % 2 === 0 ? "🟥 RED" : "🟩 GREEN");

        let resultBanner = "";
        let lastStatus = "";

        // Evaluate previous prediction result
        if (lastPredictedPeriod && lastPredictedPeriod === actualPeriod) {
            if (lastPredictedResult === actualResult) {
                totalWins++;
                resultBanner = `🎉 **RESULT: WINNER!** 🎉\n`;
                lastStatus = "✅ WIN";
                maintenanceLevel = 1; // Reset to Level 1 on WIN
            } else {
                totalLosses++;
                resultBanner = `💔 **RESULT: CHEER UP! NEXT TRY!** 💔\n`;
                lastStatus = "❌ LOSS";
                maintenanceLevel++; // Increase Level on LOSS for recovery
            }

            // Save to 6-row History Table Data
            historyLog.unshift({
                sno: historyLog.length + 1,
                period: actualPeriod.slice(-4), // Last 4 digits for clean display
                actual: actualResult,
                num: actualNum,
                color: actualColor.split(" ")[0], // Only Emoji/Name
                target: lastPredictedResult,
                status: lastStatus
            });

            // Keep only latest 6 rows
            if (historyLog.length > 6) historyLog.pop();
        }

        let nextPeriod = String(BigInt(actualPeriod) + 1n);

        // Trend Following Algorithm
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

        return { nextPeriod, predResult, colorStr, numbersStr, resultBanner };
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
                
                // Build 6-Row History Table Section
                let historyTableText = `📊 **RECENT 6 HISTORY LOG**\n\`\`\`\n`;
                historyTableText += `S.No | Period | Actual | Num | Target | Status\n`;
                historyTableText += `-------------------------------------------\n`;

                if (historyLog.length === 0) {
                    historyTableText += `Waiting for completed rounds...\n`;
                } else {
                    historyLog.forEach((row, idx) => {
                        let sno = String(idx + 1).padEnd(4, ' ');
                        let prd = String(row.period).padEnd(6, ' ');
                        let act = String(row.actual).padEnd(6, ' ');
                        let num = String(row.num).padEnd(3, ' ');
                        let tgt = String(row.target).padEnd(6, ' ');
                        let st = row.status;
                        historyTableText += `${sno} | ${prd} | ${act} | ${num} | ${tgt} | ${st}\n`;
                    });
                }
                historyTableText += `\`\`\`\n`;

                // Main Message Template (Bold & High Visibility)
                let msg = `⚡ **WINGO 1M ULTRA PREDICTION** ⚡\n\n` +
                          `${pred.resultBanner}\n` +
                          `📌 **PERIOD:** \`${pred.nextPeriod}\`\n` +
                          `🎯 **PREDICTION:** **${pred.predResult}**\n` +
                          `🔢 **NUMBERS:** **${pred.numbersStr}**\n` +
                          `🎨 **COLOUR:** ${pred.colorStr}\n` +
                          `⚠️ **MAINTENANCE LEVEL:** **Level ${maintenanceLevel}**\n\n` +
                          `📈 **TOTAL WINS:** **${totalWins}**  |  💔 **TOTAL LOSS:** **${totalLosses}**\n\n` +
                          `${historyTableText}`;

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

console.log("WinGo Ultra Maintenance Bot Active...");
setInterval(fetchWinGoData, 8000);
