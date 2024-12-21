import express from "express";
import TGBot from "node-telegram-bot-api";
import { getServerStatusDB, updateServerStatusDB } from "./firebase.js";
// import dotenv from "dotenv";
// dotenv.config({ path: ".env.local" });

const port = process.env.PORT || 3000;
const tgbToken = process.env.TELEGRAM_BOT_TOKEN || "";
const chatId = Number(process.env.CHAT_ID) || 0;
const apiPassword = process.env.API_PASSWORD || "";
const allowedIPs = JSON.parse(process.env.ALLOWED_IPS || "[]");
const QUERY_TIMEOUT_DURATION_MS = 29 * 1000;
const URL = "https://server-status-iota.vercel.app";
// const URL = "http://localhost:3001";

const bot = new TGBot(tgbToken, { polling: true });

bot.on("polling_error", (err) => {
  console.error("Polling error:", err);
  bot.stopPolling();
  setTimeout(() => bot.startPolling(), 5000);
});

const app = express();
app.use(express.json());

const checkPassword = (req, res, next) => {
  if (req.headers["x-api-password"] === apiPassword) return next();
  return res.status(403).json({ error: "Access denied" });
};

app.get("/get", checkPassword, async (req, res) => {
  try {
    const { on, ipv4 } = await getServerStatusDB();
    res.json({ on, ipv4 });
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
      const serverOn = (await getServerStatusDB()).on;
      if (!serverOn)
        bot.sendMessage(
          chatId,
          `<i><b>Join in! Server open on IP:</b></i> ${newStatus.ipv4}:25565`,
          { parse_mode: "HTML" }
        );
    } catch (err) {
      console.error("Error reading server status or sending message:", err);
    }
    await updateServerStatusDB({
      ...newStatus,
      lastUpdateTime: Date.now(),
    });

    fetch(`${URL}/statusoff`, { method: "POST" });
    res.json(newStatus);
  } catch (err) {
    res.status(500).json({ err: "Error updating server status" });
  }
});

app.post("/statusoff", async (req, res) => {
  let timeoutPromise = null;
  let queryTimeout = null;
  try {
    timeoutPromise = new Promise((resolve) => {
      queryTimeout = setTimeout(async () => {
        const lastUpdateTime = (await getServerStatusDB()).lastUpdateTime;
        if (Date.now() - lastUpdateTime >= QUERY_TIMEOUT_DURATION_MS) {
          await updateServerStatusDB({
            on: false,
            ipv4: "",
            lastUpdateTime: Date.now(),
          });
          try {
            await bot.sendMessage(chatId, "<i><b>Server closed!</b></i>", {
              parse_mode: "HTML",
            });
          } catch (err) {
            console.error("Error sending message:", err);
          }
          resolve();
        }
      }, QUERY_TIMEOUT_DURATION_MS);
    });
    await timeoutPromise;
    res.json({ clearTimeout: "clearTimeout" });
  } catch {
    console.error("Error updating server status. Data will be outdated!");
    try {
      await bot.sendMessage(
        chatId,
        "<i><b>Error: Server status - open, but the server itself is closed!</b></i>",
        { parse_mode: "HTML" }
      );
    } catch (err) {
      console.error("Error sending message:", err);
    }
    res.status(500).json({ err: "err" });
  }
});

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
