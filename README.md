<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Inter&weight=800&size=36&duration=3000&pause=800&color=06B6D4&center=true&vCenter=true&width=500&lines=Hymn%2B;Advanced+Discord+Selfbot;Dashboard+Powered" alt="Hymn+" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-6DA55F?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/discord.js--selfbot--v13-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord" />
  <img src="https://img.shields.io/badge/express-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/lavalink-v4-FF6B6B?style=for-the-badge" alt="Lavalink" />
  <img src="https://img.shields.io/badge/mobile-responsive-06B6D4?style=for-the-badge" alt="Mobile Responsive" />
  <img src="https://img.shields.io/badge/license-ISC-blue?style=for-the-badge" alt="License" />
</p>

<p align="center">
  A feature-rich Discord selfbot with a full web dashboard, AI chat integration, music player, voice recorder, server cloner, and 35+ commands — supporting multi-account operation.
</p>

---

## ✨ Features

### 🎛️ Web Dashboard
Full-featured control panel accessible via browser — no need to type commands in Discord. **Mobile responsive** across all pages.

| Module | Description |
|--------|-------------|
| **Home** | Live uptime, account info, custom status & emoji editor |
| **Music Player** | Play, skip, seek, queue management, favorites, autoplay — with album art UI |
| **AI Chat** | Configure AI personality, backstory, whitelisted channels/servers/DMs, free-will mode |
| **Rich Presence (RPC)** | Custom activity with images, buttons, timestamps, progress bar, game spoofing |
| **Auto Reaction** | Text-based and user-based auto-reactions with global/server/channel targeting |
| **Mirror System** | Clone messages between channels in real-time (text or webhook mode) |
| **Welcomer** | Canvas welcome cards or text messages with custom backgrounds and templates |
| **Clipboard** | Custom trigger→response shortcuts accessible as commands |
| **Auto Message** | Scheduled interval messages to channels or DMs |
| **Timed Message** | One-time scheduled messages with cron-based precision |
| **Voice Recorder** | Record all VC participants, merge to MP3, playback & download from dashboard |
| **Server Cloner** | Clone roles, channels, categories, emojis between servers with live progress |
| **AFK System** | Auto-reply to pings/DMs with cooldown, mention logging with message links |
| **Quest Solver** | Real-time quest completion terminal — Start All / Stop All with live log streaming and 🟢 Running / ⚫ Idle status badge |
| **Allowed Users** | Whitelist management for who can trigger bot commands |

### 🎵 Music System (Lavalink v4)
- YouTube / URL search & playback
- Per-account isolated queue — multiple accounts won't interfere with each other
- Queue management with loop modes (track / queue / none)
- Autoplay — automatically fills queue with related songs (deduplicates by URI + title)
- Favorites / playlist system with save & load
- Volume control, seek, filters
- Auto-reconnect on Lavalink disconnect
- Graceful offline guard — dashboard returns clear error if Lavalink is not configured

### 🤖 AI Chat System (NVIDIA API)
- Powered by Moonshot Kimi K2 (thinking & instruct models)
- Per-user chat history (last 10 messages)
- Configurable personality, backstory, rules, and banned words
- Free-will mode — AI spontaneously chats in designated channels with configurable delay
- DM, group chat, and server support with mention/always-reply modes
- Blocked user list

### 🛠️ Utility Commands
- **Calculator** — auto-detect & solve math in messages
- **Currency** — fiat exchange rates (e.g. `10 usd to idr`)
- **QR Code** — generate & decode QR codes
- **IP Lookup** — geolocation info for IP addresses
- **Instagram/YouTube** — auto-fix embed links
- **Purge** — bulk delete own messages
- **TTS** — text-to-speech in voice channels
- **Mimic** — copy another user's messages in real-time

