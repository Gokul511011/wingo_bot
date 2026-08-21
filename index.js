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
  console.log("Telegram polling:", error.message);
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

function getBigSmallText(value) {
  return value === "B" ? "BIG" : "SMALL";
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
// PATTERN GENERATOR
// PDF PATTERN CATALOGUE = 2^n
// =====================================================

function generatePatterns(length) {
  const total = 2 ** length;
  const patterns = [];

  for (let i = 0; i < total; i++) {
    let pattern = "";

    for (let bit = length - 1; bit >= 0; bit--) {
      pattern += (i & (1 << bit)) ? "B" : "S";
    }

    patterns.push(pattern);
  }

  return patterns;
}

// =====================================================
// PATTERN STATISTICS
// =====================================================

function analyzePattern(pattern) {
  let bigCount = 0;
  let smallCount = 0;

  let bigToSmall = 0;
  let smallToBig = 0;

  let alternations = 0;
  let runs = pattern.length ? 1 : 0;

  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === "B") {
      bigCount++;
    } else {
      smallCount++;
    }

    if (i > 0) {
      if (pattern[i - 1] === "B" && pattern[i] === "S") {
        bigToSmall++;
      }

      if (pattern[i - 1] === "S" && pattern[i] === "B") {
        smallToBig++;
      }

      if (pattern[i - 1] !== pattern[i]) {
        alternations++;
        runs++;
      }
    }
  }

  let type = "Mixed";

  if (bigCount === pattern.length || smallCount === pattern.length) {
    type = "All same";
  } else if (alternations === pattern.length - 1) {
    type = "Perfect alternation";
  }

  return {
    length: pattern.length,
    pattern,
    bigCount,
    smallCount,
    bigToSmall,
    smallToBig,
    alternations,
    runs,
    type
  };
}

// =====================================================
// FIND MATCHING PATTERN
// =====================================================

function findMatchingPatterns(bsHistory) {
  const results = [];

  const maxLength = Math.min(10, bsHistory.length);

  for (let length = 1; length <= maxLength; length++) {
    const current = bsHistory.slice(0, length).join("");

    const generated = generatePatterns(length);

    if (generated.includes(current)) {
      results.push(analyzePattern(current));
    }
  }

  return results;
}

// =====================================================
// LONGEST CURRENT PATTERN
// =====================================================

function getLongestPattern(bsHistory) {
  const maxLength = Math.min(10, bsHistory.length);

  if (maxLength === 0) {
    return null;
  }

  const pattern = bsHistory.slice(0, maxLength).join("");

  return analyzePattern(pattern);
}

// =====================================================
// HISTORY STATISTICS
// =====================================================

function calculateStatistics(history, limit = 50) {
  const selected = history.slice(0, limit);

  let big = 0;
  let small = 0;

  const numbers = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
    8: 0,
    9: 0
  };

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

  return {
    total: selected.length,
    big,
    small,
    numbers,
    colors
  };
}

// =====================================================
// ANALYSIS REPORT
// =====================================================

function createAnalysis(history) {
  const bsHistory = createBSHistory(history, 50);

  const statistics = calculateStatistics(history, 50);

  const longestPattern = getLongestPattern(bsHistory);

  const matchingPatterns = findMatchingPatterns(bsHistory);

  return {
    statistics,
    bsHistory,
    longestPattern,
    matchingPatterns
  };
}

// =====================================================
// FORMAT TELEGRAM REPORT
// =====================================================

