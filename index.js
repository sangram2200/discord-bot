// index.js
// Discord Cricket Bot - Node.js (discord.js)
// This bot creates a thread for Indian matches and updates scores periodically.

const { Client, GatewayIntentBits, Partials } = require("discord.js");
const fetch = require("node-fetch");
require("dotenv").config();

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const API_KEY = process.env.CRICKET_API_KEY;

if (!TOKEN || !CHANNEL_ID || !API_KEY) {
  console.error(
    "Missing environment variables. Please set DISCORD_TOKEN, CHANNEL_ID, and CRICKET_API_KEY."
  );
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Replace fetchIndianMatchScore with real API integration
async function fetchIndianMatchScore() {
  const url = `https://api.cricapi.com/v1/currentMatches?apikey=${API_KEY}&offset=0`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!data.data) return null;
    // Find the first India match (men or women)
    const indiaMatch = data.data.find(
      (match) => match.name && match.name.toLowerCase().includes("india")
    );
    if (!indiaMatch) return null;
    const scoreStr =
      indiaMatch.score && indiaMatch.score.length > 0
        ? indiaMatch.score
            .map((s) => {
              const runs = s.r !== undefined ? s.r : s.runs;
              const wickets = s.w !== undefined ? s.w : s.wickets;
              const overs = s.o !== undefined ? s.o : s.overs;
              // If inning string contains both teams, use the first team for first score, second for second, etc.
              let teamName = s.inning;
              // Try to extract the team name from the inning string (e.g., 'India A Women Inning 2')
              if (teamName && teamName.includes(",")) {
                // If the inning string is a comma-separated list, use the first team for the first score, second for the second, etc.
                teamName = teamName.split(",")[0].trim();
              }
              // If the team name contains 'Inning', keep it, else add 'Inning' with the index
              return `${teamName}: ${runs}/${wickets} (${overs} ov)`;
            })
            .join(" | ")
        : "No score info";
    return {
      match: indiaMatch.name,
      score: scoreStr,
      status: indiaMatch.status,
    };
  } catch (error) {
    console.error("Error fetching cricket data:", error);
    return null;
  }
}

// Store thread/message IDs for each match by match ID
let matchThreads = {};

async function updateScoreThreads() {
  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel) return;

  // Fetch all India matches
  const url = `https://api.cricapi.com/v1/currentMatches?apikey=${API_KEY}&offset=0`;
  let indiaMatches = [];
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.data) {
      indiaMatches = data.data.filter(
        (match) =>
          match.name &&
          match.name.toLowerCase().includes("india") &&
          match.matchStarted &&
          !match.matchEnded &&
          // Only include matches from today or later
          new Date(match.date) >=
            new Date(new Date().toISOString().slice(0, 10))
      );
    }
  } catch (error) {
    console.error("Error fetching cricket data:", error);
    return;
  }

  for (const match of indiaMatches) {
    const matchId = match.id;
    // If match is finished, skip updating and optionally remove from matchThreads
    if (match.matchEnded) {
      if (matchThreads[matchId]) {
        // Optionally, you could delete the thread or archive it here
        delete matchThreads[matchId];
      }
      continue;
    }
    const scoreStr =
      match.score && match.score.length > 0
        ? match.score
            .map((s) => {
              const runs = s.r !== undefined ? s.r : s.runs;
              const wickets = s.w !== undefined ? s.w : s.wickets;
              const overs = s.o !== undefined ? s.o : s.overs;
              let teamName = s.inning;
              if (teamName && teamName.includes(",")) {
                teamName = teamName.split(",")[0].trim();
              }
              return `${teamName}: ${runs}/${wickets} (${overs} ov)`;
            })
            .join(" | ")
        : "No score info";
    const msgContent = `Live Match: ${match.name}\n${scoreStr}\nStatus: ${match.status}`;

    // If thread/message for this match doesn't exist, create it
    if (!matchThreads[matchId]) {
      const msg = await channel.send(msgContent);
      // Truncate thread name to 100 characters max
      let threadName = `${match.name} Live Updates`;
      if (threadName.length > 100) {
        threadName = threadName.slice(0, 97) + "...";
      }
      const thread = await msg.startThread({
        name: threadName,
        autoArchiveDuration: 60,
      });
      matchThreads[matchId] = { threadId: thread.id, messageId: msg.id };
    } else {
      // Edit the original message in the parent channel only
      const { messageId } = matchThreads[matchId];
      if (messageId) {
        const msg = await channel.messages.fetch(messageId);
        if (msg) {
          await msg.edit(msgContent);
        }
      }
    }
  }
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  // Update every 60 seconds
  setInterval(updateScoreThreads, 60000);
  updateScoreThreads(); // Initial run
});

client.login(TOKEN);
