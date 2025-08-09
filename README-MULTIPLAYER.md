# 🏰 Isometric Game - Multiplayer Setup

This guide will help you set up the multiplayer version of the isometric game with Socket.IO and Redis persistence.

## 🎯 Features

- **Real-time Multiplayer**: Up to 4 players per lobby
- **Persistent Player Data**: UUID-based player identification with Redis storage
- **Synchronized Inventory**: Server-side inventory management with persistence
- **Lobby System**: Pre-game lobby where players can see each other
- **Cross-Platform**: Works on desktop and mobile browsers

## 📋 Prerequisites

- Node.js (v18 or higher)
- Redis server
- Modern web browser with ES6+ support

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install both client and server dependencies
npm run setup
```

### 2. Set Up Redis

#### Option A: Local Redis Installation

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**macOS (with Homebrew):**
```bash
brew install redis
brew services start redis
```

**Windows:**
Download and install from [Redis Windows releases](https://github.com/microsoftarchive/redis/releases)

#### Option B: Docker Redis

```bash
docker run -d --name redis-multiplayer -p 6379:6379 redis:7-alpine
```

#### Option C: Cloud Redis (Redis Cloud, AWS ElastiCache, etc.)

Update the `REDIS_URL` in your server environment variables.

### 3. Configure Environment

Create `server/.env` file:

```bash
# Server Configuration
PORT=3001
NODE_ENV=development

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# Game Configuration  
MAX_PLAYERS_PER_LOBBY=4
LOBBY_TIMEOUT=300000
GAME_SESSION_TIMEOUT=1800000

# Client URL (for CORS)
CLIENT_URL=http://localhost:3000
```

### 4. Start the Development Environment

```bash
# This starts both the server and client simultaneously
npm run dev
```

**Or start individually:**

```bash
# Terminal 1: Start the server
npm run server:dev

# Terminal 2: Start the client (simple HTTP server)
npx http-server . -p 3000 -c-1
```

### 5. Access the Game

- **Multiplayer UI**: http://localhost:3000/multiplayer-ui.html
- **Original Game**: http://localhost:3000/index.html
- **Server Health**: http://localhost:3001/health
- **Server Stats**: http://localhost:3001/stats

## 🎮 How to Play (Multiplayer)

### 1. Connect to Server
- Open the multiplayer UI
- Enter your player name (or keep the auto-generated one)
- The game will assign you a unique UUID for persistent data

### 2. Join or Create a Lobby
- **Create Lobby**: Click "Create Lobby" to host a new game room
- **Join Lobby**: Click "Join" on any available lobby
- **Refresh**: Update the lobby list to see new rooms

### 3. Pre-Game Lobby
- See all players in your lobby
- Host can adjust game settings
- All players must click "Ready" to start
- Host can start the game when everyone is ready

### 4. Multiplayer Game Features
- **Synchronized Movement**: See other players move in real-time
- **Shared Inventory**: Your inventory is persistent across sessions
- **Team Actions**: Coordinate with other players
- **Real-time Combat**: Actions are synchronized across all clients

## 🏗️ Architecture Overview

### Server Components

```
server/
├── server.js              # Main Socket.IO server
├── models/
│   ├── Player.js          # Player data model
│   ├── Lobby.js           # Lobby management
│   └── MultiplayerInventory.js  # Server-side inventory
├── utils/
│   ├── redis.js           # Redis client and operations
│   └── errors.js          # Error handling utilities
└── package.json           # Server dependencies
```

### Client Components

```
client/
├── multiplayer.js         # Socket.IO client wrapper
├── multiplayer-ui.html    # Multiplayer lobby interface
└── multiplayer-inventory.js  # Client-side inventory sync
```

### Data Flow

1. **Player Authentication**: Client sends UUID → Server validates/creates player
2. **Lobby Management**: Real-time lobby updates via Socket.IO
3. **Game Synchronization**: Player actions broadcast to lobby members
4. **Inventory Persistence**: Server validates and persists all inventory changes
5. **Redis Storage**: All player data, lobbies, and game sessions stored in Redis

## 🔧 API Reference

### Socket.IO Events

#### Client → Server

- `player:connect` - Authenticate with UUID
- `lobby:create` - Create new lobby
- `lobby:join` - Join existing lobby
- `lobby:leave` - Leave current lobby
- `lobby:ready` - Set ready status
- `lobby:start_game` - Start game (host only)
- `game:position_update` - Send player position
- `game:action` - Send game action
- `inventory:craft` - Craft item request
- `inventory:equip` - Equip item request

#### Server → Client

- `player:connected` - Authentication result
- `lobby:list` - Available lobbies
- `lobby:joined` - Successfully joined lobby
- `lobby:player_joined` - Another player joined
- `lobby:player_left` - Player left lobby
- `game:starting` - Game is starting
- `game:player_moved` - Player position update
- `inventory:craft_result` - Crafting result

### HTTP API

- `GET /health` - Server health check
- `GET /stats` - Server statistics

## 🔍 Debugging

### Enable Debug Logging

Add to `server/.env`:
```bash
NODE_ENV=development
DEBUG=socket.io*
```

### Check Redis Connection

```bash
# Connect to Redis CLI
redis-cli

# Test connection
127.0.0.1:6379> ping
PONG

# View player data
127.0.0.1:6379> keys player:*
127.0.0.1:6379> hgetall player:your-uuid-here
```

### Monitor Server Logs

```bash
# Server logs will show:
[Server] New connection: socket-id
[Player] Created new player: uuid (name)
[Lobby] Created lobby: lobby-id by player-name
[Inventory] Saved inventory for player uuid
```

## 🚨 Troubleshooting

### Common Issues

**"Cannot connect to Redis"**
- Ensure Redis is running: `redis-cli ping`
- Check Redis URL in environment variables
- Verify Redis port (default: 6379)

**"Authentication failed"**
- Clear browser localStorage and try again
- Check server logs for error details
- Verify server is running on correct port

**"Lobby not found"**
- Lobbies expire after 5 minutes of inactivity
- Refresh the lobby list
- Try creating a new lobby

**"Inventory not syncing"**
- Check network connection
- Verify Redis is storing data: `redis-cli keys inventory:*`
- Force sync by refreshing the page

### Performance Tips

1. **Redis Optimization**: Use Redis with persistence for production
2. **Connection Pooling**: Configure Redis connection pool for high concurrency
3. **Rate Limiting**: Add rate limiting to prevent spam
4. **Error Monitoring**: Set up error tracking (Sentry, etc.)

## 🔒 Security Considerations

### Current Implementation
- Basic input validation
- CORS protection
- Redis data sanitization

### Production Recommendations
- Add authentication/authorization
- Implement rate limiting
- Use HTTPS/WSS in production
- Validate all client inputs server-side
- Add anti-cheat mechanisms
- Monitor for suspicious activity

## 🎯 Next Steps

### Planned Features
- [ ] Spectator mode
- [ ] Private lobbies with passwords
- [ ] Player statistics tracking  
- [ ] Leaderboards
- [ ] Guild system
- [ ] Tournament mode
- [ ] Voice chat integration
- [ ] Mobile app version

### Contributing
1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Submit a pull request

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section
2. Review server logs for errors
3. Test with a fresh Redis database
4. Create an issue with detailed error logs

---

**Happy Gaming! 🎮**