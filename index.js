import express from "express";
import TGBot from "node-telegram-bot-api";
import { waitUntil } from "@vercel/functions";
import { setTimeout as setTimeoutPromis } from "timers/promises";
import { getServerStatusDB, updateServerStatusDB } from "./firebase.js";

const port = process.env.PORT || 3000;
const tgbToken = process.env.TELEGRAM_BOT_TOKEN || "";
const chatId = Number(process.env.CHAT_ID) || 0;
const apiPassword = process.env.API_PASSWORD || "";
const allowedIPs = JSON.parse(process.env.ALLOWED_IPS || "[]");
const QUERY_TIMEOUT_DURATION_MS = 45 * 1000;

const bot = new TGBot(tgbToken, { polling: false });

const app = express();
app.use(express.json());

const checkPassword = (req, res, next) => {
  if (req.headers["x-api-password"] === apiPassword) return next();
  return res.status(403).json({ err: "Access denied!" });
};

app.post("/check", checkPassword, async (req, res) => {
  try {
    const ipv4DB = (await getServerStatusDB()).ipv4;
    const { ipv4 } = req.body;
    const ok = allowedIPs.some((pc) => pc.ip === ipv4);
    if (!ok) res.status(403).json({ err: "You are not allowed to play!" });
    res.json({ ip: ipv4DB, allowedIPs: allowedIPs.map((pc) => pc.ip) });
  } catch (err) {
    res.status(500).json({ err: "Error reading server status" });
  }
});

app.post("/set", checkPassword, async (req, res) => {
  try {
    const { ipv4 } = req.body;
    try {
      const serverOn = (await getServerStatusDB()).ipv4;
      if (!serverOn)
        bot.sendMessage(
          chatId,
          `<i><b>Join in! Server open on IP:</b></i> ${ipv4}:25565`,
          { parse_mode: "HTML" }
        );
    } catch (err) {
      console.error("Error reading server status or sending message:", err);
    }
    await updateServerStatusDB({
      ipv4,
      lastUpdateTime: Date.now(),
    });

    waitUntil(
      (async () => {
        try {
          await setTimeoutPromis(QUERY_TIMEOUT_DURATION_MS);

          const lastUpdateTime = (await getServerStatusDB()).lastUpdateTime;
          if (Date.now() - lastUpdateTime >= QUERY_TIMEOUT_DURATION_MS) {
            await updateServerStatusDB({
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
          }
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
        }
      })()
    );

    res.json(ipv4);
  } catch (err) {
    res.status(500).json({ err: "Error updating server status" });
  }
});

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
