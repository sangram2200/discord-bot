# Discord Cricket Bot

## Overview
A Discord bot built with Node.js and discord.js that tracks live cricket scores for Indian matches. It creates threads in a specified Discord channel and updates scores periodically (every 60 seconds) using the CricAPI.

## Project Architecture
- **Language**: Node.js 20
- **Framework**: discord.js v14
- **API**: CricAPI (https://api.cricapi.com)
- **Entry Point**: `index.js`
- **No frontend** - this is a backend-only Discord bot

## Required Environment Variables
- `DISCORD_TOKEN` - Discord bot token
- `CHANNEL_ID` - Discord channel ID for posting score updates
- `CRICKET_API_KEY` - API key from CricAPI

## How It Works
1. Bot logs into Discord using the provided token
2. Every 60 seconds, it fetches current Indian cricket matches from CricAPI
3. For each active match, it creates a thread in the configured channel
4. It updates the original message with the latest score

## Running
```bash
node index.js
```

## Dependencies
- discord.js - Discord API wrapper
- dotenv - Environment variable loading
- node-fetch@2 - HTTP client for API calls