---

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) **v18+**
- [FFmpeg](https://ffmpeg.org/) (for voice recording — `ffmpeg-static` included as fallback)
- [Lavalink v4](https://github.com/lavalink-devs/Lavalink) server (for music — optional)
- [NVIDIA API Key](https://build.nvidia.com/) (for AI chat — optional)

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/hymndavinci/rpc-v2.git
cd rpc-v2
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Discord Tokens (supports multi-account)
TOKEN_1=your_discord_token_here
TOKEN_2=optional_second_account
TOKEN_3=optional_third_account

# Prefix per account (fallback: !)
PREFIX_1=!
PREFIX_2=.
PREFIX_3=,

# Dashboard
PORT=3000
APP_USER=your_username
APP_PASS=your_secure_password

# Lavalink v4 (optional — for music)
LAVALINK_WS=wss://your-lavalink-server/v4/websocket
LAVALINK_REST=https://your-lavalink-server/v4
LAVALINK_PASSWORD=your_password
CLIENT_NAME=HymnPlus

# AI (optional — NVIDIA API)
AI_API=nvapi-xxxxxxxxxxxx

# Logging (optional — Discord webhook)
WEBHOOK=https://discord.com/api/webhooks/...

# HuggingFace (optional)
HF_TOKEN=hf_xxxxxxxxxxxx
```

### 3. Add Your User ID

Before starting, add your Discord user ID to `data/allowed.json`:

```json
{
    "allowedUsers": ["YOUR_DISCORD_USER_ID"]
}
```

> ⚠️ **Important:** Without this, you won't be able to use any commands — the bot enforces an allowlist.

### 4. Start

```bash
npm start
```

The dashboard will be available at `http://localhost:3000` (or your configured `PORT`).

---

## 📁 Project Structure

```
rpc-v2/
├── index.js                 # Entry point — multi-account client manager
├── logger.js                # Console → Discord webhook forwarder
├── package.json
├── .env.example
│
├── commands/                # All command modules (38 files)
│   ├── aiManager.js         # AI chat system with NVIDIA API
│   ├── allowedManager.js    # User whitelist management
│   ├── autoMsg.js           # Interval-based auto messaging
│   ├── clipboardManager.js  # Custom trigger→response shortcuts
│   ├── currency.js          # Fiat currency converter
│   ├── calculator.js        # Auto math solver
│   ├── fav.js               # Music favorites/playlists
│   ├── help.js              # Dynamic help menu
│   ├── mimicManager.js      # User message mimic system
│   ├── mirrorManager.js     # Cross-channel message mirroring
│   ├── play.js              # Music play command + search
│   ├── purge.js             # Bulk self-message deletion
│   ├── qrManager.js         # QR code encode/decode
│   ├── reactionManager.js   # Auto-reaction triggers
│   ├── rec.js               # Voice channel recorder
│   ├── rpcManager.js        # Rich Presence / game spoofing
│   ├── statusManager.js     # Custom status management
│   ├── timedMsg.js          # Cron-scheduled messages
│   ├── tts.js               # Text-to-speech engine
│   ├── waifuManager.js      # Anime image commands (SFW/NSFW)
│   ├── welcomerManager.js   # Welcome card/text system
│   └── ...                  # skip, stop, seek, volume, etc.
│
├── music/
│   ├── lavalink.js          # Lavalink v4 WebSocket client (per-account)
│   └── queue.js             # Per-client, per-guild isolated queue manager
│
├── dashboard/
│   ├── index.js             # Express server + API routes
│   ├── views/               # EJS templates (18 pages, all mobile responsive)
│   │   ├── index.ejs        # Home — status & uptime
│   │   ├── music.ejs        # Full music player UI
│   │   ├── quest.ejs        # Quest terminal with live log
│   │   ├── cmd_ai.ejs       # AI configuration panel
│   │   ├── cmd_rpc.ejs      # Rich Presence editor
│   │   ├── cmd_recorder.ejs # Voice recorder controls
│   │   ├── server-cloner.ejs # Server clone wizard
│   │   └── ...
│   └── public/              # Static assets (CSS, images)
│
├── cloner/
│   └── ServerCloner.js      # Server role/channel/emoji cloner
│
├── quests/
│   ├── manager.js           # Quest orchestrator (bridge)
│   ├── questManager.js      # Quest resolver logic (PLAY_ON_DESKTOP, WATCH_VIDEO)
│   ├── client.js            # Discord API client for quests
│   └── constants.js         # Client properties & user agent
│
└── data/                    # Runtime JSON storage
    ├── allowed.json         # Allowed user IDs
    ├── ai_config.json       # AI personality & channel config
    ├── chat_history.json    # AI conversation history
    ├── rpc.json             # Rich Presence settings
    ├── playlists.json       # Saved music favorites
    ├── activity_log.json    # Command usage log
    └── ...
```

---

## 🎮 Command Reference

All commands use the configured prefix (default: `!`). Each account can have its own prefix.

### Music
| Command | Description |
|---------|-------------|
| `play <query\|url>` | Play a song or add to queue |
| `stop` | Stop playback and clear queue |
| `skip` | Skip to next song |
| `queue` | Show current queue |
| `join` | Join your voice channel |
| `left` | Leave voice channel |
| `volume <0-500>` | Set playback volume |
| `seek <seconds>` | Seek forward/backward |
| `loop` | Cycle: none → track → queue |
| `autoplay` | Toggle autoplay mode |
| `fav` | Add current song to favorites |
| `fav list` | Show all favorites |
| `fav load` | Load favorites into queue |
| `tts <text>` | Speak text in VC (Google TTS) |

### Utility
| Command | Description |
|---------|-------------|
| `help [category]` | Show commands or category details |
| `ping` | Check bot latency |
| `purge <count>` | Delete your last N messages |
| `dm <userId> <msg>` | Send a direct message |
| `say <text>` | Send text as the bot |
| `rec` | Start recording voice channel |
| `rec stop` | Stop recording and save MP3 |
| `mimic <userId>` | Mirror a user's messages |

### No-Prefix (Auto-detect)
| Trigger | Description |
|---------|-------------|
| Math expressions | Auto-calculate (e.g. `5+5*2`) |
| `10 usd to idr` | Currency conversion |
| `ip 1.1.1.1` | IP geolocation lookup |
| `qr <text>` | Generate QR code |
| Instagram links | Auto-fix embed |
| YouTube links | Auto-fix embed |

### Fun
| Command | Description |
|---------|-------------|
| `waifu` | Random waifu image |
| `neko` | Random neko image |
| `hug` / `kiss` / `pat` / `slap` | Interaction GIFs |

---

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TOKEN_1` | ✅ | Discord user token (primary account) |
| `TOKEN_2`, `TOKEN_3` | ❌ | Additional account tokens |
| `PREFIX_1`, `PREFIX_2`, `PREFIX_3` | ❌ | Per-account command prefix (default: `!`) |
| `PORT` | ❌ | Dashboard port (default: `3000`) |
| `APP_USER` | ✅ | Dashboard login username |
| `APP_PASS` | ✅ | Dashboard login password |
| `LAVALINK_WS` | ❌ | Lavalink WebSocket URL |
| `LAVALINK_REST` | ❌ | Lavalink REST API URL |
| `LAVALINK_PASSWORD` | ❌ | Lavalink server password |
| `CLIENT_NAME` | ❌ | Lavalink client identifier |
| `AI_API` | ❌ | NVIDIA API key for AI chat |
| `WEBHOOK` | ❌ | Discord webhook for console logging |
| `HF_TOKEN` | ❌ | HuggingFace API token |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────┐
│                    index.js (Entry)                   │
│         Multi-account token loader & manager          │
├──────────┬──────────┬──────────┬─────────────────────┤
│ Client 1 │ Client 2 │ Client 3 │  Per-Client         │
│ PREFIX=! │ PREFIX=. │ PREFIX=, │  Resources          │
├──────────┴──────────┴──────────┤                     │
│        messageCreate           │  ┌───────────────┐  │
│  ┌─────────────────────────┐   │  │  Lavalink v4  │  │
│  │  Allowed User Check     │   │  │  (per-client) │  │
│  │  No-Prefix Handlers     │   │  ├───────────────┤  │
│  │  Command Router         │   │  │ Queue Manager │  │
│  │  Cooldown Check         │   │  │ (per-client)  │  │
│  │  Activity Logger        │   │  ├───────────────┤  │
│  └─────────────────────────┘   │  │ AFK Cooldowns │  │
│                                │  └───────────────┘  │
├────────────────────────────────┴─────────────────────┤
│              Express Dashboard (:3000)                │
│  ┌────────┬────────┬────────┬────────┬────────────┐  │
│  │  Home  │ Music  │   AI   │  RPC   │  Recorder  │  │
│  ├────────┼────────┼────────┼────────┼────────────┤  │
│  │ Mirror │Welcome │AutoMsg │TimedMsg│  Cloner    │  │
│  ├────────┼────────┴────────┴────────┴────────────┤  │
│  │ Quest  │         Mobile Responsive              │  │
│  └────────┴────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────┤
│                   data/ (JSON Storage)                │
└──────────────────────────────────────────────────────┘
```

---

## ⚠️ Disclaimer

> This project is a **selfbot** — it automates a user account, which violates [Discord's Terms of Service](https://discord.com/terms). Use at your own risk. The developers are not responsible for any account termination or other consequences.

---

## 📄 License

This project is licensed under the [ISC License](https://opensource.org/licenses/ISC).