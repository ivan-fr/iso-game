/**
 * Tests for Player model
 */
import { jest } from '@jest/globals';

// Import the Player model
import { Player } from '../../models/Player.js';

// Import and mock the Redis manager after importing Player
import redisManager from '../../utils/redis.js';

// Mock all the RedisManager methods
const originalSavePlayerData = redisManager.savePlayerData;
const originalGetPlayerData = redisManager.getPlayerData;

beforeAll(() => {
    // Mock the Redis manager methods
    redisManager.savePlayerData = jest.fn();
    redisManager.getPlayerData = jest.fn();
    redisManager.isConnected = true;
});

afterAll(() => {
    // Restore original methods
    redisManager.savePlayerData = originalSavePlayerData;
    redisManager.getPlayerData = originalGetPlayerData;
});

describe('Player Model', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        redisManager.savePlayerData.mockResolvedValue(true);
        redisManager.getPlayerData.mockResolvedValue(null);
    });

    describe('Player Creation', () => {
        test('should create a new player with default values', () => {
            const player = new Player();
            
            expect(player.id).toBeDefined();
            expect(player.name).toMatch(/^Player_/);
            expect(player.position).toEqual({ x: 2, y: 2 });
            expect(player.stats.hp).toBe(100);
            expect(player.stats.maxHp).toBe(100);
            expect(player.isReady).toBe(false);
            expect(player.isHost).toBe(false);
        });

        test('should create a player with custom data', () => {
            const customData = {
                id: 'test-player-123',
                name: 'TestPlayer',
                position: { x: 5, y: 10 },
                stats: { hp: 80, maxHp: 100, mp: 4, maxMp: 6, ap: 1, maxAp: 2, baseDamage: 15 }
            };

            const player = new Player(customData);
            
            expect(player.id).toBe('test-player-123');
            expect(player.name).toBe('TestPlayer');
            expect(player.position).toEqual({ x: 5, y: 10 });
            expect(player.stats.hp).toBe(80);
            expect(player.stats.baseDamage).toBe(15);
        });

        test('should validate player data correctly', () => {
            const validPlayer = new Player({
                id: 'valid-id',
                name: 'ValidName',
                position: { x: 0, y: 0 },
                stats: { hp: 100, maxHp: 100 }
            });

            const validation = validPlayer.validate();
            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        test('should detect invalid player data', () => {
            const invalidPlayer = new Player({
                id: '',
                name: '',
                position: { x: 'invalid', y: null },
                stats: { hp: 'not a number' }
            });

            const validation = invalidPlayer.validate();
            expect(validation.isValid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
        });
    });

    describe('Player State Management', () => {
        let player;

        beforeEach(() => {
            player = new Player({ id: 'test-player', name: 'TestPlayer' });
        });

        test('should connect player with socket ID', () => {
            const socketId = 'socket-123';
            player.connect(socketId);

            expect(player.socketId).toBe(socketId);
            expect(player.connectedAt).toBeDefined();
            expect(player.isOnline()).toBe(true);
        });

        test('should disconnect player properly', () => {
            player.connect('socket-123');
            expect(player.isOnline()).toBe(true);

            player.disconnect();
            expect(player.socketId).toBeNull();
            expect(player.connectedAt).toBeNull();
            expect(player.isOnline()).toBe(false);
        });

        test('should update player position', () => {
            player.updatePosition(10, 15);
            expect(player.position.x).toBe(10);
            expect(player.position.y).toBe(15);
        });

        test('should handle lobby operations', () => {
            const lobbyId = 'lobby-123';
            
            player.joinLobby(lobbyId, true);
            expect(player.lobbyId).toBe(lobbyId);
            expect(player.isHost).toBe(true);
            expect(player.isInLobby()).toBe(true);

            player.setReady(true);
            expect(player.isReady).toBe(true);

            player.leaveLobby();
            expect(player.lobbyId).toBeNull();
            expect(player.isHost).toBe(false);
            expect(player.isReady).toBe(false);
            expect(player.isInLobby()).toBe(false);
        });

        test('should handle game session operations', () => {
            const sessionId = 'session-123';
            
            player.startGameSession(sessionId);
            expect(player.gameSessionId).toBe(sessionId);
            expect(player.isInGame()).toBe(true);

            player.endGameSession();
            expect(player.gameSessionId).toBeNull();
            expect(player.isInGame()).toBe(false);
        });
    });

    describe('Player Persistence', () => {
        test('should save player data to Redis', async () => {
            redisManager.savePlayerData.mockResolvedValue(true);

            const player = new Player({ id: 'test-player', name: 'TestPlayer' });
            const result = await player.save();
            
            expect(result).toBe(true);
            expect(redisManager.savePlayerData).toHaveBeenCalledWith('test-player', expect.any(Object));
        });

        test('should handle save failures', async () => {
            redisManager.savePlayerData.mockResolvedValue(false);            const player = new Player({ id: 'test-player', name: 'TestPlayer' });
            const result = await player.save();

            expect(result).toBe(false);
        });

        test('should load player from Redis', async () => {
            const playerData = {
                id: 'test-player',
                name: 'LoadedPlayer',
                position: { x: 3, y: 4 },
                stats: { hp: 80, maxHp: 100, mp: 5, maxMp: 6, ap: 1, maxAp: 2, baseDamage: 12 },
                createdAt: Date.now()
            };

            redisManager.getPlayerData.mockResolvedValue(playerData);

            const player = await Player.load('test-player');
            
            expect(player).toBeDefined();
            expect(player.id).toBe('test-player');
            expect(player.name).toBe('LoadedPlayer');
            expect(player.position).toEqual({ x: 3, y: 4 });
        });

        test('should return null for non-existent player', async () => {
            redisManager.getPlayerData.mockResolvedValue(null);

            const player = await Player.load('non-existent-player');
            expect(player).toBeNull();
        });

        test('should create new player with static create method', async () => {
            redisManager.savePlayerData.mockResolvedValue(true);

            const playerData = { name: 'NewPlayer' };
            const player = await Player.create(playerData);

            expect(player).toBeDefined();
            expect(player.name).toBe('NewPlayer');
            expect(player.id).toBeDefined();
            expect(redisManager.savePlayerData).toHaveBeenCalled();
        });
    });

    describe('Player Data Export', () => {
        test('should return public data safely', () => {
            const player = new Player({
                id: 'test-player',
                name: 'TestPlayer',
                position: { x: 5, y: 10 },
                stats: { hp: 80, maxHp: 100, mp: 4, maxMp: 6, ap: 1, maxAp: 2 },
                isReady: true,
                isHost: true
            });

            const publicData = player.getPublicData();

            expect(publicData).toEqual({
                id: 'test-player',
                name: 'TestPlayer',
                avatar: 'default',
                position: { x: 5, y: 10 },
                stats: {
                    hp: 80,
                    maxHp: 100,
                    mp: 4,
                    maxMp: 6,
                    ap: 1,
                    maxAp: 2
                },
                isReady: true,
                isHost: true,
                isOnline: false
            });

            // Should not include sensitive data
            expect(publicData.socketId).toBeUndefined();
            expect(publicData.createdAt).toBeUndefined();
        });

        test('should serialize for JSON storage', () => {
            const player = new Player({
                id: 'test-player',
                name: 'TestPlayer',
                position: { x: 5, y: 10 }
            });

            const json = player.toJSON();

            expect(json.id).toBe('test-player');
            expect(json.name).toBe('TestPlayer');
            expect(json.position).toEqual({ x: 5, y: 10 });
            expect(json.createdAt).toBeDefined();
            expect(json.lastSeen).toBeDefined();
        });
    });
});