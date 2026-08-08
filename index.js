// (முந்தைய கோட் அப்படியே இருக்கும், இந்த sendToAllChannels மற்றும் முக்கிய இடங்களில் மட்டும் மாற்றம் செய்துள்ளேன்)

// அனைத்து சேனல்களுக்கும் Prediction அனுப்பும் வசதி
async function sendPredictionToChannels(message, options = {}) {
    try {
        // மெயின் சேனலுக்கு மட்டும் Prediction அனுப்பப்படும்
        await bot.sendMessage('-1002486828817', message, options);
    } catch (e) {
        console.error(`Error sending prediction:`, e.message);
    }
}

// Summary Report-ஐ மட்டும் இரண்டு சேனலுக்கும் அனுப்பும் வசதி
async function sendSummaryToAllChannels(message, options = {}) {
    const reportChannels = ['-1002486828817', '-1003345976502'];
    for (const channelId of reportChannels) {
        try {
            await bot.sendMessage(channelId, message, options);
        } catch (e) {
            console.error(`Error sending report to ${channelId}:`, e.message);
        }
    }
}

// ... (fetchWinGoData பங்க்ஷனில் கீழே உள்ள மாற்றங்களைச் செய்யவும்) ...

// 60 ரவுண்ட் முடிந்த பின் Summary அனுப்பும் இடத்தில்:
if (predictionCount >= 60) {
    // ... summaryMsg ...
    await sendSummaryToAllChannels(summaryMsg, { parse_mode: 'Markdown' }); // இது மட்டும் மாற்றம்
    // ... reset variables ...
}

// சாதாரண Prediction அனுப்பும் இடத்தில்:
if (nextPeriod !== lastSentPeriod) {
    // ... msg உருவாக்கப்படும் ...
    await sendPredictionToChannels(msg, { parse_mode: 'Markdown' }); // இது மட்டும் மாற்றம்
    // ...
}
