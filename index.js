// index.js
require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  ThreadAutoArchiveDuration,
  EmbedBuilder,
} = require("discord.js");
const cron = require("node-cron");
const { fetchIndiaMatches } = require("./scrape-espn"); // Ensure this matches your file name!

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const CHANNEL_ID = process.env.CHANNEL_ID;
const THREAD_PREFIX = "🏏";

const matchThreads = new Map();

function getISTHour() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 5.5 * 3600000);
  return ist.getHours();
}

function formatMatchMessage(match) {
  let embedColor = 0x0099ff; // Default Blue
  const statusLower = match.status.toLowerCase();

  if (
    statusLower.includes("live") ||
    statusLower.includes("stumps") ||
    statusLower.includes("innings break")
  ) {
    embedColor = 0x00ff00; // Green for active/ongoing
  } else if (/(result|ended|finished|won|drawn|tied)/i.test(statusLower)) {
    embedColor = 0xff0000; // Red for finished
  }

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`🏏 ${match.matchTitle}`)
    .addFields(
      {
        name: "Scores",
        value: `**${match.teamScores || "N/A"}**`,
        inline: false,
      },
      { name: "Status", value: match.status || "N/A", inline: false },
    )
    .setTimestamp()
    .setFooter({ text: "Live updates from ESPNcricinfo" });

  return { content: "", embeds: [embed] };
}

async function updateIndiaMatchThreads() {
  console.log("Running match update check...");

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
      // THE MASTER SPAM CHECKER: Is this match already completely finished?
      const isMatchOver =
        /(result|match ended|match finished|match completed|drawn|tied|abandoned|called off|no result|final|won)/i.test(
          match.status,
        );

      let data = matchThreads.get(match.matchId);
      let thread;
      let starterMsg;

      // Thread Recovery Process
      if (!data) {
        const activeThreads = await channel.threads.fetchActive();
        const existingThread = activeThreads.threads.find((t) =>
          t.name.includes(`[${match.matchId}]`),
        );

        if (existingThread) {
          thread = existingThread;
          starterMsg = await thread.fetchStarterMessage();
          matchThreads.set(match.matchId, {
            threadId: thread.id,
            messageId: starterMsg.id,
          });
          data = matchThreads.get(match.matchId);
          console.log(`Recovered existing thread for: ${match.matchTitle}`);
        }
      } else {
        try {
          thread = await channel.threads.fetch(data.threadId);
          starterMsg = await thread.fetchStarterMessage();
        } catch (err) {
          data = null;
        }
      }

      // Create or Update
      if (!data || !thread || !starterMsg) {
        // SPAM BLOCKER: Don't create threads for dead matches
        if (isMatchOver) {
          console.log(
            `Skipping historically finished match: ${match.matchTitle}`,
          );
          continue;
        }

        const threadName =
          `${THREAD_PREFIX} ${match.matchTitle} [${match.matchId}]`.slice(
            0,
            100,
          );

        starterMsg = await channel.send(formatMatchMessage(match));
        thread = await starterMsg.startThread({
          name: threadName,
          autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
        });

        matchThreads.set(match.matchId, {
          threadId: thread.id,
          messageId: starterMsg.id,
        });
        console.log(`Created new thread for: ${match.matchTitle}`);
      } else {
        // UPDATE Existing Thread
        await starterMsg.edit(formatMatchMessage(match));
        console.log(`Updated thread for: ${match.matchTitle}`);
      }

      // Cleanup
      if (isMatchOver) {
        matchThreads.delete(match.matchId);
      }
    }
  } catch (error) {
    console.error("Error in updateIndiaMatchThreads:", error);
  }
}

cron.schedule("*/3 * * * *", updateIndiaMatchThreads); // Runs every 3 minutes

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
  updateIndiaMatchThreads();
});

client.login(process.env.BOT_TOKEN);
