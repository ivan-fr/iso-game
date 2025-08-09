/**
 * Player model for multiplayer game
 */
import { v4 as uuidv4 } from 'uuid';
import { PlayerError, ErrorLogger } from '../utils/errors.js';
import redisManager from '../utils/redis.js';

export class Player {
    constructor(data = {}) {
        this.id = data.id || uuidv4();
        this.socketId = data.socketId || null;
        this.name = data.name || `Player_${this.id.substring(0, 8)}`;
        this.avatar = data.avatar || 'default';
        
        // Game state
        this.position = data.position || { x: 2, y: 2 };
        this.stats = data.stats || {
            hp: 100,
            maxHp: 100,
            mp: 6,
            maxMp: 6,
            ap: 2,
            maxAp: 2,
            baseDamage: 10
        };
        
        // Lobby/Room state
        this.lobbyId = data.lobbyId || null;
        this.gameSessionId = data.gameSessionId || null;
        this.isReady = data.isReady || false;
        this.isHost = data.isHost || false;
        
        // Timestamps
        this.createdAt = data.createdAt || Date.now();
        this.lastSeen = data.lastSeen || Date.now();
        this.connectedAt = data.connectedAt || null;
        
        // Inventory will be managed separately
        this.inventory = null;
    }

    /**
     * Creates a new player and saves to Redis
     */
    static async create(playerData = {}) {
        try {
            const player = new Player(playerData);
            const saved = await player.save();
            
            if (!saved) {
                throw new PlayerError('Failed to save new player to database', { playerId: player.id });
            }
            
            console.log(`[Player] Created new player: ${player.id} (${player.name})`);
            return player;
        } catch (error) {
            ErrorLogger.log(new PlayerError(`Failed to create player: ${error.message}`, { playerData, error: error.message }));
            return null;
        }
    }

    /**
     * Loads an existing player from Redis
     */
    static async load(playerId) {
        try {
            const data = await redisManager.getPlayerData(playerId);
            
            if (!data) {
                return null;
            }
            
            const player = new Player(data);
            console.log(`[Player] Loaded player: ${player.id} (${player.name})`);
            return player;
        } catch (error) {
            ErrorLogger.log(new PlayerError(`Failed to load player: ${error.message}`, { playerId, error: error.message }));
            return null;
        }
    }

    /**
     * Saves player data to Redis
     */
    async save() {
        try {
            this.lastSeen = Date.now();
            const data = this.toJSON();
            const saved = await redisManager.savePlayerData(this.id, data);
            
            if (saved) {
                console.log(`[Player] Saved player data: ${this.id}`);
            }
            
            return saved;
        } catch (error) {
            ErrorLogger.log(new PlayerError(`Failed to save player: ${error.message}`, { playerId: this.id, error: error.message }));
            return false;
        }
    }

    /**
     * Updates player connection info
     */
    connect(socketId) {
        this.socketId = socketId;
        this.connectedAt = Date.now();
        this.lastSeen = Date.now();
        console.log(`[Player] Player ${this.id} connected with socket ${socketId}`);
    }

    /**
     * Handles player disconnection
     */
    disconnect() {
        console.log(`[Player] Player ${this.id} disconnected`);
        this.socketId = null;
        this.connectedAt = null;
        this.lastSeen = Date.now();
    }

    /**
     * Updates player position
     */
    updatePosition(x, y) {
        if (typeof x === 'number' && typeof y === 'number') {
            this.position.x = Math.round(x);
            this.position.y = Math.round(y);
            this.lastSeen = Date.now();
        }
    }

    /**
     * Updates player stats
     */
    updateStats(newStats) {
        this.stats = { ...this.stats, ...newStats };
        this.lastSeen = Date.now();
    }

    /**
     * Joins a lobby
     */
    joinLobby(lobbyId, isHost = false) {
        this.lobbyId = lobbyId;
        this.isHost = isHost;
        this.isReady = false;
        console.log(`[Player] Player ${this.id} joined lobby ${lobbyId} as ${isHost ? 'host' : 'member'}`);
    }

    /**
     * Leaves current lobby
     */
    leaveLobby() {
        const oldLobbyId = this.lobbyId;
        this.lobbyId = null;
        this.isHost = false;
        this.isReady = false;
        
        if (oldLobbyId) {
            console.log(`[Player] Player ${this.id} left lobby ${oldLobbyId}`);
        }
    }

    /**
     * Sets ready status for lobby
     */
    setReady(ready) {
        this.isReady = !!ready;
    }

    /**
     * Starts a game session
     */
    startGameSession(sessionId) {
        this.gameSessionId = sessionId;
        this.isReady = false;
    }

    /**
     * Ends current game session
     */
    endGameSession() {
        this.gameSessionId = null;
    }

    /**
     * Checks if player is online
     */
    isOnline() {
        return this.socketId !== null && this.connectedAt !== null;
    }

    /**
     * Checks if player is in a lobby
     */
    isInLobby() {
        return this.lobbyId !== null;
    }

    /**
     * Checks if player is in a game session
     */
    isInGame() {
        return this.gameSessionId !== null;
    }

    /**
     * Gets player's public data (safe to send to other clients)
     */
    getPublicData() {
        return {
            id: this.id,
            name: this.name,
            avatar: this.avatar,
            position: this.position,
            stats: {
                hp: this.stats.hp,
                maxHp: this.stats.maxHp,
                mp: this.stats.mp,
                maxMp: this.stats.maxMp,
                ap: this.stats.ap,
                maxAp: this.stats.maxAp
            },
            isReady: this.isReady,
            isHost: this.isHost,
            isOnline: this.isOnline()
        };
    }

    /**
     * Serializes player for storage
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            avatar: this.avatar,
            position: this.position,
            stats: this.stats,
            lobbyId: this.lobbyId,
            gameSessionId: this.gameSessionId,
            isReady: this.isReady,
            isHost: this.isHost,
            createdAt: this.createdAt,
            lastSeen: this.lastSeen,
            connectedAt: this.connectedAt
        };
    }

    /**
     * Validates player data
     */
    validate() {
        const errors = [];

        if (!this.id || typeof this.id !== 'string') {
            errors.push('Invalid player ID');
        }

        if (!this.name || typeof this.name !== 'string' || this.name.length < 1 || this.name.length > 50) {
            errors.push('Invalid player name (must be 1-50 characters)');
        }

        if (!this.position || typeof this.position.x !== 'number' || typeof this.position.y !== 'number') {
            errors.push('Invalid player position');
        }

        if (!this.stats || typeof this.stats.hp !== 'number' || typeof this.stats.maxHp !== 'number') {
            errors.push('Invalid player stats');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}