const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server for Render
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('WinGo 30S Smart Engine Active!'));
app.listen(PORT, '0.0.0.0', () => console.log("Server running on port " + PORT));

// Configuration
const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';
const SCRAPINGANT_API_KEY = '2a3f73c602be4a9c8abd9ae09cb196a9'; 

const TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json?pageSize=1000&pageNo=1';
const REGISTER_LINK = 'https://www.rajastake7.com/#/register?invitationCode=172723872480';

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

let lastSentPeriod = "";
let lastPredictedResult = null;
let lastPredictedNumbers = [];
let lastPredictedColor = "";
let lastPredictedPeriod = null;

let totalWins = 0;
let totalLosses = 0;
let consecLosses = 0;
let maintenanceLevel = 1;
let cooldownCounter = 0;

let prediction60History = [];

const levelData = {
    1: { name: "₹1", val: 1 },
    2: { name: "₹3", val: 3 },
    3: { name: "₹9", val: 9 },
    4: { name: "₹27", val: 27 },
    5: { name: "₹81", val: 81 },
    6: { name: "₹243", val: 243 },
    7: { name: "₹729", val: 729 },
    8: { name: "₹2187", val: 2187 }
};

function invertPattern(str) {
    return str.split('').map(char => char === 'B' ? 'S' : (char === 'S' ? 'B' : char)).join('');
}

// Advanced Trend Protection Engine
function deepHistoryPatternEngine(history) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "B" : "S");

        let predResult = "";

        // 1. Dragon Trend Detection (3 அல்லது அதற்கு மேல் ஒரே ரிசல்ட் வந்தால் தொடர்வது)
        if (allResults[0] === allResults[1] && allResults[1] === allResults[2]) {
            predResult = allResults[0] === "B" ? "BIG" : "SMALL";
        }
        // 2. Alternate / Zig-Zag Detection (B S B S B S முறையில் வந்தால் மாற்றி வைப்பது)
        else if (allResults[0] !== allResults[1] && allResults[1] !== allResults[2] && allResults[2] !== allResults[3]) {
            predResult = allResults[0] === "B" ? "SMALL" : "BIG";
        }
        // 3. Double Pair Trend Detection (BB SS BB SS)
        else if (allResults[0] === allResults[1] && allResults[2] === allResults[3] && allResults[0] !== allResults[2]) {
            predResult = allResults[0] === "B" ? "SMALL" : "BIG";
        }
        // 4. Heavy Frequency & Weight-based Analysis (Weighted Trend Check)
        else {
            let scoreB = 0;
            let scoreS = 0;
            let seq5 = allResults.slice(0, 5).join("");
            let mirrorSeq5 = invertPattern(seq5);

            for (let i = 1; i < Math.min(60, allResults.length - 6); i++) {
                let histSeq5 = allResults.slice(i, i + 5).join("");
                let nextItem = allResults[i - 1];
                let weight = i < 20 ? 4 : (i < 40 ? 2 : 1);

                if (histSeq5 === seq5) {
                    if (nextItem === "B") scoreB += (2 * weight);
                    if (nextItem === "S") scoreS += (2 * weight);
                }
                if (histSeq5 === mirrorSeq5) {
                    if (nextItem === "S") scoreB += (2 * weight);
                    if (nextItem === "B") scoreS += (2 * weight);
                }
            }

            if (scoreB > scoreS) predResult = "BIG";
            else if (scoreS > scoreB) predResult = "SMALL";
            else predResult = allResults[0] === "B" ? "BIG" : "SMALL"; 
        }

        // Smart Number Prediction
        let candidateNums = predResult === "BIG" ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
        let numberFrequency = {};
        candidateNums.forEach(n => numberFrequency[n] = 0);

        for (let i = 0; i < Math.min(30, allNumbers.length); i++) {
            let num = allNumbers[i];
            if (candidateNums.includes(num)) {
                let recencyWeight = (30 - i);
                numberFrequency[num] = (numberFrequency[num] || 0) + recencyWeight;
            }
        }

        let sortedNumbers = candidateNums.sort((a, b) => numberFrequency[b] - numberFrequency[a]);
        let matchedNumbers = sortedNumbers.slice(0, 2);

        let numbersStr = matchedNumbers.join(", ");
        let mainColor = predResult === "BIG" ? "GREEN" : "RED";
        let colorStr = mainColor === "GREEN" ? "🟢 GREEN" : "🔴 RED";
        if (matchedNumbers.includes(0) || matchedNumbers.includes(5)) {
            colorStr += " / 🟣 VIOLET";
        }

        return { predResult, targetNumbers: matchedNumbers, numbersStr, colorStr, mainColor };

    } catch (e) {
        console.error("Pattern Engine Error:", e.message);
        return { predResult: "BIG", targetNumbers: [7, 8], numbersStr: "7, 8", colorStr: "🟢 GREEN", mainColor: "GREEN" };
    }
}

let isFetching = false;

