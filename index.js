async function fetchWinGoData() {
    try {
        // ScrapingAnt Endpoint (browser=false -> 1 credit per request)
        const scraperUrl = `https://api.scrapingant.com/v1/general?url=${encodeURIComponent(TARGET_URL)}&x-api-key=${SCRAPINGANT_API_KEY}&browser=false`;
        
        // Timeout 25000ms (25 seconds) ஆக அதிகரிக்கப்பட்டுள்ளது
        const response = await axios.get(scraperUrl, { 
            timeout: 25000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        let data = response.data;
        if (data && data.content) {
            try { data = JSON.parse(data.content); } catch (e) {}
        }

        let list = data?.data?.list || data?.list || data;

        if (Array.isArray(list) && list.length > 0) {
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
                    maintenanceLevel = 1;

                } else {
                    totalLosses++;
                    consecLosses++;

                    dynamicStatusMsg = "🎲 **RESULT: " + actualResult + " (" + actualNum + ")**";

                    prediction60History.unshift({ period: actualPeriod, status: "LOSS", level: currentLevelExecuted });
                    maintenanceLevel++;

                    if (consecLosses >= 6) {
                        cooldownCounter = 5;
                        consecLosses = 0;
                        maintenanceLevel = 1;
                        await bot.sendMessage(CHANNEL_ID, "⚠️ **6 CONTINUOUS LOSSES DETECTED!**\n🛑 Bot is taking a break for 5 predictions to prevent loss during bad pattern trend.", { parse_mode: 'Markdown' });
                    }

                    if (maintenanceLevel > 8) maintenanceLevel = 1;
                }

                if (prediction60History.length > 60) {
                    prediction60History.pop();
                }
            }

            if (nextPeriod !== lastSentPeriod) {
                if (cooldownCounter > 0) {
                    cooldownCounter--;
                    console.log(`[STOP SYSTEM] Cooldown active. Remaining predictions to skip: ${cooldownCounter}`);
                    lastSentPeriod = nextPeriod;
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
        }
    } catch (error) {
        if (error.response && error.response.status === 409) {
            console.log('[SCRAPINGANT 409 CONFLICT]: Waiting for next interval...');
        } else {
            console.error('[FETCH ERROR]:', error.message);
        }
    }
}
