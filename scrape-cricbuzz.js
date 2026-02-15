// scrape-cricbuzz.js
// Scrape Cricbuzz for all India matches (men/women), return their title, status, and scores (if any)
// For use as a module by the Discord bot

const axios = require("axios");
const cheerio = require("cheerio");

const CRICBUZZ_URL = "https://www.cricbuzz.com/cricket-match/live-scores";

async function fetchIndiaMatches() {
  try {
    const response = await axios.get(CRICBUZZ_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; DiscordBot/1.0; +https://github.com/your-repo)",
      },
      timeout: 15000,
    });
    const html = response.data;
    const $ = cheerio.load(html);
    const rawMatches = [];
    $('a[title*="India"]').each((i, el) => {
      const matchTitle = $(el).attr("title");
      // Team scores: find all span elements with class containing 'font-medium' or 'font-semibold'
      const teamScores = [];
      $(el)
        .find("span")
        .each((j, s) => {
          const cls = $(s).attr("class") || "";
          if (cls.includes("font-medium") || cls.includes("font-semibold")) {
            teamScores.push($(s).text());
          }
        });
      // Status: try to find a span with cbLive/cbTextLive/cbTextInProgress/cbText, else fallback to last span
      let status = "";
      $(el)
        .find("span")
        .each((j, s) => {
          const cls = $(s).attr("class") || "";
          if (cls.match(/cb(Live|TextLive|TextInProgress|Text)/)) {
            status = $(s).text().trim();
          }
        });
      if (!status) {
        const spans = $(el).find("span");
        if (spans.length > 0) {
          status = $(spans[spans.length - 1])
            .text()
            .trim();
        }
      }
      rawMatches.push({
        matchTitle: matchTitle ? matchTitle.trim() : "",
        teamScores: teamScores.join(" | ").trim(),
        status: status.trim(),
      });
    });

    // Deduplicate and filter
    const matchMap = new Map();
    for (const m of rawMatches) {
      // Remove trailing status from matchTitle for deduplication (e.g., ' - Complete', ' - Preview', etc.)
      const baseTitle = m.matchTitle
        .replace(
          /\s*-\s*(Complete|Preview|Result|INDW?A? won|News|\d{4,})?\s*$/i,
          ""
        )
        .trim();
      // Exclude news, articles, previews, and tour/series/season entries
      if (
        /news|Pre-match|Toss|Live|opt|trump card|report|highlights|photos|videos|blog|commentary|tour|series|season/i.test(
          baseTitle
        )
      )
        continue;
      if (/preview/i.test(m.status) || /preview/i.test(baseTitle)) continue;
      // Prefer entries with scores and a non-empty status
      const prev = matchMap.get(baseTitle);
      if (!prev || (m.teamScores && m.teamScores.length > 0 && m.status)) {
        matchMap.set(baseTitle, m);
      }
    }
    return Array.from(matchMap.values());
  } catch (err) {
    console.error("Error fetching Cricbuzz:", err.message);
    return [];
  }
}

module.exports = { fetchIndiaMatches };
