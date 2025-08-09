/**
 * Redis client and utilities for persistent storage
 */
import { createClient } from 'redis';
import { ErrorLogger, GameError } from './errors.js';

class RedisManager {
    isConnected() {
        return this.client && this.client.isOpen;
    }

    async connect() {
        try {
            this.client = createClient({
                url: process.env.REDIS_URL || 'redis://localhost:6379',
                password: process.env.REDIS_PASSWORD || undefined
            });

            this.client.on('error', (err) => {
                ErrorLogger.log(new GameError(`Redis Client Error: ${err.message}`, 'REDIS_ERROR', { error: err.message }));
            });

            this.client.on('connect', () => {
                console.log('[Redis] Connected to Redis server');
            });

            this.client.on('disconnect', () => {
                console.warn('[Redis] Disconnected from Redis server');
            });

            await this.client.connect();
            return true;
        } catch (error) {
            ErrorLogger.log(new GameError(`Failed to connect to Redis: ${error.message}`, 'REDIS_CONNECTION_ERROR', { error: error.message }));
            return false;
        }
    }

    async disconnect() {
        if (this.client && this.client.isOpen) {
            await this.client.disconnect();
        }
    }

    // Player data operations
    async savePlayerData(playerId, data) {
        try {
            const key = `player:${playerId}`;
            await this.client.hSet(key, {
                data: JSON.stringify(data),
                lastSeen: Date.now().toString(),
                updatedAt: Date.now().toString()
            });
            
            // Set expiration to 30 days
            await this.client.expire(key, 30 * 24 * 60 * 60);
            return true;
        } catch (error) {
            ErrorLogger.log(new GameError(`Failed to save player data: ${error.message}`, 'REDIS_SAVE_ERROR', { playerId, error: error.message }));
            return false;
        }
    }

    async getPlayerData(playerId) {
        try {
            const key = `player:${playerId}`;
            const result = await this.client.hGetAll(key);
            
            if (!result.data) {
                return null;
            }

            const playerData = JSON.parse(result.data);
            playerData.lastSeen = parseInt(result.lastSeen || '0');
            playerData.updatedAt = parseInt(result.updatedAt || '0');
            
            return playerData;
        } catch (error) {
            ErrorLogger.log(new GameError(`Failed to get player data: ${error.message}`, 'REDIS_GET_ERROR', { playerId, error: error.message }));
            return null;
        }
    }

    async playerExists(playerId) {
        try {
            const key = `player:${playerId}`;
            const exists = await this.client.exists(key);
            return exists === 1;
        } catch (error) {
            ErrorLogger.log(new GameError(`Failed to check player existence: ${error.message}`, 'REDIS_EXISTS_ERROR', { playerId, error: error.message }));
            return false;
        }
    }

    // Inventory-specific operations
    async savePlayerInventory(playerId, inventory) {
        if (!this.isConnected()) {
            const error = new GameError('Redis is not connected. Cannot save inventory.', 'REDIS_NOT_CONNECTED');
            ErrorLogger.log(error);
            return false;
        }
        try {
            const key = `player:${playerId}:inventory`;
            await this.client.set(key, JSON.stringify(inventory));
            await this.client.expire(key, 30 * 24 * 60 * 60); // 30 days
            return true;
        } catch (error) {
            ErrorLogger.log(new GameError(`Failed to save inventory: ${error.message}`, 'REDIS_INVENTORY_SAVE_ERROR', { playerId, error: error.message }));
            return false;
        }
    }

    async getPlayerInventory(playerId) {
        if (!this.isConnected()) {
            const error = new GameError('Redis is not connected. Cannot get inventory.', 'REDIS_NOT_CONNECTED');
            ErrorLogger.log(error);
            return null;
        }
        try {
            const key = `player:${playerId}:inventory`;
            const result = await this.client.get(key);
            return result ? JSON.parse(result) : null;
        } catch (error) {
            ErrorLogger.log(new GameError(`Failed to get inventory: ${error.message}`, 'REDIS_INVENTORY_GET_ERROR', { playerId, error: error.message }));
            return null;
        }
    }

