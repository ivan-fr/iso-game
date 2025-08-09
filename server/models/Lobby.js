/**
 * Lobby system for multiplayer game
 */
import { v4 as uuidv4 } from 'uuid';
import { LobbyError, ErrorLogger } from '../utils/errors.js';
import redisManager from '../utils/redis.js';

export class Lobby {
    constructor(data = {}) {
        this.id = data.id || uuidv4();
        this.name = data.name || `Lobby ${this.id.substring(0, 8)}`;
        this.host = data.host || null; // Player ID of the host
        this.players = data.players || []; // Array of player IDs
        this.status = data.status || 'waiting'; // waiting, starting, in_game, finished
        this.maxPlayers = data.maxPlayers || parseInt(process.env.MAX_PLAYERS_PER_LOBBY) || 4;
        this.gameSettings = data.gameSettings || {
            difficulty: 'normal',
            allowSpectators: false,
            privateRoom: false
        };
        this.createdAt = data.createdAt || Date.now();
        this.startedAt = data.startedAt || null;
        this.gameSessionId = data.gameSessionId || null;
    }

    /**
     * Creates a new lobby
     */
    static async create(hostPlayerId, settings = {}) {
        try {
            const lobbyData = {
                host: hostPlayerId,
                players: [hostPlayerId],
                ...settings
            };
            
            const lobby = new Lobby(lobbyData);
            const saved = await lobby.save();
            
            // console.log(`[Lobby] Created lobby ${lobby.id} hosted by ${hostPlayerId}`);
            return lobby;
        } catch (error) {
            ErrorLogger.log(new LobbyError(`Failed to create lobby: ${error.message}`, { hostPlayerId, settings, error: error.message }));
            return null;
        }
    }

    /**
     * Loads a lobby from Redis
     */
    static async load(lobbyId) {
        try {
            const data = await redisManager.getLobby(lobbyId);
            
            if (!data) {
                return null;
            }
            
            const lobby = new Lobby(data);
            // console.log(`[Lobby] Loaded lobby: ${lobby.id}`);
            return lobby;
        } catch (error) {
            ErrorLogger.log(new LobbyError(`Failed to load lobby: ${error.message}`, { lobbyId, error: error.message }));
            return null;
        }
    }

    /**
     * Gets all active lobbies
     */
    static async getActiveLobbies() {
        try {
            const lobbies = await redisManager.getActiveLobbies();
            // console.log(`[Lobby] Found ${lobbies.length} active lobbies`);
            return lobbies.map(lobbyData => new Lobby(lobbyData));
        } catch (error) {
            ErrorLogger.log(new LobbyError(`Failed to get active lobbies: ${error.message}`, { error: error.message }));
            return [];
        }
    }

    /**
     * Saves lobby to Redis
     */
    async save() {
        try {
            const data = this.toJSON();
            const saved = await redisManager.updateLobby(this.id, data);
            
            // if (saved) {
            //     console.log(`[Lobby] Saved lobby: ${this.id}`);
            // }
            
            return saved;
        } catch (error) {
            ErrorLogger.log(new LobbyError(`Failed to save lobby: ${error.message}`, { lobbyId: this.id, error: error.message }));
            return false;
        }
    }

    /**
     * Deletes lobby from Redis
     */
    async delete() {
        try {
            const deleted = await redisManager.deleteLobby(this.id);
            
            // if (deleted) {
            //     console.log(`[Lobby] Deleted lobby: ${this.id}`);
            // }
            
            return deleted;
        } catch (error) {
            ErrorLogger.log(new LobbyError(`Failed to delete lobby: ${error.message}`, { lobbyId: this.id, error: error.message }));
            return false;
        }
    }

    /**
     * Adds a player to the lobby
     */
    addPlayer(playerId) {
        if (this.isFull()) {
            throw new LobbyError('Lobby is full', { lobbyId: this.id, playerId, currentPlayers: this.players.length, maxPlayers: this.maxPlayers });
        }

        if (this.status !== 'waiting') {
            throw new LobbyError('Cannot join lobby - game in progress', { lobbyId: this.id, playerId, status: this.status });
        }

        if (this.players.includes(playerId)) {
            // console.warn(`[Lobby] Player ${playerId} is already in lobby ${this.id}`);
            return false;
        }

        this.players.push(playerId);
        // console.log(`[Lobby] Player ${playerId} joined lobby ${this.id} (${this.players.length}/${this.maxPlayers})`);
        return true;
    }

