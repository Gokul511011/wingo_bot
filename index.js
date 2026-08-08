const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 10000;

const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const MAIN_CHANNEL = '-1002486828817';
const REPORT_CHANNEL = '-1003345976502';

const RAW_TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json?pageSize=1000&pageNo=1';
const SCRAPINGANT_API_KEY = 'd717a6d4020b465aac8d0eed35459624'; 
const SCRAPINGANT_URL = `https://api.scrapingant.com/v2/general?x-api-key=${SCRAPINGANT_API_KEY}&url=${encodeURIComponent(RAW_TARGET_URL)}&proxy_country=in&browser=false`;
const REGISTER_LINK = 'https://www.rajastake7.com/#/register?invitationCode=172723872480';

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

let lastSentPeriod = "";
let lastPredictedResult = null;
let lastPredictedPeriod = null;
let totalWins = 0, totalLosses = 0, totalJackpots = 0, maintenanceLevel = 1, totalProfitLoss = 0, predictionCount = 0;

const levelData = {
    1: { name: "₹1", val: 1 }, 2: { name: "₹3", val: 3 }, 3: { name: "₹7", val: 7 }, 4: { name: "₹20", val: 20 },
    5: { name: "₹50", val: 50 }, 6: { name: "₹150", val: 150 }, 7: { name: "₹450", val: 450 }, 8: { name: "₹1350", val: 1350 }
};

function getBetVal(level) { return levelData[level] ? levelData[level].val : Math.pow(3, level - 1); }

function deepHistoryPatternEngine(history) {
    let allNumbers = history.map(x => parseInt(x.number ?? x.result ?? 0));
    let r1 = allNumbers[0] >= 5 ? "BIG" : "SMALL";
    let r2 = allNumbers[1] >= 5 ? "BIG" : "SMALL";
    let predResult = (r1 === r2) ? r1 : (r1 === "BIG" ? "SMALL" : "BIG");
    let colorStr = predResult === "BIG" ? "🟢 GREEN" : "🔴 RED";
    return { predResult, colorStr };
}

async function fetchWinGoData() {
    try {
        const response = await axios.get(SCRAPINGANT_URL, { timeout: 30000 });
        let list = response.data?.data?.list || response.data?.list;
        if (!list || !Array.isArray(list) || list.length === 0) return;

        let lastItem = list[0];
        // இங்குதான் மாற்றம் - undefined வராமல் தடுக்க செக் செய்கிறோம்
        let actualPeriod = String(lastItem.issueName ?? lastItem.issue ?? lastItem.period ?? "");
        if (!actualPeriod) return; 

        let actualNum = parseInt(lastItem.number ?? lastItem.result ?? 0);
        let actualResult = actualNum >= 5 ? "BIG" : "SMALL";
        let nextPeriod = String(BigInt(actualPeriod) + 1n);
        let dynamicStatusMsg = "";

        if (lastPredictedPeriod && lastPredictedPeriod === actualPeriod) {
            let isResultHit = (lastPredictedResult === actualResult);
            let currentBetVal = getBetVal(maintenanceLevel);
            predictionCount++;
            
            if (isResultHit) {
                totalWins++;
                totalProfitLoss += (currentBetVal * 0.98);
                dynamicStatusMsg = `🎉 **CONGRATULATIONS (LEVEL ${maintenanceLevel})**\n🏆 **${actualResult} (${actualNum}) WIN**`;
                maintenanceLevel = 1;
            } else {
                totalLosses++;
                totalProfitLoss -= currentBetVal;
                dynamicStatusMsg = `💔 **LOSS: ${actualResult} (${actualNum})**\n➡️ **NEXT LEVEL (LEVEL ${maintenanceLevel + 1})**`;
                maintenanceLevel++;
            }

            if (predictionCount >= 60) {
                let summaryMsg = `📊 **60 ROUNDS SUMMARY**\n🎯 **WINS:** ${totalWins} | 💔 **LOSSES:** ${totalLosses}\n💰 **PROFIT:** ₹${totalProfitLoss.toFixed(2)}`;
                await bot.sendMessage(MAIN_CHANNEL, summaryMsg, { parse_mode: 'Markdown' });
                await bot.sendMessage(REPORT_CHANNEL, summaryMsg, { parse_mode: 'Markdown' });
                predictionCount = 0; totalWins = 0; totalLosses = 0; totalProfitLoss = 0; maintenanceLevel = 1;
            }
        }

        if (nextPeriod !== lastSentPeriod) {
            let pred = deepHistoryPatternEngine(list);
            let msg = `🔥 **WINGO 30S** 🔥\n📌 **PERIOD:** \`${nextPeriod}\`\n🎲 **BET:** **${pred.predResult}**\n🎨 **COLOUR:** ${pred.colorStr}\n💰 **LEVEL:** ${maintenanceLevel}\n━━━━━━━━━━━━\n${dynamicStatusMsg}\n🔗 ${REGISTER_LINK}`;
            
            await bot.sendMessage(MAIN_CHANNEL, msg, { parse_mode: 'Markdown' });
            lastSentPeriod = nextPeriod;
            lastPredictedPeriod = nextPeriod;
            lastPredictedResult = pred.predResult;
        }
    } catch (e) { console.error("Error:", e.message); }
}

async function startContinuousLoop() { while (true) { await fetchWinGoData(); await new Promise(r => setTimeout(r, 6000)); } }
app.listen(PORT, '0.0.0.0', () => { console.log("Bot Active"); startContinuousLoop(); });
