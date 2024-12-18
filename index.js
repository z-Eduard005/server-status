import fs from "fs/promises";
// import dotenv from "dotenv";
import express from "express";
import TGBot from "node-telegram-bot-api";

// dotenv.config({ path: ".env.local" });
const port = process.env.PORT || 3000;
const tgbToken = process.env.TELEGRAM_BOT_TOKEN || "";
const chatId = Number(process.env.CHAT_ID) || 0;
const apiPassword = process.env.API_PASSWORD || "";
const allowedIPs = JSON.parse(process.env.ALLOWED_IPS || "[]");
const DATA_FILE_PATH = "./data.json";
const QUERY_TIMEOUT_DURATION_SEC = 50;
let queryTimeout = null;
const app = express();
app.use(express.json());

const checkPassword = (req, res, next) => {
  if (req.headers["x-api-password"] === apiPassword) return next();
  return res.status(403).json({ error: "Access denied" });
};

async function getServerStatus() {
  const data = await fs.readFile(DATA_FILE_PATH, "utf8");
  return JSON.parse(data);
}

async function updateServerStatus(status) {
  await fs.writeFile(DATA_FILE_PATH, JSON.stringify(status, null, 2));
}

const resetTimeout = () => {
  if (queryTimeout) clearTimeout(queryTimeout);

  queryTimeout = setTimeout(async () => {
    try {
      await updateServerStatus({ on: false, ipv4: null });
      bot.sendMessage(chatId, "<b>Server closed!</b>", { parse_mode: "HTML" });
    } catch (err) {
      console.error("Error updating server status:", err);
    }
  }, QUERY_TIMEOUT_DURATION_SEC * 1000);
};

const bot = new TGBot(tgbToken, { polling: true });

bot.setMyCommands([{ command: "/test", description: "Test command" }]);

bot.on("message", (msg) => {
  if (chatId === msg.chat.id && msg.text === "/test")
    bot.sendMessage(chatId, "I'm active now!");
});

bot.on("polling_error", (err) => {
  console.error("Polling error:", err);
  bot.stopPolling();
  setTimeout(() => bot.startPolling(), 5000);
});

app.get("/get", checkPassword, async (req, res) => {
  try {
    const serverStatus = await getServerStatus();
    res.json(serverStatus);
  } catch (err) {
    res.status(500).json({ err: "Error reading server status" });
  }
});

app.post("/check", checkPassword, (req, res) => {
  const { ipv4 } = req.body;
  const ok = allowedIPs.some((pc) => pc.ip === ipv4);
  res.json({ ok });
});

app.post("/set", checkPassword, async (req, res) => {
  try {
    const newStatus = req.body;
    try {
      if (!(await getServerStatus().on))
        bot.sendMessage(
          chatId,
          `Server open! On IP: <b>${newStatus.ipv4}:25565</b>`,
          { parse_mode: "HTML" }
        );
    } catch (err) {
      console.error("Error reading server status:", err);
    }
    await updateServerStatus(newStatus);
    resetTimeout();
    res.json(newStatus);
  } catch (err) {
    res.status(500).json({ err: "Error updating server status" });
  }
});

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
