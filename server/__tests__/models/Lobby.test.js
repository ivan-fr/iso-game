/**
 * Tests for Lobby model
 */
import { jest } from '@jest/globals';

// Import the Lobby model
import { Lobby } from '../../models/Lobby.js';

// Import and mock the Redis manager after importing Lobby
import redisManager from '../../utils/redis.js';

// Mock all the RedisManager methods
const originalCreateLobby = redisManager.createLobby;
const originalGetLobby = redisManager.getLobby;
const originalUpdateLobby = redisManager.updateLobby;
const originalDeleteLobby = redisManager.deleteLobby;
const originalGetActiveLobbies = redisManager.getActiveLobbies;

beforeAll(() => {
    // Mock the Redis manager methods
    redisManager.createLobby = jest.fn();
    redisManager.getLobby = jest.fn();
    redisManager.updateLobby = jest.fn();
    redisManager.deleteLobby = jest.fn();
    redisManager.getActiveLobbies = jest.fn();
    redisManager.isConnected = true;
});

afterAll(() => {
    // Restore original methods
    redisManager.createLobby = originalCreateLobby;
    redisManager.getLobby = originalGetLobby;
    redisManager.updateLobby = originalUpdateLobby;
    redisManager.deleteLobby = originalDeleteLobby;
    redisManager.getActiveLobbies = originalGetActiveLobbies;
});