async function fetchWinGoData() {
    if (isFetching) return;
    isFetching = true;

    try {
        const scraperUrl = `https://api.scrapingant.com/v2/general?url=${encodeURIComponent(TARGET_URL)}&x-api-key=${SCRAPINGANT_API_KEY}&browser=false&return_page_source=false`;

        let rawContent = null;

        try {
            const response = await axios.get(scraperUrl, { timeout: 15000 });
            rawContent = response.data;
        } catch (err) {
            const directRes = await axios.get(TARGET_URL, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Referer': 'https://www.rajastake7.com/'
                }
            });
            rawContent = directRes.data;
        }

        if (typeof rawContent === 'string') {
            try { rawContent = JSON.parse(rawContent); } catch (e) {}
        }

        let list = rawContent?.data?.list || rawContent?.list || (Array.isArray(rawContent) ? rawContent : null);

        if (!list || !Array.isArray(list) || list.length === 0) {
            isFetching = false;
            return;
        }

        let lastItem = list[0];
        let actualNum = parseInt(lastItem.number !== undefined ? lastItem.number : lastItem.result);
        let actualResult = actualNum >= 5 ? "BIG" : "SMALL";
        let actualColor = (actualNum === 0 || actualNum === 5) ? "VIOLET" : (actualNum >= 5 ? "GREEN" : "RED");
        let actualPeriod = String(lastItem.issueName || lastItem.issueNumber || lastItem.period || lastItem.issue);
        
        let nextPeriod = String(BigInt(actualPeriod) + 1n);
        let dynamicStatusMsg = "";

        if (lastPredictedPeriod && lastPredictedPeriod === actualPeriod) {
            let isResultHit = (lastPredictedResult === actualResult);
            let isNumberHit = lastPredictedNumbers.includes(actualNum);
            let isColorHit = (lastPredictedColor === actualColor) || (actualColor === "VIOLET");

            let currentLevelExecuted = maintenanceLevel;

            if (isResultHit) {
                totalWins++;
                consecLosses = 0;

                if (isResultHit && isNumberHit && isColorHit) {
                    dynamicStatusMsg = "🏆 **" + actualResult + " " + actualNum + " " + actualColor + " JACKPOT WINNERS** 🏆";
                } 
                else if (isResultHit && isNumberHit) {
                    dynamicStatusMsg = "🏆 **" + actualResult + " " + actualNum + " JACKPOT WINNER** 🏆";
                } 
                else if (isResultHit && isColorHit) {
                    dynamicStatusMsg = "🏆 **" + actualResult + " " + actualColor + " WINNER CONGRATULATIONS** 🏆";
                } 
                else {
                    dynamicStatusMsg = "🏆 **" + actualResult + " WIN** 🏆";
                }

                prediction60History.unshift({ period: actualPeriod, status: "WIN", level: currentLevelExecuted });
                maintenanceLevel = 1; // Win கிடைத்தவுடன் Level 1-க்கு ரீசெட் ஆகும்

            } else {
                totalLosses++;
                consecLosses++;

                dynamicStatusMsg = "🎲 **RESULT: " + actualResult + " (" + actualNum + ")**";

                prediction60History.unshift({ period: actualPeriod, status: "LOSS", level: currentLevelExecuted });
                maintenanceLevel++;

                // தொடர்ந்து 5 முறை லாஸ் ஆனால் 3 பெட் பிரேக் எடுக்கும் (Safe Risk Control)
                if (consecLosses >= 5) {
                    cooldownCounter = 3;
                    consecLosses = 0;
                    maintenanceLevel = 1; // 5 லாஸுக்குப் பிறகு உடனே Level 1-க்கு ரீசெட் செய்யப்படும்
                    await bot.sendMessage(CHANNEL_ID, "⚠️ **HIGH RISK TREND DETECTED!**\n🛑 Bot is taking a break for 3 predictions to analyze new trend pattern.", { parse_mode: 'Markdown' });
                }

                if (maintenanceLevel > 8) maintenanceLevel = 1;
            }
        }

        if (nextPeriod !== lastSentPeriod) {
            if (cooldownCounter > 0) {
                cooldownCounter--;
                console.log(`[PAUSE] Skipping high-risk trend. Remaining: ${cooldownCounter}`);
                lastSentPeriod = nextPeriod;
                isFetching = false;
                return;
            }

            let pred = deepHistoryPatternEngine(list);
            
            let activeLevel = maintenanceLevel;
            let nextLevel = (activeLevel >= 8) ? 1 : activeLevel + 1;
            
            let currentLevelInfo = levelData[activeLevel] || levelData[1];
            let nextLevelInfo = levelData[nextLevel] || levelData[1];

            let msg = "👑 **KING PREDICTION**\n" +
                      "⚡ **WinGo 30S** ⚡\n" +
                      "━━━━━━━━━━━━━━━━━━━━━\n" +
                      "📌 **PERIOD:** `" + nextPeriod + "`\n" +
                      "🎯 **TARGET:** **" + pred.predResult + "**\n" +
                      "🔢 **NUMBERS:** `" + pred.numbersStr + "`\n" +
                      "🎨 **COLOUR:** " + pred.colorStr + "\n" +
                      "💰 **LEVEL AMOUNT:** **Level " + activeLevel + " (" + currentLevelInfo.name + ")**\n" +
                      "👉 **NEXT BET:** **Level " + nextLevel + " (" + nextLevelInfo.name + ")** *(If Level " + activeLevel + " Losses)*\n" +
                      "━━━━━━━━━━━━━━━━━━━━━\n";

            if (dynamicStatusMsg !== "") {
                msg += dynamicStatusMsg + "\n━━━━━━━━━━━━━━━━━━━━━\n";
            }

            msg += "🏆 **WINS:** " + totalWins + "\n" +
                   "💔 **LOSSES:** " + totalLosses + "\n" +
                   "━━━━━━━━━━━━━━━━━━━━━\n\n" +
                   "🔗 **Register Link:**\n" + REGISTER_LINK;

            await bot.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' });

            lastSentPeriod = nextPeriod;
            lastPredictedPeriod = nextPeriod;
            lastPredictedResult = pred.predResult;
            lastPredictedNumbers = pred.targetNumbers;
            lastPredictedColor = pred.mainColor;
            console.log("[SUCCESS] Prediction Sent: " + nextPeriod);
        }
    } catch (error) {
        console.error('[FETCH ERROR]:', error.message);
    } finally {
        isFetching = false;
    }
}

setInterval(fetchWinGoData, 10000);
