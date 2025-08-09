/**
 * Multiplayer Isometric Game Server
 * Main server file with Socket.IO and Redis integration
 */
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config();

// Import our modules
import redisManager from './utils/redis.js';
import { ErrorLogger, GameError, NetworkError, LobbyError, PlayerError } from './utils/errors.js';
import { Player } from './models/Player.js';
import { MultiplayerInventory } from './models/MultiplayerInventory.js';
import { Lobby } from './models/Lobby.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
    }
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory caches for active connections
const connectedPlayers = new Map(); // socketId -> Player
const playerSockets = new Map(); // playerId -> socketId

/**
 * Helper function to emit to specific player
 */
function emitToPlayer(playerId, event, data) {
    const socketId = playerSockets.get(playerId);
    if (socketId) {
        io.to(socketId).emit(event, data);
        return true;
    }
    return false;
}

/**
 * Helper function to emit to all players in lobby
 */
async function emitToLobby(lobbyId, event, data, excludePlayerId = null) {
    try {
        const lobby = await Lobby.load(lobbyId);
        if (!lobby) return false;

        let emittedCount = 0;
        for (const playerId of lobby.players) {
            if (playerId !== excludePlayerId) {
                const success = emitToPlayer(playerId, event, data);
                if (success) emittedCount++;
            }
        }
        
        console.log(`[Server] Emitted '${event}' to ${emittedCount} players in lobby ${lobbyId}`);
        return emittedCount > 0;
    } catch (error) {
        ErrorLogger.log(new NetworkError(`Failed to emit to lobby: ${error.message}`, { lobbyId, event, error: error.message }));
        return false;
    }
}

/**
 * Socket.IO connection handling
 */