function formatReport(history) {
  const analysis = createAnalysis(history);

  const stats = analysis.statistics;
  const pattern = analysis.longestPattern;

  let msg = "";

  msg += "📊 *WINGO HISTORY ANALYZER*\n";
  msg += "━━━━━━━━━━━━━━━━━━━━\n\n";

  msg += `📚 *Rounds Checked:* ${stats.total}\n`;
  msg += `🟢 *BIG:* ${stats.big}\n`;
  msg += `🔴 *SMALL:* ${stats.small}\n\n`;

  if (pattern) {
    msg += "🔍 *CURRENT PATTERN*\n";
    msg += `Pattern: \`${pattern.pattern}\`\n`;
    msg += `Length: ${pattern.length}\n`;
    msg += `Type: *${pattern.type}*\n`;
    msg += `B Count: ${pattern.bigCount}\n`;
    msg += `S Count: ${pattern.smallCount}\n`;
    msg += `Alternations: ${pattern.alternations}\n`;
    msg += `Runs: ${pattern.runs}\n\n`;
  }

  msg += "🔢 *NUMBER FREQUENCY*\n";

  for (let n = 0; n <= 9; n++) {
    msg += `${n}: ${stats.numbers[n]}  `;
  }

  msg += "\n\n🎨 *COLOUR FREQUENCY*\n";

  for (const [color, count] of Object.entries(stats.colors)) {
    msg += `${color}: ${count}\n`;
  }

  msg += "\n━━━━━━━━━━━━━━━━━━━━\n";
  msg += "📌 *LAST 50 B/S*\n";
  msg += `\`${analysis.bsHistory.join(" ")}\`\n`;

  msg += "\n⚠️ Pattern analysis only — no future-result guarantee.";

  return msg;
}

// =====================================================
// TELEGRAM COMMANDS
// =====================================================

bot.onText(/^\/start$/, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    "👋 WINGO History Analyzer active.\n\n" +
      "/analyze - Last 50 rounds analysis\n" +
      "/pattern - Current B/S pattern\n" +
      "/stats - Number & colour statistics",
    {
      parse_mode: "Markdown"
    }
  );
});

bot.onText(/^\/analyze$/, async (msg) => {
  try {
    const history = await fetchWinGoData();

    if (!history.length) {
      await bot.sendMessage(msg.chat.id, "❌ History data கிடைக்கவில்லை.");
      return;
    }

    const report = formatReport(history);

    await bot.sendMessage(msg.chat.id, report, {
      parse_mode: "Markdown"
    });
  } catch (error) {
    console.error("Analyze error:", error.message);

    await bot.sendMessage(
      msg.chat.id,
      "❌ Data analysis error. Please try again."
    );
  }
});

bot.onText(/^\/pattern$/, async (msg) => {
  try {
    const history = await fetchWinGoData();

    const bsHistory = createBSHistory(history, 50);
    const pattern = getLongestPattern(bsHistory);

    if (!pattern) {
      await bot.sendMessage(msg.chat.id, "❌ Pattern data இல்லை.");
      return;
    }

    const text =
      "🔍 *CURRENT PATTERN*\n\n" +
      `Pattern: \`${pattern.pattern}\`\n` +
      `Length: ${pattern.length}\n` +
      `Type: *${pattern.type}*\n` +
      `BIG: ${pattern.bigCount}\n` +
      `SMALL: ${pattern.smallCount}\n` +
      `Transitions: ${pattern.alternations}`;

    await bot.sendMessage(msg.chat.id, text, {
      parse_mode: "Markdown"
    });
  } catch (error) {
    console.error("Pattern error:", error.message);
    await bot.sendMessage(msg.chat.id, "❌ Pattern analysis failed.");
  }
});

bot.onText(/^\/stats$/, async (msg) => {
  try {
    const history = await fetchWinGoData();

    const stats = calculateStatistics(history, 50);

    let text = "📊 *LAST 50 STATISTICS*\n\n";

    text += `BIG: ${stats.big}\n`;
    text += `SMALL: ${stats.small}\n\n`;

    text += "🔢 *NUMBERS*\n";

    for (let n = 0; n <= 9; n++) {
      text += `${n} → ${stats.numbers[n]}\n`;
    }

    text += "\n🎨 *COLOURS*\n";

    for (const [color, count] of Object.entries(stats.colors)) {
      text += `${color} → ${count}\n`;
    }

    await bot.sendMessage(msg.chat.id, text, {
      parse_mode: "Markdown"
    });
  } catch (error) {
    console.error("Stats error:", error.message);
    await bot.sendMessage(msg.chat.id, "❌ Statistics failed.");
  }
});

// =====================================================
// WEB SERVER
// =====================================================

app.get("/", (req, res) => {
  res.send("WINGO History Analyzer is Live!");
});

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "wingo-history-analyzer",
    time: new Date().toISOString()
  });
});

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
