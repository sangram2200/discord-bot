// scrape-espn.js
// Scrape ESPNcricinfo for all India & IPL matches (Live + Results)
// For use as a module by the Discord bot

const axios = require("axios");
const cheerio = require("cheerio");

async function fetchIndiaMatches() {
  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Cache-Control": "max-age=0",
    };

    // Use a fresh timestamp to bypass edge caching
    const timestamp = Date.now();
    const liveUrl = `https://www.espncricinfo.com/live-cricket-score?_t=${timestamp}`;
    const resultsUrl = `https://www.espncricinfo.com/live-cricket-match-results?_t=${timestamp}`;

    // Fetch both Live and Results pages concurrently
    const [liveRes, resultsRes] = await Promise.all([
      axios.get(liveUrl, { headers, timeout: 15000 }).catch((err) => {
        console.error("Live fetch error:", err.message);
        return { data: "" };
      }),
      axios.get(resultsUrl, { headers, timeout: 15000 }).catch((err) => {
        console.error("Results fetch error:", err.message);
        return { data: "" };
      }),
    ]);

    // Helper function to extract Next.js data from HTML
    function extractMatches(html) {
      if (!html) return [];
      const $ = cheerio.load(html);
      const nextDataStr = $("#__NEXT_DATA__").text();
      if (!nextDataStr) return [];

      const nextData = JSON.parse(nextDataStr);
      let extracted = [];
      JSON.stringify(nextData, (key, value) => {
        if (key === "matches" && Array.isArray(value)) {
          if (value.length > 0 && value[0].teams) {
            extracted = value;
          }
        }
        return value;
      });
      return extracted;
    }

    // Merge the arrays! Now we have all active AND recently finished games
    const allMatches = [
      ...extractMatches(liveRes.data),
      ...extractMatches(resultsRes.data),
    ];

    const rawMatches = [];

    allMatches.forEach((match) => {
      const iplTeams = [
        "chennai super kings",
        "delhi capitals",
        "gujarat titans",
        "kolkata knight riders",
        "lucknow super giants",
        "mumbai indians",
        "punjab kings",
        "rajasthan royals",
        "royal challengers",
        "sunrisers hyderabad",
      ];

      const hasIndia =
        match.teams &&
        match.teams.some((t) => t.team?.name?.toLowerCase().includes("india"));
      const hasIPLTeam =
        match.teams &&
        match.teams.some((t) => {
          const teamName = t.team?.name?.toLowerCase() || "";
          return iplTeams.some((iplTeam) => teamName.includes(iplTeam));
        });

      const seriesName = (
        match.series?.name ||
        match.series?.longName ||
        match.slug ||
        match.title ||
        ""
      ).toLowerCase();
      const isIPLSeries =
        seriesName.includes("ipl") ||
        seriesName.includes("indian premier league");

      if (hasIndia || hasIPLTeam || isIPLSeries) {
        const team1 = match.teams[0]?.team?.name || "Team 1";
        const team2 = match.teams[1]?.team?.name || "Team 2";
        const matchType = match.title ? ` - ${match.title}` : "";
        const matchTitle = `${team1} vs ${team2}${matchType}`;

        let teamScores = "Scores not available";
        if (match.teams && Array.isArray(match.teams)) {
          const teamScoresArray = match.teams.map((t) => {
            const teamName = t.team?.name || "Unknown Team";
            const score = t.score ? t.score : "Yet to bat";

            // Grab the overs string if it exists and append it
            const overs = t.scoreInfo ? ` (${t.scoreInfo})` : "";

            return `${teamName} ${score}${overs}`;
          });
          teamScores = teamScoresArray.join(" | ");
        }

        const status = match.statusText || match.state || "Status unknown";
        const matchId = match.objectId ? match.objectId.toString() : match.slug;

        rawMatches.push({
          matchId: matchId,
          matchTitle: matchTitle.trim(),
          teamScores: teamScores.trim(),
          status: status.trim(),
        });
      }
    });

    // Deduplicate matches (in case a game is listed on both pages temporarily)
    const matchMap = new Map();
    for (const m of rawMatches) {
      if (!matchMap.has(m.matchId)) {
        matchMap.set(m.matchId, m);
      }
    }

    return Array.from(matchMap.values());
  } catch (err) {
    console.error("Error fetching ESPNcricinfo:", err.message);
    return [];
  }
}

module.exports = { fetchIndiaMatches };

// Local terminal testing block
if (require.main === module) {
  console.log("Fetching live and recent matches...");
  fetchIndiaMatches().then((matches) => {
    if (matches.length === 0) {
      console.log("No live India matches found at the moment.");
    } else {
      console.log(JSON.stringify(matches, null, 2));
    }
  });
}
