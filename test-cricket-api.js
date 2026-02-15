// test-cricket-api.js
// Script to test CricketData.org API calls

const fetch = require("node-fetch");
require("dotenv").config();

const API_KEY = "0df75d57-c7f1-4496-b899-1be4e52a3dc4"; // Replace with your actual API key

async function testCricketApi() {
  const url = `https://api.cricapi.com/v1/currentMatches?apikey=${API_KEY}&offset=0`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!data.data) {
      console.log("No match data found.");
      return;
    }
    // Filter for matches involving India (men or women)
    const indiaMatches = data.data.filter(
      (match) => match.name && match.name.toLowerCase().includes("india")
    );
    if (indiaMatches.length === 0) {
      console.log("No current India matches found.");
      return;
    }
    indiaMatches.forEach((match) => {
      const scoreStr =
        match.score && match.score.length > 0
          ? match.score
              .map((s) => {
                // Use 'r', 'w', 'o' if available, else fallback
                const runs = s.r !== undefined ? s.r : s.runs;
                const wickets = s.w !== undefined ? s.w : s.wickets;
                const overs = s.o !== undefined ? s.o : s.overs;
                return `${s.inning}: ${runs}/${wickets} (${overs} ov)`;
              })
              .join(" | ")
          : "No score info";
      console.log(
        `\nMatch: ${match.name}\nStatus: ${match.status}\nScore: ${scoreStr}\n`
      );
    });
  } catch (error) {
    console.error("Error fetching cricket data:", error);
  }
}

testCricketApi();