describe('Lobby Model', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        redisManager.updateLobby.mockResolvedValue(true);
        redisManager.deleteLobby.mockResolvedValue(true);
        redisManager.getLobby.mockResolvedValue(null);
        redisManager.getActiveLobbies.mockResolvedValue([]);
    });

    describe('Lobby Creation', () => {
        test('should create a new lobby with default values', () => {
            const lobby = new Lobby();
            
            expect(lobby.id).toBeDefined();
            expect(lobby.name).toMatch(/^Lobby /);
            expect(lobby.host).toBeNull();
            expect(lobby.players).toEqual([]);
            expect(lobby.status).toBe('waiting');
            expect(lobby.maxPlayers).toBe(4);
            expect(lobby.createdAt).toBeDefined();
        });

        test('should create a lobby with custom data', () => {
            const customData = {
                id: 'lobby-123',
                name: 'Test Lobby',
                host: 'player-1',
                players: ['player-1'],
                maxPlayers: 6,
                gameSettings: {
                    difficulty: 'hard',
                    privateRoom: true
                }
            };

            const lobby = new Lobby(customData);
            
            expect(lobby.id).toBe('lobby-123');
            expect(lobby.name).toBe('Test Lobby');
            expect(lobby.host).toBe('player-1');
            expect(lobby.players).toEqual(['player-1']);
            expect(lobby.maxPlayers).toBe(6);
            expect(lobby.gameSettings.difficulty).toBe('hard');
            expect(lobby.gameSettings.privateRoom).toBe(true);
        });

        test('should validate lobby data correctly', () => {
            const validLobby = new Lobby({
                id: 'valid-lobby',
                name: 'Valid Lobby',
                host: 'player-1',
                players: ['player-1'],
                status: 'waiting'
            });

            const validation = validLobby.validate();
            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        test('should detect invalid lobby data', () => {
            const invalidLobby = new Lobby({
                id: '',
                name: '',
                host: 'player-1',
                players: [], // Host not in players array
                status: 'invalid-status'
            });

            const validation = invalidLobby.validate();
            expect(validation.isValid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
        });
    });

    describe('Player Management', () => {
        let lobby;

        beforeEach(() => {
            lobby = new Lobby({
                id: 'test-lobby',
                name: 'Test Lobby',
                host: 'player-1',
                players: ['player-1'],
                maxPlayers: 4
            });
        });

        test('should add player to lobby', () => {
            const result = lobby.addPlayer('player-2');
            
            expect(result).toBe(true);
            expect(lobby.players).toContain('player-2');
            expect(lobby.players).toHaveLength(2);
        });

        test('should not add player if lobby is full', () => {
            // Fill the lobby
            lobby.addPlayer('player-2');
            lobby.addPlayer('player-3');
            lobby.addPlayer('player-4');

            expect(() => {
                lobby.addPlayer('player-5');
            }).toThrow('Lobby is full');
        });

        test('should not add player if game is in progress', () => {
            lobby.status = 'in_game';

            expect(() => {
                lobby.addPlayer('player-2');
            }).toThrow('Cannot join lobby - game in progress');
        });

        test('should not add same player twice', () => {
            lobby.addPlayer('player-2');
            const result = lobby.addPlayer('player-2'); // Try to add same player
            
            expect(result).toBe(false);
            expect(lobby.players.filter(p => p === 'player-2')).toHaveLength(1);
        });

        test('should remove player from lobby', () => {
            lobby.addPlayer('player-2');
            expect(lobby.players).toHaveLength(2);

            const result = lobby.removePlayer('player-2');
            expect(result).toBe(true);
            expect(lobby.players).not.toContain('player-2');
            expect(lobby.players).toHaveLength(1);
        });

        test('should reassign host when host leaves', () => {
            lobby.addPlayer('player-2');
            lobby.addPlayer('player-3');

            const result = lobby.removePlayer('player-1'); // Remove host
            
            expect(result).toBe(true);
            expect(lobby.host).toBe('player-2'); // Should be new host
            expect(lobby.players).toEqual(['player-2', 'player-3']);
        });

        test('should return delete signal when last player leaves', () => {
            const result = lobby.removePlayer('player-1');
            
            expect(result).toBe('delete_lobby');
            expect(lobby.players).toHaveLength(0);
        });

        test('should check if lobby is full or empty', () => {
            expect(lobby.isEmpty()).toBe(false);
            expect(lobby.isFull()).toBe(false);

            // Fill lobby
            lobby.addPlayer('player-2');
            lobby.addPlayer('player-3');
            lobby.addPlayer('player-4');

            expect(lobby.isFull()).toBe(true);

            // Empty lobby
            lobby.players = [];
            expect(lobby.isEmpty()).toBe(true);
        });
    });

    describe('Game Management', () => {
        let lobby;

        beforeEach(() => {
            lobby = new Lobby({
                id: 'test-lobby',
                name: 'Test Lobby',
                host: 'player-1',
                players: ['player-1', 'player-2'],
                status: 'waiting'
            });
        });

        test('should start game successfully', async () => {
            redisManager.updateLobby.mockResolvedValue(true);

            const gameSessionId = await lobby.startGame();
            
            expect(gameSessionId).toBeDefined();
            expect(lobby.status).toBe('starting');
            expect(lobby.startedAt).toBeDefined();
            expect(lobby.gameSessionId).toBe(gameSessionId);
            expect(redisManager.updateLobby).toHaveBeenCalled();
        });

        test('should not start game if not enough players', async () => {
            lobby.players = ['player-1']; // Only one player

            await expect(lobby.startGame()).rejects.toThrow('Cannot start game - not enough players');
        });

        test('should not start game if not in waiting state', async () => {
            lobby.status = 'in_game';

            await expect(lobby.startGame()).rejects.toThrow('Cannot start game - lobby not in waiting state');
        });

        test('should check if all players are ready', () => {
            const playerStatuses = {
                'player-1': { isReady: true },
                'player-2': { isReady: true }
            };

            expect(lobby.allPlayersReady(playerStatuses)).toBe(true);

            playerStatuses['player-2'].isReady = false;
            expect(lobby.allPlayersReady(playerStatuses)).toBe(false);
        });

        test('should transition through game states', async () => {
            redisManager.updateLobby.mockResolvedValue(true);

            // Start game
            await lobby.startGame();
            expect(lobby.status).toBe('starting');

            // Set to in-game
            await lobby.setInGame();
            expect(lobby.status).toBe('in_game');

            // Finish game
            await lobby.finishGame();
            expect(lobby.status).toBe('finished');

            // Reset to waiting
            await lobby.resetToWaiting();
            expect(lobby.status).toBe('waiting');
            expect(lobby.startedAt).toBeNull();
            expect(lobby.gameSessionId).toBeNull();
        });

        test('should update game settings', () => {
            const newSettings = {
                difficulty: 'hard',
                allowSpectators: true
            };

            lobby.updateSettings(newSettings);
            
            expect(lobby.gameSettings.difficulty).toBe('hard');
            expect(lobby.gameSettings.allowSpectators).toBe(true);
            expect(lobby.gameSettings.privateRoom).toBe(false); // Should keep original
        });
    });

    describe('Lobby Persistence', () => {
        test('should save lobby to Redis', async () => {
            redisManager.updateLobby.mockResolvedValue(true);

            const lobby = new Lobby({ id: 'test-lobby', name: 'Test Lobby' });
            const result = await lobby.save();

            expect(result).toBe(true);
            expect(redisManager.updateLobby).toHaveBeenCalledWith('test-lobby', expect.any(Object));
        });

        test('should delete lobby from Redis', async () => {
            redisManager.deleteLobby.mockResolvedValue(true);

            const lobby = new Lobby({ id: 'test-lobby' });
            const result = await lobby.delete();

            expect(result).toBe(true);
            expect(redisManager.deleteLobby).toHaveBeenCalledWith('test-lobby');
        });

        test('should load lobby from Redis', async () => {
            const lobbyData = {
                id: 'test-lobby',
                name: 'Loaded Lobby',
                host: 'player-1',
                players: ['player-1', 'player-2'],
                status: 'waiting',
                createdAt: Date.now()
            };

            redisManager.getLobby.mockResolvedValue(lobbyData);

            const lobby = await Lobby.load('test-lobby');
            
            expect(lobby).toBeDefined();
            expect(lobby.id).toBe('test-lobby');
            expect(lobby.name).toBe('Loaded Lobby');
            expect(lobby.players).toEqual(['player-1', 'player-2']);
        });

        test('should get active lobbies', async () => {
            const lobbiesData = [
                {
                    id: 'lobby-1',
                    name: 'Lobby 1',
                    host: 'player-1',
                    players: ['player-1'],
                    status: 'waiting'
                },
                {
                    id: 'lobby-2',
                    name: 'Lobby 2',
                    host: 'player-2',
                    players: ['player-2', 'player-3'],
                    status: 'in_game'
                }
            ];

            redisManager.getActiveLobbies.mockResolvedValue(lobbiesData);

            const lobbies = await Lobby.getActiveLobbies();
            
            expect(lobbies).toHaveLength(2);
            expect(lobbies[0]).toBeInstanceOf(Lobby);
            expect(lobbies[0].id).toBe('lobby-1');
            expect(lobbies[1].id).toBe('lobby-2');
        });
    });

    describe('Data Export', () => {
        test('should return public data safely', () => {
            const lobby = new Lobby({
                id: 'test-lobby',
                name: 'Test Lobby',
                host: 'player-1',
                players: ['player-1', 'player-2'],
                status: 'waiting',
                maxPlayers: 4,
                gameSettings: { difficulty: 'normal' },
                createdAt: Date.now()
            });

            const publicData = lobby.getPublicData();

            expect(publicData).toEqual({
                id: 'test-lobby',
                name: 'Test Lobby',
                host: 'player-1',
                playerCount: 2,
                maxPlayers: 4,
                status: 'waiting',
                gameSettings: { difficulty: 'normal' },
                createdAt: expect.any(Number),
                startedAt: null,
                canJoin: true
            });

            // Should not include sensitive data
            expect(publicData.players).toBeUndefined();
            expect(publicData.gameSessionId).toBeUndefined();
        });

        test('should return detailed data for lobby members', () => {
            const lobby = new Lobby({
                id: 'test-lobby',
                name: 'Test Lobby',
                host: 'player-1',
                players: ['player-1', 'player-2'],
                gameSessionId: 'session-123'
            });

            const detailedData = lobby.getDetailedData();

            expect(detailedData.players).toEqual(['player-1', 'player-2']);
            expect(detailedData.gameSessionId).toBe('session-123');
        });

        test('should serialize for JSON storage', () => {
            const lobby = new Lobby({
                id: 'test-lobby',
                name: 'Test Lobby',
                host: 'player-1',
                players: ['player-1']
            });

            const json = lobby.toJSON();

            expect(json.id).toBe('test-lobby');
            expect(json.name).toBe('Test Lobby');
            expect(json.host).toBe('player-1');
            expect(json.players).toEqual(['player-1']);
            expect(json.createdAt).toBeDefined();
        });
    });
});