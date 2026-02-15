// index.js
// Discord bot: every hour (except 12am-5am IST), scrape Cricbuzz for India matches and create/update threads for each match
// Requires: discord.js v14+, dotenv, node-cron
const express = require("express");
const app = express();
app.get("/", (req, res) => res.send("Bot is Alive!"));
app.listen(3000, () => console.log("Keep-alive server is running!"));

require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  ThreadAutoArchiveDuration,
} = require("discord.js");
const cron = require("node-cron");
const { fetchIndiaMatches } = require("./scrape-cricbuzz");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const CHANNEL_ID = process.env.CHANNEL_ID;
const THREAD_PREFIX = "🏏";

// Move this back to the top level so the bot remembers threads between runs
const matchThreads = new Map();

function getISTHour() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 5.5 * 3600000);
  return ist.getHours();
}

function formatMatchMessage(match) {
  return `**${match.matchTitle}**\nStatus: ${match.status || "N/A"}\nScores: ${
    match.teamScores || "N/A"
  }`;
}

// MAIN FUNCTION (Flattened - no more nesting)
async function updateIndiaMatchThreads() {
  console.log("Running match update check..."); // Debug log

  const hour = getISTHour();
  if (hour < 5 || hour > 23) {
    console.log("Outside of IST active hours. Skipping.");
    return;
  }

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.error("Could not find channel!");
      return;
    }

    const matches = await fetchIndiaMatches();
    console.log(`Found ${matches.length} matches.`);

    for (const match of matches) {
      let data = matchThreads.get(match.matchTitle);
      let thread;
      let starterMsg;

      if (data) {
        try {
          thread = await channel.threads.fetch(data.threadId);
          starterMsg = await thread.fetchStarterMessage();
        } catch (err) {
          data = null;
        }
      }

      if (!data || !thread || !starterMsg) {
        // Create new thread
        starterMsg = await channel.send(formatMatchMessage(match));
        thread = await starterMsg.startThread({
          name: `${THREAD_PREFIX} ${match.matchTitle}`.slice(0, 100),
          autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
        });

        matchThreads.set(match.matchTitle, {
          threadId: thread.id,
          messageId: starterMsg.id,
        });
        console.log(`Created new thread for: ${match.matchTitle}`);
      } else {
        // Update existing thread starter message
        await starterMsg.edit(formatMatchMessage(match));
        console.log(`Updated thread for: ${match.matchTitle}`);
      }

      // Cleanup
      if (
        /(result|match ended|match finished|match completed|drawn|tied|abandoned|called off|no result|final)/i.test(
          match.status,
        )
      ) {
        matchThreads.delete(match.matchTitle);
      }
    }
  } catch (error) {
    console.error("Error in updateIndiaMatchThreads:", error);
  }
}

// Schedule
cron.schedule("5 * * * *", updateIndiaMatchThreads);

client.once("ready", () => {
  console.log("Discord Cricket Bot is online!");
  updateIndiaMatchThreads();
});

client.login(process.env.BOT_TOKEN);