io.on('connection', (socket) => {
    console.log(`[Server] New connection: ${socket.id}`);

    /**
     * Player authentication/connection
     */
    socket.on('player:connect', async (data) => {
        try {
            const { playerId, playerName } = data;
            let player;

            if (playerId) {
                // Try to load existing player
                player = await Player.load(playerId);
                if (player) {
                    console.log(`[Server] Existing player reconnected: ${playerId}`);
                } else {
                    console.log(`[Server] Player ID ${playerId} not found, creating new player`);
                    player = await Player.create({ id: playerId, name: playerName });
                }
            } else {
                // Create new player with UUID
                player = await Player.create({ name: playerName });
            }

            if (!player) {
                throw new PlayerError('Failed to create or load player');
            }

            // Update connection info
            player.connect(socket.id);
            await player.save();

            // Store in memory for quick access
            connectedPlayers.set(socket.id, player);
            playerSockets.set(player.id, socket.id);

            // Load player inventory
            const inventory = await MultiplayerInventory.load(player.id);

            socket.emit('player:connected', {
                success: true,
                player: player.getPublicData(),
                inventory: inventory.getPublicData(),
                uuid: player.id // This is their account connection UUID
            });

            console.log(`[Server] Player connected: ${player.name} (${player.id})`);

        } catch (error) {
            ErrorLogger.log(error);
            socket.emit('player:connected', {
                success: false,
                error: error.message
            });
        }
    });

    /**
     * Lobby management
     */
    socket.on('lobby:list', async () => {
        try {
            const lobbies = await Lobby.getActiveLobbies();
            const publicLobbies = lobbies
                .filter(lobby => !lobby.gameSettings.privateRoom)
                .map(lobby => lobby.getPublicData());

            socket.emit('lobby:list', { success: true, lobbies: publicLobbies });
        } catch (error) {
            ErrorLogger.log(error);
            socket.emit('lobby:list', { success: false, error: error.message });
        }
    });

    socket.on('lobby:create', async (data) => {
        try {
            const player = connectedPlayers.get(socket.id);
            if (!player) {
                throw new PlayerError('Player not connected');
            }

            if (player.isInLobby()) {
                throw new LobbyError('Player already in a lobby');
            }

            const { lobbyName, gameSettings = {} } = data;
            const lobbyData = {
                name: lobbyName || `${player.name}'s Lobby`,
                gameSettings: {
                    difficulty: 'normal',
                    allowSpectators: false,
                    privateRoom: false,
                    ...gameSettings
                }
            };

            const lobby = await Lobby.create(player.id, lobbyData);
            if (!lobby) {
                throw new LobbyError('Failed to create lobby');
            }

            // Update player state
            player.joinLobby(lobby.id, true);
            await player.save();

            socket.join(`lobby:${lobby.id}`);

            socket.emit('lobby:created', {
                success: true,
                lobby: lobby.getDetailedData()
            });

            // Broadcast new lobby to lobby browser
            socket.broadcast.emit('lobby:new', lobby.getPublicData());

            console.log(`[Server] Lobby created: ${lobby.id} by ${player.name}`);

        } catch (error) {
            ErrorLogger.log(error);
            socket.emit('lobby:created', { success: false, error: error.message });
        }
    });

    socket.on('lobby:join', async (data) => {
        try {
            const player = connectedPlayers.get(socket.id);
            if (!player) {
                throw new PlayerError('Player not connected');
            }

            if (player.isInLobby()) {
                throw new LobbyError('Player already in a lobby');
            }

            const { lobbyId } = data;
            const lobby = await Lobby.load(lobbyId);
            
            if (!lobby) {
                throw new LobbyError('Lobby not found');
            }

            lobby.addPlayer(player.id);
            await lobby.save();

            // Update player state
            player.joinLobby(lobby.id, false);
            await player.save();

            socket.join(`lobby:${lobby.id}`);

            // Send lobby data to joining player
            socket.emit('lobby:joined', {
                success: true,
                lobby: lobby.getDetailedData()
            });

            // Notify other players in lobby
            socket.to(`lobby:${lobby.id}`).emit('lobby:player_joined', {
                player: player.getPublicData(),
                lobby: lobby.getDetailedData()
            });

            console.log(`[Server] Player ${player.name} joined lobby ${lobby.id}`);

        } catch (error) {
            ErrorLogger.log(error);
            socket.emit('lobby:joined', { success: false, error: error.message });
        }
    });

    socket.on('lobby:leave', async () => {
        try {
            const player = connectedPlayers.get(socket.id);
            if (!player) {
                throw new PlayerError('Player not connected');
            }

            if (!player.isInLobby()) {
                throw new LobbyError('Player not in a lobby');
            }

            const lobby = await Lobby.load(player.lobbyId);
            if (lobby) {
                const result = lobby.removePlayer(player.id);
                
                if (result === 'delete_lobby') {
                    await lobby.delete();
                    socket.to(`lobby:${lobby.id}`).emit('lobby:deleted', {
                        reason: 'Host left and no other players'
                    });
                    console.log(`[Server] Lobby ${lobby.id} deleted - no players remaining`);
                } else {
                    await lobby.save();
                    socket.to(`lobby:${lobby.id}`).emit('lobby:player_left', {
                        playerId: player.id,
                        lobby: lobby.getDetailedData()
                    });
                }
            }

            socket.leave(`lobby:${player.lobbyId}`);

            // Update player state
            player.leaveLobby();
            await player.save();

            socket.emit('lobby:left', { success: true });

            console.log(`[Server] Player ${player.name} left lobby`);

        } catch (error) {
            ErrorLogger.log(error);
            socket.emit('lobby:left', { success: false, error: error.message });
        }
    });

    socket.on('lobby:ready', async (data) => {
        try {
            const player = connectedPlayers.get(socket.id);
            if (!player) {
                throw new PlayerError('Player not connected');
            }

            if (!player.isInLobby()) {
                throw new LobbyError('Player not in a lobby');
            }

            const { ready } = data;
            player.setReady(ready);
            await player.save();

            // Notify other players in lobby
            socket.to(`lobby:${player.lobbyId}`).emit('lobby:player_ready', {
                playerId: player.id,
                ready: player.isReady
            });

            socket.emit('lobby:ready', { success: true, ready: player.isReady });

            console.log(`[Server] Player ${player.name} is ${ready ? 'ready' : 'not ready'}`);

        } catch (error) {
            ErrorLogger.log(error);
            socket.emit('lobby:ready', { success: false, error: error.message });
        }
    });

    socket.on('lobby:start_game', async () => {
        try {
            const player = connectedPlayers.get(socket.id);
            if (!player) {
                throw new PlayerError('Player not connected');
            }

            if (!player.isInLobby() || !player.isHost) {
                throw new LobbyError('Only lobby host can start game');
            }

            const lobby = await Lobby.load(player.lobbyId);
            if (!lobby) {
                throw new LobbyError('Lobby not found');
            }

            // Check if all players are ready
            const playerStatuses = {};
            for (const playerId of lobby.players) {
                const p = await Player.load(playerId);
                if (p) {
                    playerStatuses[playerId] = p;
                }
            }

            if (!lobby.allPlayersReady(playerStatuses)) {
                throw new LobbyError('Not all players are ready');
            }

            const gameSessionId = await lobby.startGame();

            // Update all players to be in game session
            for (const playerId of lobby.players) {
                const p = playerStatuses[playerId];
                if (p) {
                    p.startGameSession(gameSessionId);
                    await p.save();
                }
            }

            // Notify all players
            io.to(`lobby:${lobby.id}`).emit('game:starting', {
                sessionId: gameSessionId,
                players: lobby.players.map(id => playerStatuses[id]?.getPublicData()).filter(Boolean)
            });

            console.log(`[Server] Game starting for lobby ${lobby.id} with session ${gameSessionId}`);

        } catch (error) {
            ErrorLogger.log(error);
            socket.emit('lobby:start_game', { success: false, error: error.message });
        }
    });

    /**
     * Game synchronization
     */
    socket.on('game:position_update', async (data) => {
        try {
            const player = connectedPlayers.get(socket.id);
            if (!player) return;

            const { x, y } = data;
            player.updatePosition(x, y);

            // Broadcast to other players in the same lobby
            if (player.isInLobby()) {
                socket.to(`lobby:${player.lobbyId}`).emit('game:player_moved', {
                    playerId: player.id,
                    position: { x, y }
                });
            }

        } catch (error) {
            ErrorLogger.log(error);
        }
    });

    socket.on('game:action', async (data) => {
        try {
            const player = connectedPlayers.get(socket.id);
            if (!player) return;

            const { action, target, position } = data;

            // Broadcast action to other players in the same lobby
            if (player.isInLobby()) {
                socket.to(`lobby:${player.lobbyId}`).emit('game:player_action', {
                    playerId: player.id,
                    action,
                    target,
                    position,
                    timestamp: Date.now()
                });
            }

            console.log(`[Server] Player ${player.name} performed action: ${action}`);

        } catch (error) {
            ErrorLogger.log(error);
        }
    });

    /**
     * Inventory synchronization
     */
    socket.on('inventory:sync', async () => {
        try {
            const player = connectedPlayers.get(socket.id);
            if (!player) return;

            const inventory = await MultiplayerInventory.load(player.id);
            
            socket.emit('inventory:data', {
                success: true,
                inventory: inventory.getPublicData()
            });

        } catch (error) {
            ErrorLogger.log(error);
            socket.emit('inventory:data', { success: false, error: error.message });
        }
    });

    socket.on('inventory:craft', async (data) => {
        try {
            const player = connectedPlayers.get(socket.id);
            if (!player) return;

            const { recipeId } = data;
            const inventory = await MultiplayerInventory.load(player.id);
            const result = await inventory.craftItem(recipeId);

            socket.emit('inventory:craft_result', result);

            if (result.success) {
                // Notify other players in lobby about the craft
                if (player.isInLobby()) {
                    socket.to(`lobby:${player.lobbyId}`).emit('game:player_crafted', {
                        playerId: player.id,
                        itemName: result.itemName
                    });
                }
            }

        } catch (error) {
            ErrorLogger.log(error);
            socket.emit('inventory:craft_result', { success: false, error: error.message });
        }
    });

    socket.on('inventory:equip', async (data) => {
        try {
            const player = connectedPlayers.get(socket.id);
            if (!player) return;

            const { itemId } = data;
            const inventory = await MultiplayerInventory.load(player.id);
            const result = await inventory.equipItem(itemId);

            socket.emit('inventory:equip_result', result);

        } catch (error) {
            ErrorLogger.log(error);
            socket.emit('inventory:equip_result', { success: false, error: error.message });
        }
    });

    /**
     * Disconnection handling
     */
    socket.on('disconnect', async () => {
        try {
            const player = connectedPlayers.get(socket.id);
            
            if (player) {
                console.log(`[Server] Player ${player.name} disconnected`);

                // Handle lobby cleanup
                if (player.isInLobby()) {
                    const lobby = await Lobby.load(player.lobbyId);
                    if (lobby) {
                        // Notify other players
                        socket.to(`lobby:${player.lobbyId}`).emit('lobby:player_disconnected', {
                            playerId: player.id,
                            playerName: player.name
                        });
                    }
                }

                // Update player status
                player.disconnect();
                await player.save();

                // Remove from memory
                connectedPlayers.delete(socket.id);
                playerSockets.delete(player.id);
            }

        } catch (error) {
            ErrorLogger.log(error);
        }

        console.log(`[Server] Connection closed: ${socket.id}`);
    });
});