    // Lobby operations
    async createLobby(lobbyId, hostPlayerId) {
        try {
            const key = `lobby:${lobbyId}`;
            const lobbyData = {
                id: lobbyId,
                host: hostPlayerId,
                players: [hostPlayerId],
                status: 'waiting',
                createdAt: Date.now(),
                maxPlayers: parseInt(process.env.MAX_PLAYERS_PER_LOBBY) || 4
            };

            await this.client.set(key, JSON.stringify(lobbyData));
            await this.client.expire(key, parseInt(process.env.LOBBY_TIMEOUT) || 300000); // 5 minutes default
            
            // Add to active lobbies list
            await this.client.sAdd('active_lobbies', lobbyId);
            
            return lobbyData;
        } catch (error) {
            ErrorLogger.log(new GameError(`Failed to create lobby: ${error.message}`, 'REDIS_LOBBY_CREATE_ERROR', { lobbyId, error: error.message }));
            return null;
        }
    }

    async getLobby(lobbyId) {
        try {
            const key = `lobby:${lobbyId}`;
            const result = await this.client.get(key);
            return result ? JSON.parse(result) : null;
        } catch (error) {
            ErrorLogger.log(new GameError(`Failed to get lobby: ${error.message}`, 'REDIS_LOBBY_GET_ERROR', { lobbyId, error: error.message }));
            return null;
        }
    }

    async updateLobby(lobbyId, lobbyData) {
        try {
            const key = `lobby:${lobbyId}`;
            await this.client.set(key, JSON.stringify(lobbyData));
            await this.client.expire(key, parseInt(process.env.LOBBY_TIMEOUT) || 300000);
            return true;
        } catch (error) {
            ErrorLogger.log(new GameError(`Failed to update lobby: ${error.message}`, 'REDIS_LOBBY_UPDATE_ERROR', { lobbyId, error: error.message }));
            return false;
        }
    }

    async deleteLobby(lobbyId) {
        try {
            const key = `lobby:${lobbyId}`;
            await this.client.del(key);
            await this.client.sRem('active_lobbies', lobbyId);
            return true;
        } catch (error) {
            ErrorLogger.log(new GameError(`Failed to delete lobby: ${error.message}`, 'REDIS_LOBBY_DELETE_ERROR', { lobbyId, error: error.message }));
            return false;
        }
    }

    async getActiveLobbies() {
        try {
            const lobbyIds = await this.client.sMembers('active_lobbies');
            const lobbies = [];
            
            for (const lobbyId of lobbyIds) {
                const lobby = await this.getLobby(lobbyId);
                if (lobby) {
                    lobbies.push(lobby);
                } else {
                    // Clean up stale lobby reference
                    await this.client.sRem('active_lobbies', lobbyId);
                }
            }
            
            return lobbies;
        } catch (error) {
            ErrorLogger.log(new GameError(`Failed to get active lobbies: ${error.message}`, 'REDIS_LOBBIES_GET_ERROR', { error: error.message }));
            return [];
        }
    }

    // Game session operations
    async saveGameSession(sessionId, gameData) {
        try {
            const key = `session:${sessionId}`;
            await this.client.set(key, JSON.stringify(gameData));
            await this.client.expire(key, parseInt(process.env.GAME_SESSION_TIMEOUT) || 1800000); // 30 minutes default
            return true;
        } catch (error) {
            ErrorLogger.log(new GameError(`Failed to save game session: ${error.message}`, 'REDIS_SESSION_SAVE_ERROR', { sessionId, error: error.message }));
            return false;
        }
    }

    async getGameSession(sessionId) {
        try {
            const key = `session:${sessionId}`;
            const result = await this.client.get(key);
            return result ? JSON.parse(result) : null;
        } catch (error) {
            ErrorLogger.log(new GameError(`Failed to get game session: ${error.message}`, 'REDIS_SESSION_GET_ERROR', { sessionId, error: error.message }));
            return null;
        }
    }
}

// Create singleton instance
const redisManager = new RedisManager();

export default redisManager;