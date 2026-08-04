const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server for Render
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send('WinGo 7-Sequence Pattern Engine is Online!');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

// Configuration
const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';
const SCRAPER_API_KEY = '792cc6afea63006ca27f3481bf1c1ef0';

const TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json';
const REGISTER_LINK = 'https://www.rajastake7.com/#/register?invitationCode=172723872480';

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

let lastSentPeriod = "";
let lastPredictedResult = null;
let lastPredictedNumbers = [];
let lastPredictedPeriod = null;

let totalWins = 0;
let totalLosses = 0;
let maintenanceLevel = 1;

const levelAmounts = {
    1: "₹10",
    2: "₹30",
    3: "₹90",
    4: "₹270",
    5: "₹810",
    6: "₹2430",
    7: "₹7290"
};

// 🎯 Strict 7-Sequence Pattern Engine based on 500 Historical Results
function patternEngine7(history) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "B" : "S");

        // Take last 7 trend (e.g., BSBSBBS)
        let pattern7 = allResults.slice(0, 7).join("");
        let pattern6 = allResults.slice(0, 6).join("");

        let matchB = 0;
        let matchS = 0;
        let matchedNumbers = [];

        // Primary Match: 7-Sequence Historical Scan
        for (let i = 1; i < allResults.length - 7; i++) {
            let pastPattern = allResults.slice(i, i + 7).join("");
            if (pattern7 === pastPattern) {
                let nextResult = allResults[i - 1];
                let nextNum = allNumbers[i - 1];

                if (nextResult === "B") matchB++;
                if (nextResult === "S") matchS++;
                matchedNumbers.push(nextNum);
            }
        }

        // Secondary Match: Fallback to 6-Sequence if 7-Sequence match count is 0
        if (matchB === 0 && matchS === 0) {
            for (let i = 1; i < allResults.length - 6; i++) {
                let pastPattern = allResults.slice(i, i + 6).join("");
                if (pattern6 === pastPattern) {
                    let nextResult = allResults[i - 1];
                    let nextNum = allNumbers[i - 1];

                    if (nextResult === "B") matchB++;
                    if (nextResult === "S") matchS++;
                    matchedNumbers.push(nextNum);
                }
            }
        }

        let predResult = "BIG";

        if (matchS > matchB) {
            predResult = "SMALL";
        } else if (matchB > matchS) {
            predResult = "BIG";
        } else {
            // Fallback to recent continuation trend if no pattern matches
            predResult = allResults[0] === "B" ? "BIG" : "SMALL";
        }

        let candidateNums = predResult === "BIG" ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
        let freqMap = {};

        matchedNumbers.filter(n => candidateNums.includes(n)).forEach(n => {
            freqMap[n] = (freqMap[n] || 0) + 1;
        });

        // If no past pattern numbers matched, take hot numbers from last 15 draws
        if (Object.keys(freqMap).length === 0) {
            allNumbers.slice(0, 15).filter(n => candidateNums.includes(n)).forEach(n => {
                freqMap[n] = (freqMap[n] || 0) + 1;
            });
        }

        candidateNums.sort((a, b) => (freqMap[b] || 0) - (freqMap[a] || 0));
        let targetNumbers = [candidateNums[0], candidateNums[1]];

        let numbersStr = targetNumbers.join(", ");
        let colorStr = predResult === "BIG" ? "🟢 GREEN" : "🔴 RED";

        return { predResult, targetNumbers, numbersStr, colorStr };
    } catch (e) {
        console.error("7-Pattern Engine Error:", e.message);
        return { predResult: "BIG", targetNumbers: [7, 8], numbersStr: "7, 8", colorStr: "🟢 GREEN" };
    }
}

async function fetchWinGoData() {
    try {
        const target50Url = `${TARGET_URL}?pageSize=500&pageNo=1`;
        const scraperUrl = "http://api.scraperapi.com?api_key=" + SCRAPER_API_KEY + "&url=" + encodeURIComponent(target50Url);
        
        const response = await axios.get(scraperUrl, { 
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        let data = response.data;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) {}
        }

        let list = data?.data?.list || data?.list || data;

        if (Array.isArray(list) && list.length > 0) {
            let lastItem = list[0];
            let actualNum = parseInt(lastItem.number !== undefined ? lastItem.number : lastItem.result);
            let actualResult = actualNum >= 5 ? "BIG" : "SMALL";
            let actualPeriod = String(lastItem.issueName || lastItem.issueNumber || lastItem.period || lastItem.issue);
            
            let nextPeriod = String(BigInt(actualPeriod) + 1n);
            let cheerMsgText = "";

            if (lastPredictedPeriod && lastPredictedPeriod === actualPeriod) {
                let isNumberHit = lastPredictedNumbers.includes(actualNum);

                if (lastPredictedResult === actualResult) {
                    totalWins++;
                    maintenanceLevel = 1;

                    if (isNumberHit) {
                        cheerMsgText = "💥 **WINNER JACKPOT** 💥\nCONGRATULATIONS 💐🎉";
                    } else {
                        cheerMsgText = "🏆🎉 **BIG WINNER** 🎉🏆\nCONGRATULATIONS 💐🎉";
                    }
                } else {
                    totalLosses++;
                    maintenanceLevel++;
                    cheerMsgText = "💪 **Cheer Up Mame! Next Time Mark It!** 👍\nBetter Luck Next Time!";

                    if (maintenanceLevel > 7) {
                        maintenanceLevel = 1;
                    }
                }
            }

            if (nextPeriod !== lastSentPeriod) {
                let pred = patternEngine7(list);
                let currentAmount = levelAmounts[maintenanceLevel] || ("Level " + maintenanceLevel);

                let msg = "👑 **KING PREDICTION**\n" +
                          "━━━━━━━━━━━━━━━━━━━━━\n" +
                          "📌 **PERIOD:** `" + nextPeriod + "`\n" +
                          "🎯 **TARGET:** **" + pred.predResult + "**\n" +
                          "🔢 **NUMBERS:** `" + pred.numbersStr + "`\n" +
                          "🎨 **COLOUR:** " + pred.colorStr + "\n" +
                          "💰 **LEVEL AMOUNT:** **Level " + maintenanceLevel + " (" + currentAmount + ")**\n" +
                          "━━━━━━━━━━━━━━━━━━━━━\n";

                if (cheerMsgText !== "") {
                    msg += cheerMsgText + "\n━━━━━━━━━━━━━━━━━━━━━\n";
                }

                msg += "\n🏆 **TOTAL WINS:** **" + totalWins + "**\n" +
                       "💔 **TOTAL LOSS:** **" + totalLosses + "**\n\n" +
                       "🔗 **Register Link:**\n" + REGISTER_LINK;

                await bot.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' });

                lastSentPeriod = nextPeriod;
                lastPredictedPeriod = nextPeriod;
                lastPredictedResult = pred.predResult;
                lastPredictedNumbers = pred.targetNumbers;
                console.log("[SUCCESS] Message Sent: " + nextPeriod);
            }
        }
    } catch (error) {
        console.error('[SYNC ERROR]:', error.message);
    }
}

console.log("WinGo 7-Sequence Pattern Engine Active...");
setInterval(fetchWinGoData, 5000);
