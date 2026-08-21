require("dotenv").config();

const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

// =====================================================
// CONFIG
// =====================================================

const app = express();
const PORT = process.env.PORT || 10000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const SCRAPINGANT_API_KEY = process.env.SCRAPINGANT_API_KEY;
const TARGET_CHAT_ID = process.env.TARGET_CHAT_ID;

const RAW_TARGET_URL =
  process.env.RAW_TARGET_URL ||
  "https://draw.ar-lottery01.com/WinGo/WinGo_30S.json";

if (!BOT_TOKEN || !SCRAPINGANT_API_KEY || !TARGET_CHAT_ID) {
  console.error("Missing required environment variables.");
  process.exit(1);
}

// =====================================================
// TELEGRAM
// =====================================================

const bot = new TelegramBot(BOT_TOKEN, {
  polling: {
    interval: 2000,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});

bot.on("polling_error", (error) => {
  console.log("Telegram polling error:", error.message);
});

// =====================================================
// SCRAPINGANT
// =====================================================

function getScrapingUrl() {
  return (
    "https://api.scrapingant.com/v2/general" +
    `?x-api-key=${encodeURIComponent(SCRAPINGANT_API_KEY)}` +
    `&url=${encodeURIComponent(RAW_TARGET_URL)}` +
    "&proxy_country=in&browser=false"
  );
}

// =====================================================
// HELPERS
// =====================================================

function getNumber(item) {
  const value =
    item?.number ??
    item?.result ??
    item?.winNumber ??
    item?.openNumber;

  const n = Number.parseInt(value, 10);

  return Number.isFinite(n) ? n : null;
}

function getPeriod(item) {
  return String(
    item?.issueName ??
    item?.issueNumber ??
    item?.period ??
    item?.issue ??
    item?.issueCode ??
    ""
  );
}

function getBigSmall(number) {
  if (!Number.isFinite(number)) return null;
  return number >= 5 ? "B" : "S";
}

function getColor(number) {
  if ([2, 4, 6, 8].includes(number)) return "RED";
  if ([1, 3, 7, 9].includes(number)) return "GREEN";
  if (number === 0) return "RED / VIOLET";
  if (number === 5) return "GREEN / VIOLET";

  return "UNKNOWN";
}

// =====================================================
// NORMALIZE API DATA
// =====================================================

function extractList(parsedData) {
  if (Array.isArray(parsedData)) {
    return parsedData;
  }
  if (Array.isArray(parsedData?.data?.list)) {
    return parsedData.data.list;
  }
  if (Array.isArray(parsedData?.data)) {
    return parsedData.data;
  }
  if (Array.isArray(parsedData?.list)) {
    return parsedData.list;
  }
  return [];
}

// =====================================================
// FETCH WINGO HISTORY
// =====================================================

async function fetchWinGoData() {
  const response = await axios.get(getScrapingUrl(), {
    timeout: 30000
  });

  let rawContent = response.data?.content ?? response.data;
  let parsedData;

  if (typeof rawContent === "object") {
    parsedData = rawContent;
  } else {
    const text = String(rawContent);
    try {
      parsedData = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error("Unable to parse API response");
      }
      parsedData = JSON.parse(match[0]);
    }
  }

  const list = extractList(parsedData);

  return list
    .map((item) => ({
      period: getPeriod(item),
      number: getNumber(item)
    }))
    .filter(
      (item) =>
        item.period !== "" &&
        Number.isFinite(item.number) &&
        item.number >= 0 &&
        item.number <= 9
    );
}

// =====================================================
// CREATE B/S HISTORY
// =====================================================

function createBSHistory(history, limit = 50) {
  return history
    .slice(0, limit)
    .map((item) => getBigSmall(item.number))
    .filter(Boolean);
}

// =====================================================
// PREDICTION LOGIC (Trend & Pattern Analysis)
// =====================================================

