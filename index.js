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
const URL = "https://timeout-server.vercel.app/";

// const bot = new TGBot(tgbToken, { polling: false });

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
    // try {
    //   const serverOn = (await getServerStatusDB()).on;
    //   if (!serverOn)
    //     bot.sendMessage(
    //       chatId,
    //       `<i><b>Join in! Server open on IP:</b></i> ${newStatus.ipv4}:25565`,
    //       { parse_mode: "HTML" }
    //     );
    // } catch (err) {
    //   console.error("Error reading server status or sending message:", err);
    // }
    await updateServerStatusDB({
      ...newStatus,
      lastUpdateTime: Date.now(),
    });

    fetch(`${URL}/statusoff`, {
      method: "POST",
      headers: { "x-api-password": apiPassword },
    }).catch(() => {});

    res.json(newStatus);
  } catch (err) {
    res.status(500).json({ err: "Error updating server status" });
  }
});

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
