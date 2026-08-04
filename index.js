const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send('WinGo 4-Digit Stealth Engine is Live!');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';
const TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageSize=50&pageNo=1';
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

// 🎯 STRICT 4-DIGIT PATTERN ENGINE
function patternEngine4(history) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "B" : "S");

        let pattern4 = allResults.slice(0, 4).join("");
        let pattern3 = allResults.slice(0, 3).join("");

        let matchB = 0;
        let matchS = 0;

        for (let i = 1; i < allResults.length - 4; i++) {
            let pastPattern = allResults.slice(i, i + 4).join("");
            if (pattern4 === pastPattern) {
                let nextResult = allResults[i - 1];
                if (nextResult === "B") matchB++;
                if (nextResult === "S") matchS++;
            }
        }

        if (matchB === 0 && matchS === 0) {
            for (let i = 1; i < allResults.length - 3; i++) {
                let pastPattern = allResults.slice(i, i + 3).join("");
                if (pattern3 === pastPattern) {
                    let nextResult = allResults[i - 1];
                    if (nextResult === "B") matchB++;
                    if (nextResult === "S") matchS++;
                }
            }
        }

        let predResult = "BIG";
        if (matchS > matchB) {
            predResult = "SMALL";
        } else if (matchB > matchS) {
            predResult = "BIG";
        } else {
            predResult = allResults[0] === "B" ? "BIG" : "SMALL";
        }

        let candidateNums = predResult === "BIG" ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
        let num1 = allNumbers[0];
        let num2 = allNumbers[1];

        let numFreqMap = {};

        for (let i = 1; i < allNumbers.length - 2; i++) {
            if (allNumbers[i] === num1 && allNumbers[i + 1] === num2) {
                let numAbove = allNumbers[i - 1];
                let numBelow = allNumbers[i + 2];

                if (candidateNums.includes(numAbove)) {
                    numFreqMap[numAbove] = (numFreqMap[numAbove] || 0) + 3;
                }
                if (numBelow !== undefined && candidateNums.includes(numBelow)) {
                    numFreqMap[numBelow] = (numFreqMap[numBelow] || 0) + 1;
                }
            }
        }

        if (Object.keys(numFreqMap).length === 0) {
            allNumbers.slice(0, 15).filter(n => candidateNums.includes(n)).forEach(n => {
                numFreqMap[n] = (numFreqMap[n] || 0) + 1;
            });
        }

        candidateNums.sort((a, b) => (numFreqMap[b] || 0) - (numFreqMap[a] || 0));
        let targetNumbers = [candidateNums[0], candidateNums[1]];

        let numbersStr = targetNumbers.join(", ");
        let colorStr = predResult === "BIG" ? "🟢 GREEN" : "🔴 RED";

        return { predResult, targetNumbers, numbersStr, colorStr };
    } catch (e) {
        console.error("4-Digit Engine Error:", e.message);
        return { predResult: "BIG", targetNumbers: [7, 8], numbersStr: "7, 8", colorStr: "🟢 GREEN" };
    }
}

let browser = null;

async function getBrowserInstance() {
    if (!browser || !browser.isConnected()) {
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });
    }
    return browser;
}

async function fetchWinGoData() {
    let page = null;
    try {
        const b = await getBrowserInstance();
        page = await b.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

        let content = await page.evaluate(() => document.body.innerText || document.body.textContent);

        // Safe JSON extraction logic
        let jsonStart = content.indexOf('{');
        let jsonEnd = content.lastIndexOf('}');

        if (jsonStart === -1 || jsonEnd === -1) {
            throw new Error("No valid JSON structure found in page content");
        }

        let cleanJsonString = content.substring(jsonStart, jsonEnd + 1);
        let data = JSON.parse(cleanJsonString);

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
                let pred = patternEngine4(list);
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
                console.log("[STEALTH SUCCESS] 4-Digit Message Sent: " + nextPeriod);
            }
        }
    } catch (error) {
        console.error('[STEALTH ERROR]:', error.message);
        if (browser) {
            await browser.close().catch(() => {});
            browser = null;
        }
    } finally {
        if (page) {
            await page.close().catch(() => {});
        }
    }
}

console.log("WinGo Stealth Engine Active...");
setInterval(fetchWinGoData, 10000);