    /**
     * Removes a player from the lobby
     */
    removePlayer(playerId) {
        const playerIndex = this.players.indexOf(playerId);
        
        if (playerIndex === -1) {
            // console.warn(`[Lobby] Player ${playerId} not found in lobby ${this.id}`);
            return false;
        }

        this.players.splice(playerIndex, 1);
        
        // If the host leaves, assign a new host or delete the lobby
        if (this.host === playerId) {
            if (this.players.length > 0) {
                this.host = this.players[0];
                // console.log(`[Lobby] New host for lobby ${this.id}: ${this.host}`);
            } else {
                // console.log(`[Lobby] Lobby ${this.id} is now empty and will be deleted`);
                return 'delete_lobby';
            }
        }

        // console.log(`[Lobby] Player ${playerId} left lobby ${this.id} (${this.players.length}/${this.maxPlayers})`);
        return true;
    }

    /**
     * Checks if lobby is full
     */
    isFull() {
        return this.players.length >= this.maxPlayers;
    }

    /**
     * Checks if lobby is empty
     */
    isEmpty() {
        return this.players.length === 0;
    }

    /**
     * Checks if all players are ready (for game starting)
     */
    allPlayersReady(playerStatuses) {
        if (this.players.length < 2) {
            return false; // Need at least 2 players
        }

        return this.players.every(playerId => {
            const player = playerStatuses[playerId];
            return player && player.isReady;
        });
    }

    /**
     * Starts the game
     */
    async startGame() {
        if (this.status !== 'waiting') {
            throw new LobbyError('Cannot start game - lobby not in waiting state', { lobbyId: this.id, status: this.status });
        }

        if (this.players.length < 2) {
            throw new LobbyError('Cannot start game - not enough players', { lobbyId: this.id, playerCount: this.players.length });
        }

        this.status = 'starting';
        this.startedAt = Date.now();
        this.gameSessionId = uuidv4();

        await this.save();

        // console.log(`[Lobby] Starting game for lobby ${this.id} with session ${this.gameSessionId}`);
        return this.gameSessionId;
    }

    /**
     * Sets lobby to in-game status
     */
    async setInGame() {
        this.status = 'in_game';
        await this.save();
        // console.log(`[Lobby] Lobby ${this.id} is now in game`);
    }

    /**
     * Finishes the game
     */
    async finishGame() {
        this.status = 'finished';
        await this.save();
        // console.log(`[Lobby] Game finished for lobby ${this.id}`);
    }

    /**
     * Resets lobby to waiting state
     */
    async resetToWaiting() {
        this.status = 'waiting';
        this.startedAt = null;
        this.gameSessionId = null;
        await this.save();
        // console.log(`[Lobby] Reset lobby ${this.id} to waiting state`);
    }

    /**
     * Updates game settings
     */
    updateSettings(newSettings) {
        this.gameSettings = { ...this.gameSettings, ...newSettings };
        // console.log(`[Lobby] Updated settings for lobby ${this.id}:`, newSettings);
    }

    /**
     * Gets public data (safe to send to clients)
     */
    getPublicData() {
        return {
            id: this.id,
            name: this.name,
            host: this.host,
            playerCount: this.players.length,
            maxPlayers: this.maxPlayers,
            status: this.status,
            gameSettings: this.gameSettings,
            createdAt: this.createdAt,
            startedAt: this.startedAt,
            canJoin: this.status === 'waiting' && !this.isFull()
        };
    }

    /**
     * Gets detailed data (includes player list)
     */
    getDetailedData() {
        return {
            ...this.getPublicData(),
            players: this.players,
            gameSessionId: this.gameSessionId
        };
    }

    /**
     * Serializes lobby for storage
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            host: this.host,
            players: this.players,
            status: this.status,
            maxPlayers: this.maxPlayers,
            gameSettings: this.gameSettings,
            createdAt: this.createdAt,
            startedAt: this.startedAt,
            gameSessionId: this.gameSessionId
        };
    }

    /**
     * Validates lobby data
     */
    validate() {
        const errors = [];

        if (!this.id || typeof this.id !== 'string') {
            errors.push('Invalid lobby ID');
        }

        if (!this.name || typeof this.name !== 'string' || this.name.length < 1 || this.name.length > 100) {
            errors.push('Invalid lobby name (must be 1-100 characters)');
        }

        if (!this.host || typeof this.host !== 'string') {
            errors.push('Invalid host player ID');
        }

        if (!Array.isArray(this.players) || this.players.length === 0) {
            errors.push('Invalid players array');
        }

        if (!this.players.includes(this.host)) {
            errors.push('Host must be in players list');
        }

        if (this.players.length > this.maxPlayers) {
            errors.push(`Too many players (${this.players.length}/${this.maxPlayers})`);
        }

        const validStatuses = ['waiting', 'starting', 'in_game', 'finished'];
        if (!validStatuses.includes(this.status)) {
            errors.push('Invalid lobby status');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}