/**
 * HTTP API endpoints
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        connections: connectedPlayers.size,
        uptime: process.uptime()
    });
});

app.get('/stats', async (req, res) => {
    try {
        const lobbies = await Lobby.getActiveLobbies();
        
        res.json({
            connectedPlayers: connectedPlayers.size,
            activeLobbies: lobbies.length,
            totalPlayersInLobbies: lobbies.reduce((sum, lobby) => sum + lobby.players.length, 0),
            redisConnected: redisManager.isConnected
        });
    } catch (error) {
        ErrorLogger.log(error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

/**
 * Start server
 */
async function startServer() {
    try {
        // Connect to Redis
        const redisConnected = await redisManager.connect();
        if (!redisConnected) {
            throw new Error('Failed to connect to Redis');
        }

        // Start HTTP server
        server.listen(PORT, () => {
            console.log(`[Server] Multiplayer game server listening on port ${PORT}`);
            console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`[Server] Redis connected: ${redisManager.isConnected}`);
        });

    } catch (error) {
        ErrorLogger.log(new GameError(`Failed to start server: ${error.message}`, 'SERVER_START_ERROR', { error: error.message }));
        process.exit(1);
    }
}

/**
 * Graceful shutdown
 */
process.on('SIGINT', async () => {
    console.log('\n[Server] Shutting down gracefully...');
    
    // Disconnect all players
    for (const [socketId, player] of connectedPlayers) {
        try {
            player.disconnect();
            await player.save();
        } catch (error) {
            console.error(`Error saving player ${player.id}:`, error.message);
        }
    }
    
    // Disconnect from Redis
    await redisManager.disconnect();
    
    // Close server
    server.close(() => {
        console.log('[Server] Server closed');
        process.exit(0);
    });
});

// Start the server
startServer();