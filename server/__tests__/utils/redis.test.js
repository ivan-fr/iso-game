/**
 * Tests for Redis utilities
 */
import { jest } from '@jest/globals';

// Mock Redis client
const mockRedisClient = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    hSet: jest.fn(),
    hGetAll: jest.fn(),
    exists: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    expire: jest.fn(),
    sAdd: jest.fn(),
    sRem: jest.fn(),
    sMembers: jest.fn(),
    on: jest.fn()
};

// Mock the createClient function
jest.unstable_mockModule('redis', () => ({
    createClient: jest.fn(() => mockRedisClient)
}));

// Mock the ErrorLogger to prevent console output during tests
jest.unstable_mockModule('../../utils/errors.js', () => ({
    ErrorLogger: {
        log: jest.fn()
    },
    GameError: jest.fn()
}));

// Import after mocking
const { default: redisManager } = await import('../../utils/redis.js');

describe('Redis Manager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset redisManager state
        redisManager.client = null;
    });

    describe('Connection Management', () => {
        test('should connect to Redis successfully', async () => {
            mockRedisClient.connect.mockResolvedValue(true);
            mockRedisClient.isOpen = true;

            const result = await redisManager.connect();

            expect(result).toBe(true);
            expect(redisManager.isConnected()).toBe(true);
            expect(redisManager.client).toBe(mockRedisClient);
        });

        test('should handle connection failures', async () => {
            const error = new Error('Connection failed');
            mockRedisClient.connect.mockRejectedValue(error);
            mockRedisClient.isOpen = false;

            const result = await redisManager.connect();

            expect(result).toBe(false);
            expect(redisManager.isConnected()).toBe(false);
        });

        test('should disconnect from Redis', async () => {
            redisManager.client = mockRedisClient;
            mockRedisClient.isOpen = true;

            await redisManager.disconnect();

            expect(mockRedisClient.disconnect).toHaveBeenCalled();
        });
    });

    describe('Player Data Operations', () => {
        beforeEach(() => {
            redisManager.client = mockRedisClient;
            mockRedisClient.isOpen = true;
        });

        test('should save player data successfully', async () => {
            mockRedisClient.hSet.mockResolvedValue(true);
            mockRedisClient.expire.mockResolvedValue(true);

            const playerData = {
                id: 'player-1',
                name: 'TestPlayer',
                position: { x: 5, y: 10 }
            };

            const result = await redisManager.savePlayerData('player-1', playerData);

            expect(result).toBe(true);
            expect(mockRedisClient.hSet).toHaveBeenCalledWith(
                'player:player-1',
                expect.objectContaining({
                    data: JSON.stringify(playerData),
                    lastSeen: expect.any(String),
                    updatedAt: expect.any(String)
                })
            );
            expect(mockRedisClient.expire).toHaveBeenCalledWith('player:player-1', 30 * 24 * 60 * 60);
        });

        test('should handle save failures', async () => {
            const error = new Error('Redis save failed');
            mockRedisClient.hSet.mockRejectedValue(error);

            const result = await redisManager.savePlayerData('player-1', {});

            expect(result).toBe(false);
        });

        test('should get player data successfully', async () => {
            const playerData = {
                id: 'player-1',
                name: 'TestPlayer'
            };

            mockRedisClient.hGetAll.mockResolvedValue({
                data: JSON.stringify(playerData),
                lastSeen: '1234567890',
                updatedAt: '1234567890'
            });

            const result = await redisManager.getPlayerData('player-1');

            expect(result).toEqual({
                ...playerData,
                lastSeen: 1234567890,
                updatedAt: 1234567890
            });
            expect(mockRedisClient.hGetAll).toHaveBeenCalledWith('player:player-1');
        });

        test('should return null for non-existent player', async () => {
            mockRedisClient.hGetAll.mockResolvedValue({});

            const result = await redisManager.getPlayerData('non-existent');

            expect(result).toBeNull();
        });

        test('should check if player exists', async () => {
            mockRedisClient.exists.mockResolvedValue(1);

            const result = await redisManager.playerExists('player-1');

            expect(result).toBe(true);
            expect(mockRedisClient.exists).toHaveBeenCalledWith('player:player-1');
        });

        test('should return false for non-existent player check', async () => {
            mockRedisClient.exists.mockResolvedValue(0);

            const result = await redisManager.playerExists('non-existent');

            expect(result).toBe(false);
        });
    });

    describe('Inventory Operations', () => {
        beforeEach(() => {
            redisManager.client = mockRedisClient;
            mockRedisClient.isOpen = true;
        });

        test('should save player inventory', async () => {
            mockRedisClient.set.mockResolvedValue('OK');
            mockRedisClient.expire.mockResolvedValue(true);

            const inventory = {
                resources: { laine_sheep: 10 },
                items: { coiffe_sheep: 1 },
                equipment: { head: null }
            };

            const result = await redisManager.savePlayerInventory('player-1', inventory);

            expect(result).toBe(true);
            expect(mockRedisClient.set).toHaveBeenCalledWith(
                'player:player-1:inventory',
                JSON.stringify(inventory)
            );
            expect(mockRedisClient.expire).toHaveBeenCalledWith('player:player-1:inventory', 30 * 24 * 60 * 60);
        });

        test('should get player inventory', async () => {
            const inventory = {
                resources: { laine_sheep: 10 },
                items: { coiffe_sheep: 1 }
            };

            mockRedisClient.get.mockResolvedValue(JSON.stringify(inventory));

            const result = await redisManager.getPlayerInventory('player-1');

            expect(result).toEqual(inventory);
            expect(mockRedisClient.get).toHaveBeenCalledWith('player:player-1:inventory');
        });

        test('should return null for non-existent inventory', async () => {
            mockRedisClient.get.mockResolvedValue(null);

            const result = await redisManager.getPlayerInventory('player-1');

            expect(result).toBeNull();
        });
    });

    describe('Lobby Operations', () => {
        beforeEach(() => {
            redisManager.client = mockRedisClient;
            mockRedisClient.isOpen = true;
        });

        test('should create lobby successfully', async () => {
            mockRedisClient.set.mockResolvedValue('OK');
            mockRedisClient.expire.mockResolvedValue(true);
            mockRedisClient.sAdd.mockResolvedValue(1);

            const result = await redisManager.createLobby('lobby-1', 'player-1');

            expect(result).toEqual(expect.objectContaining({
                id: 'lobby-1',
                host: 'player-1',
                players: ['player-1'],
                status: 'waiting',
                maxPlayers: 4
            }));

            expect(mockRedisClient.set).toHaveBeenCalledWith('lobby:lobby-1', expect.any(String));
            expect(mockRedisClient.sAdd).toHaveBeenCalledWith('active_lobbies', 'lobby-1');
        });

        test('should get lobby successfully', async () => {
            const lobbyData = {
                id: 'lobby-1',
                host: 'player-1',
                players: ['player-1'],
                status: 'waiting'
            };

            mockRedisClient.get.mockResolvedValue(JSON.stringify(lobbyData));

            const result = await redisManager.getLobby('lobby-1');

            expect(result).toEqual(lobbyData);
            expect(mockRedisClient.get).toHaveBeenCalledWith('lobby:lobby-1');
        });

        test('should update lobby successfully', async () => {
            mockRedisClient.set.mockResolvedValue('OK');
            mockRedisClient.expire.mockResolvedValue(true);

            const lobbyData = {
                id: 'lobby-1',
                players: ['player-1', 'player-2']
            };

            const result = await redisManager.updateLobby('lobby-1', lobbyData);

            expect(result).toBe(true);
            expect(mockRedisClient.set).toHaveBeenCalledWith('lobby:lobby-1', JSON.stringify(lobbyData));
        });

        test('should delete lobby successfully', async () => {
            mockRedisClient.del.mockResolvedValue(1);
            mockRedisClient.sRem.mockResolvedValue(1);

            const result = await redisManager.deleteLobby('lobby-1');

            expect(result).toBe(true);
            expect(mockRedisClient.del).toHaveBeenCalledWith('lobby:lobby-1');
            expect(mockRedisClient.sRem).toHaveBeenCalledWith('active_lobbies', 'lobby-1');
        });

        test('should get active lobbies', async () => {
            const lobby1 = {
                id: 'lobby-1',
                host: 'player-1',
                status: 'waiting'
            };

            const lobby2 = {
                id: 'lobby-2',
                host: 'player-2',
                status: 'in_game'
            };

            mockRedisClient.sMembers.mockResolvedValue(['lobby-1', 'lobby-2']);
            mockRedisClient.get
                .mockResolvedValueOnce(JSON.stringify(lobby1))
                .mockResolvedValueOnce(JSON.stringify(lobby2));

            const result = await redisManager.getActiveLobbies();

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual(lobby1);
            expect(result[1]).toEqual(lobby2);
        });

        test('should clean up stale lobby references', async () => {
            mockRedisClient.sMembers.mockResolvedValue(['lobby-1', 'lobby-2']);
            mockRedisClient.get
                .mockResolvedValueOnce(JSON.stringify({ id: 'lobby-1' }))
                .mockResolvedValueOnce(null); // Stale reference

            mockRedisClient.sRem.mockResolvedValue(1);

            const result = await redisManager.getActiveLobbies();

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('lobby-1');
            expect(mockRedisClient.sRem).toHaveBeenCalledWith('active_lobbies', 'lobby-2');
        });
    });

    describe('Game Session Operations', () => {
        beforeEach(() => {
            redisManager.client = mockRedisClient;
            mockRedisClient.isOpen = true;
        });

        test('should save game session', async () => {
            mockRedisClient.set.mockResolvedValue('OK');
            mockRedisClient.expire.mockResolvedValue(true);

            const gameData = {
                sessionId: 'session-1',
                players: ['player-1', 'player-2'],
                currentTurn: 'player'
            };

            const result = await redisManager.saveGameSession('session-1', gameData);

            expect(result).toBe(true);
            expect(mockRedisClient.set).toHaveBeenCalledWith(
                'session:session-1',
                JSON.stringify(gameData)
            );
        });

        test('should get game session', async () => {
            const gameData = {
                sessionId: 'session-1',
                players: ['player-1', 'player-2']
            };

            mockRedisClient.get.mockResolvedValue(JSON.stringify(gameData));

            const result = await redisManager.getGameSession('session-1');

            expect(result).toEqual(gameData);
            expect(mockRedisClient.get).toHaveBeenCalledWith('session:session-1');
        });

        test('should return null for non-existent session', async () => {
            mockRedisClient.get.mockResolvedValue(null);

            const result = await redisManager.getGameSession('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            redisManager.client = mockRedisClient;
            mockRedisClient.isOpen = true;
        });

        test('should handle Redis operation errors gracefully', async () => {
            const error = new Error('Redis operation failed');
            mockRedisClient.hSet.mockRejectedValue(error);

            const result = await redisManager.savePlayerData('player-1', {});

            expect(result).toBe(false);
            // Should not throw, should handle gracefully
        });

        test('should handle JSON parsing errors', async () => {
            mockRedisClient.get.mockResolvedValue('invalid json');

            const result = await redisManager.getPlayerInventory('player-1');

            expect(result).toBeNull();
            // Should not throw, should handle gracefully
        });

        test('should handle network disconnection', async () => {
            const error = new Error('Network error');
            mockRedisClient.connect.mockRejectedValue(error);
            mockRedisClient.isOpen = false; // Ensure mock reflects disconnected state
            
            const result = await redisManager.connect();

            expect(result).toBe(false);
            expect(redisManager.isConnected()).toBe(false);
        });
    });
});