function predictNextMove(bsHistory) {
  if (bsHistory.length < 5) {
    return { prediction: "WAIT", confidence: "Low", reason: "Not enough data" };
  }

  // Check last 3 trends (Trend Following vs Reversal)
  const last3 = bsHistory.slice(0, 3).join("");
  const lastOne = bsHistory[0];

  let bigCount = 0;
  let smallCount = 0;

  // Check recent frequency (last 10 rounds)
  const recent10 = bsHistory.slice(0, 10);
  for (const b of recent10) {
    if (b === "B") bigCount++;
    else smallCount++;
  }

  // Basic trend prediction based on recent balance
  let prediction = lastOne === "B" ? "SMALL" : "BIG"; // default alternative
  let confidence = "Medium";
  let reason = "Alternation trend analysis";

  if (last3 === "BBB") {
    prediction = "SMALL";
    confidence = "High";
    reason = "Streak breaker (3 BIGs detected)";
  } else if (last3 === "SSS") {
    prediction = "BIG";
    confidence = "High";
    reason = "Streak breaker (3 SMALLs detected)";
  } else if (bigCount > 7) {
    prediction = "SMALL";
    confidence = "Medium";
    reason = "Big is over-frequent in last 10 rounds";
  } else if (smallCount > 7) {
    prediction = "BIG";
    confidence = "Medium";
    reason = "Small is over-frequent in last 10 rounds";
  }

  return {
    prediction,
    confidence,
    reason,
    nextPeriodEstimated: historyItemNextPeriod(bsHistory)
  };
}

function historyItemNextPeriod(bsHistory) {
  return "Next Period";
}

// =====================================================
// HISTORY STATISTICS
// =====================================================

function calculateStatistics(history, limit = 50) {
  const selected = history.slice(0, limit);

  let big = 0;
  let small = 0;

  const numbers = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0 };
  const colors = {};

  for (const item of selected) {
    const n = item.number;
    const bs = getBigSmall(n);
    const color = getColor(n);

    numbers[n]++;
    if (bs === "B") big++;
    if (bs === "S") small++;

    colors[color] = (colors[color] || 0) + 1;
  }

  return { total: selected.length, big, small, numbers, colors };
}

// =====================================================
// FORMAT TELEGRAM REPORT WITH PREDICTION
// =====================================================

function formatReport(history) {
  const stats = calculateStatistics(history, 50);
  const bsHistory = createBSHistory(history, 50);
  const predictionInfo = predictNextMove(bsHistory);

  let msg = "";

  msg += "📊 *WINGO AI PREDICTOR & ANALYZER*\n";
  msg += "━━━━━━━━━━━━━━━━━━━━\n\n";

  msg += "🎯 *NEXT ROUND PREDICTION*\n";
  msg += `👉 Prediction: *${predictionInfo.prediction}*\n`;
  msg += `📈 Confidence: ${predictionInfo.confidence}\n`;
  msg += `💡 Reason: ${predictionInfo.reason}\n\n`;

  msg += `📚 *Rounds Checked:* ${stats.total}\n`;
  msg += `🟢 *BIG:* ${stats.big} | 🔴 *SMALL:* ${stats.small}\n\n`;

  msg += "📌 *LAST 10 B/S TREND*\n";
  msg += `\`${bsHistory.slice(0, 10).join(" ")}\`\n\n`;

  msg += "⚠️ *Disclaimer:* Prediction is based on mathematical pattern trends. Play at your own risk.";

  return msg;
}

// =====================================================
// TELEGRAM COMMANDS
// =====================================================

bot.onText(/^\/start$/, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    "👋 WINGO Predictor Bot Active.\n\n" +
      "/predict - Get next round prediction & analysis\n" +
      "/stats - Last 50 numbers & color stats",
    { parse_mode: "Markdown" }
  );
});

bot.onText(/^\/predict$/, async (msg) => {
  try {
    const history = await fetchWinGoData();

    if (!history.length) {
      await bot.sendMessage(msg.chat.id, "❌ History data கிடைக்கவில்லை.");
      return;
    }

    const report = formatReport(history);
    await bot.sendMessage(msg.chat.id, report, { parse_mode: "Markdown" });
  } else {
    // handled error catch below
  }
} catch (error) {
    console.error("Predict error:", error.message);
    await bot.sendMessage(msg.chat.id, "❌ Prediction error. Please try again.");
  }
});

bot.onText(/^\/stats$/, async (msg) => {
  try {
    const history = await fetchWinGoData();
    const stats = calculateStatistics(history, 50);

    let text = "📊 *LAST 50 STATISTICS*\n\n";
    text += `BIG: ${stats.big} | SMALL: ${stats.small}\n\n`;
    text += "🔢 *NUMBERS*\n";

    for (let n = 0; n <= 9; n++) {
      text += `${n} → ${stats.numbers[n]}\n`;
    }

    await bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Stats error:", error.message);
    await bot.sendMessage(msg.chat.id, "❌ Statistics failed.");
  }
});

// =====================================================
// WEB SERVER & HEALTH CHECK
// =====================================================

app.get("/", (req, res) => {
  res.send("WINGO Predictor Bot is Live!");
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "wingo-predictor-bot",
    time: new Date().toISOString()
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
