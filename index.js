async function fetchWinGoData() {
    if (isMaintenancePause) return;

    try {
        // ScraperAPI render_js & premium headers add பண்ணியாச்சு
        const scraperUrl = "http://api.scraperapi.com?api_key=" + SCRAPER_API_KEY + "&url=" + encodeURIComponent(TARGET_URL) + "&render_js=false";
        
        const response = await axios.get(scraperUrl, { 
            timeout: 25000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*'
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

            // Win / Loss Verification
            if (lastPredictedPeriod && lastPredictedPeriod === actualPeriod) {
                if (lastPredictedResult === actualResult) {
                    totalWins++;
                    winStreak++;
                    consecutiveLosses = 0;
                    maintenanceLevel = 1;
                    cheerMsgText = "🎉 super mame... 🔥";

                    if (winStreak === 7) {
                        let win7Alert = "🎉🔥 **SUPER MAME 7 CONTINUOUS WINS!** 🔥🎉\n" +
                                        "━━━━━━━━━━━━━━━━━━━━━\n" +
                                        "👑 King Prediction Bot Hit 7 Wins in a Row!\n" +
                                        "💪 Keep Profiting, Mame!\n" +
                                        "━━━━━━━━━━━━━━━━━━━━━";
                        await bot.sendMessage(CHANNEL_ID, win7Alert, { parse_mode: 'Markdown' });
                        winStreak = 0;
                    }
                } else {
                    totalLosses++;
                    winStreak = 0;
                    consecutiveLosses++;
                    maintenanceLevel++;
                    cheerMsgText = "💪 vidu mame next time pakkalam...";

                    if (maintenanceLevel > 7) {
                        isMaintenancePause = true;
                        maintenanceLevel = 1;
                        consecutiveLosses = 0;

                        let maintMsg = "🚨 **SERVER & MARKET MAINTENANCE** 🚨\n" +
                                       "━━━━━━━━━━━━━━━━━━━━━\n" +
                                       "⚠️ Market trend is unpredictable (L7 Exceeded).\n" +
                                       "⏳ Bot is pausing for **1 HOUR** for safety.\n" +
                                       "🔄 Auto-resetting to **Level 1** after maintenance.\n" +
                                       "━━━━━━━━━━━━━━━━━━━━━";
                        
                        await bot.sendMessage(CHANNEL_ID, maintMsg, { parse_mode: 'Markdown' });

                        setTimeout(() => {
                            isMaintenancePause = false;
                        }, 3600000);

                        return;
                    }

                    if (consecutiveLosses >= 2) {
                        isCoolingDown = true;
                        consecutiveLosses = 0;

                        let coolMsg = "⏳ **MARKET TREND PAUSE (1 MIN)** ⏳\n" +
                                      "━━━━━━━━━━━━━━━━━━━━━\n" +
                                      "⚠️ 2 Continuous Losses Detected!\n" +
                                      "🛑 Pausing 1 Minute for safer trend match...\n" +
                                      "━━━━━━━━━━━━━━━━━━━━━";

                        await bot.sendMessage(CHANNEL_ID, coolMsg, { parse_mode: 'Markdown' });

                        setTimeout(() => {
                            isCoolingDown = false;
                        }, 60000);

                        return;
                    }
                }
            }

            if (isCoolingDown) return;

            if (nextPeriod !== lastSentPeriod) {
                let pred = advancedPredictionEngine(list);
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
                console.log("[SUCCESS] Update Sent: " + nextPeriod);
            }
        }
    } catch (error) {
        console.error('[SYNC ERROR]:', error.message);
    }
}
