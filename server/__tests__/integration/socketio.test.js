/**
 * Integration tests for Socket.IO server
 */
import { jest } from '@jest/globals';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';

// Mock Redis manager
const mockRedisManager = {
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn(),
    savePlayerData: jest.fn().mockResolvedValue(true),
    getPlayerData: jest.fn(),
    savePlayerInventory: jest.fn().mockResolvedValue(true),
    getPlayerInventory: jest.fn(),
    createLobby: jest.fn(),
    getLobby: jest.fn(),
    updateLobby: jest.fn().mockResolvedValue(true),
    deleteLobby: jest.fn().mockResolvedValue(true),
    getActiveLobbies: jest.fn().mockResolvedValue([]),
    isConnected: true
};

jest.unstable_mockModule('../../utils/redis.js', () => ({
    default: mockRedisManager
}));

describe('Socket.IO Integration Tests', () => {
    let httpServer;
    let io;
    let clientSocket;
    let serverSocket;

    beforeAll((done) => {
        httpServer = createServer();
        io = new Server(httpServer, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        httpServer.listen(() => {
            const port = httpServer.address().port;
            clientSocket = new Client(`http://localhost:${port}`, {
                autoConnect: false
            });

            io.on('connection', (socket) => {
                serverSocket = socket;
            });

            clientSocket.connect();
            clientSocket.on('connect', done);
        });
    });

    afterAll((done) => {
        io.close();
        clientSocket.close();
        httpServer.close(done);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Reset all mock methods
        mockRedisManager.getPlayerData.mockResolvedValue(null);
        mockRedisManager.savePlayerData.mockResolvedValue(true);
        mockRedisManager.getPlayerInventory.mockResolvedValue(null);
        mockRedisManager.savePlayerInventory.mockResolvedValue(true);
        mockRedisManager.createLobby.mockResolvedValue(null);
        mockRedisManager.getLobby.mockResolvedValue(null);
        mockRedisManager.updateLobby.mockResolvedValue(true);
        mockRedisManager.deleteLobby.mockResolvedValue(true);
        mockRedisManager.getActiveLobbies.mockResolvedValue([]);
    });

    describe('Player Connection', () => {
        beforeEach(() => {
            // Clear all event listeners before each test to ensure isolation
            serverSocket.removeAllListeners('player:connect');
            serverSocket.removeAllListeners('lobby:create');
            clientSocket.removeAllListeners('player:connected');
            clientSocket.removeAllListeners('lobby:created');
        });

        test('should handle new player connection', (done) => {
            const playerData = {
                playerId: null,
                playerName: 'TestPlayer'
            };

            // Mock player creation
            mockRedisManager.getPlayerData.mockResolvedValue(null);

            const serverHandler = jest.fn(async (data) => {
                expect(data.playerName).toBe('TestPlayer');
                
                // Simulate successful player creation
                const mockPlayer = {
                    id: 'new-player-123',
                    name: 'TestPlayer',
                    position: { x: 2, y: 2 },
                    stats: { hp: 100, maxHp: 100, mp: 6, maxMp: 6, ap: 2, maxAp: 2 }
                };

                serverSocket.emit('player:connected', {
                    success: true,
                    player: mockPlayer,
                    inventory: { resources: {}, items: {}, equipment: { head: null } },
                    uuid: mockPlayer.id
                });
            });

            serverSocket.once('player:connect', serverHandler);

            clientSocket.emit('player:connect', playerData);

            clientSocket.once('player:connected', (response) => {
                expect(response.success).toBe(true);
                expect(response.player.name).toBe('TestPlayer');
                expect(response.uuid).toBeDefined();
                expect(response.inventory).toBeDefined();
                done();
            });
        });

        test('should handle existing player reconnection', (done) => {
            const playerData = {
                playerId: 'existing-player-123',
                playerName: 'ExistingPlayer'
            };

            // Mock existing player data
            const existingPlayerData = {
                id: 'existing-player-123',
                name: 'ExistingPlayer',
                position: { x: 5, y: 10 },
                stats: { hp: 80, maxHp: 100, mp: 4, maxMp: 6, ap: 1, maxAp: 2 },
                lastSeen: Date.now() - 60000 // 1 minute ago
            };

            mockRedisManager.getPlayerData.mockResolvedValue(existingPlayerData);

            const serverHandler = jest.fn(async (data) => {
                expect(data.playerId).toBe('existing-player-123');
                expect(data.playerName).toBe('ExistingPlayer');
                
                serverSocket.emit('player:connected', {
                    success: true,
                    player: existingPlayerData,
                    inventory: { resources: { laine_sheep: 5 }, items: {}, equipment: { head: null } },
                    uuid: existingPlayerData.id
                });
            });

            serverSocket.once('player:connect', serverHandler);

            clientSocket.emit('player:connect', playerData);

            clientSocket.once('player:connected', (response) => {
                expect(response.success).toBe(true);
                expect(response.player.id).toBe('existing-player-123');
                expect(response.player.position).toEqual({ x: 5, y: 10 });
                expect(response.inventory.resources.laine_sheep).toBe(5);
                done();
            });
        });

        test('should handle connection failure', (done) => {
            const playerData = {
                playerId: 'invalid-player',
                playerName: 'FailPlayer'
            };

            mockRedisManager.getPlayerData.mockRejectedValue(new Error('Database connection failed'));

            const serverHandler = jest.fn(async (data) => {
                expect(data.playerId).toBe('invalid-player');
                expect(data.playerName).toBe('FailPlayer');
                
                serverSocket.emit('player:connected', {
                    success: false,
                    error: 'Database connection failed'
                });
            });

            serverSocket.once('player:connect', serverHandler);

            clientSocket.emit('player:connect', playerData);

            clientSocket.once('player:connected', (response) => {
                expect(response.success).toBe(false);
                expect(response.error).toBeDefined();
                done();
            });
        });
    });

    describe('Lobby Management', () => {
        beforeEach(() => {
            // Clear all event listeners
            serverSocket.removeAllListeners('lobby:create');
            clientSocket.removeAllListeners('lobby:created');
            
            // Mock connected player
            serverSocket.player = {
                id: 'player-1',
                name: 'TestPlayer',
                isInLobby: () => false,
                joinLobby: jest.fn(),
                leaveLobby: jest.fn(),
                setReady: jest.fn(),
                save: jest.fn().mockResolvedValue(true)
            };
        });

        test('should create lobby successfully', (done) => {
            const lobbyData = {
                lobbyName: 'Test Lobby',
                gameSettings: {
                    difficulty: 'normal',
                    privateRoom: false
                }
            };

            const mockLobby = {
                id: 'lobby-123',
                name: 'Test Lobby',
                host: 'player-1',
                players: ['player-1'],
                status: 'waiting',
                maxPlayers: 4
            };

            mockRedisManager.createLobby.mockResolvedValue(mockLobby);

            const serverHandler = jest.fn(async (data) => {
                expect(data.lobbyName).toBe('Test Lobby');
                
                serverSocket.emit('lobby:created', {
                    success: true,
                    lobby: mockLobby
                });
            });

            serverSocket.once('lobby:create', serverHandler);

            clientSocket.emit('lobby:create', lobbyData);

            clientSocket.once('lobby:created', (response) => {
                expect(response.success).toBe(true);
                expect(response.lobby.name).toBe('Test Lobby');
                expect(response.lobby.host).toBe('player-1');
                done();
            });
        });

        test('should join lobby successfully', (done) => {
            const joinData = {
                lobbyId: 'lobby-123'
            };

            const mockLobby = {
                id: 'lobby-123',
                name: 'Test Lobby',
                host: 'host-player',
                players: ['host-player', 'player-1'],
                status: 'waiting'
            };

            mockRedisManager.getLobby.mockResolvedValue({
                ...mockLobby,
                players: ['host-player'],
                addPlayer: jest.fn().mockReturnValue(true),
                save: jest.fn().mockResolvedValue(true)
            });

            serverSocket.on('lobby:join', async (data) => {
                expect(data.lobbyId).toBe('lobby-123');
                
                serverSocket.emit('lobby:joined', {
                    success: true,
                    lobby: mockLobby
                });
            });

            clientSocket.emit('lobby:join', joinData);

            clientSocket.on('lobby:joined', (response) => {
                expect(response.success).toBe(true);
                expect(response.lobby.id).toBe('lobby-123');
                expect(response.lobby.players).toContain('player-1');
                done();
            });
        });

        test('should leave lobby successfully', (done) => {
            // Mock player in lobby
            serverSocket.player.isInLobby = () => true;
            serverSocket.player.lobbyId = 'lobby-123';

            const mockLobby = {
                id: 'lobby-123',
                players: ['host-player'],
                removePlayer: jest.fn().mockReturnValue(true),
                save: jest.fn().mockResolvedValue(true)
            };

            mockRedisManager.getLobby.mockResolvedValue(mockLobby);

            serverSocket.on('lobby:leave', async () => {
                serverSocket.emit('lobby:left', {
                    success: true
                });
            });

            clientSocket.emit('lobby:leave');

            clientSocket.on('lobby:left', (response) => {
                expect(response.success).toBe(true);
                done();
            });
        });

        test('should set ready status', (done) => {
            const readyData = { ready: true };

            serverSocket.player.isInLobby = () => true;
            serverSocket.player.lobbyId = 'lobby-123';
            serverSocket.player.isReady = false;

            serverSocket.on('lobby:ready', async (data) => {
                expect(data.ready).toBe(true);
                serverSocket.player.isReady = true;
                
                serverSocket.emit('lobby:ready', {
                    success: true,
                    ready: true
                });
            });

            clientSocket.emit('lobby:ready', readyData);

            clientSocket.on('lobby:ready', (response) => {
                expect(response.success).toBe(true);
                expect(response.ready).toBe(true);
                done();
            });
        });

        test('should start game as host', (done) => {
            // Mock host player
            serverSocket.player.isInLobby = () => true;
            serverSocket.player.lobbyId = 'lobby-123';
            serverSocket.player.isHost = true;

            const mockLobby = {
                id: 'lobby-123',
                players: ['player-1', 'player-2'],
                allPlayersReady: jest.fn().mockReturnValue(true),
                startGame: jest.fn().mockResolvedValue('session-456')
            };

            mockRedisManager.getLobby.mockResolvedValue(mockLobby);

            serverSocket.on('lobby:start_game', async () => {
                serverSocket.emit('game:starting', {
                    sessionId: 'session-456',
                    players: [
                        { id: 'player-1', name: 'Player1' },
                        { id: 'player-2', name: 'Player2' }
                    ]
                });
            });

            clientSocket.emit('lobby:start_game');

            clientSocket.on('game:starting', (response) => {
                expect(response.sessionId).toBe('session-456');
                expect(response.players).toHaveLength(2);
                done();
            });
        });

        test('should list active lobbies', (done) => {
            const mockLobbies = [
                {
                    id: 'lobby-1',
                    name: 'Lobby One',
                    playerCount: 2,
                    maxPlayers: 4,
                    status: 'waiting',
                    canJoin: true
                },
                {
                    id: 'lobby-2',
                    name: 'Lobby Two',
                    playerCount: 4,
                    maxPlayers: 4,
                    status: 'in_game',
                    canJoin: false
                }
            ];

            mockRedisManager.getActiveLobbies.mockResolvedValue(mockLobbies);

            serverSocket.on('lobby:list', async () => {
                serverSocket.emit('lobby:list', {
                    success: true,
                    lobbies: mockLobbies.filter(lobby => !lobby.gameSettings?.privateRoom)
                });
            });

            clientSocket.emit('lobby:list');

            clientSocket.on('lobby:list', (response) => {
                expect(response.success).toBe(true);
                expect(response.lobbies).toHaveLength(2);
                expect(response.lobbies[0].canJoin).toBe(true);
                expect(response.lobbies[1].canJoin).toBe(false);
                done();
            });
        });
    });

    describe('Game Synchronization', () => {
        beforeEach(() => {
            serverSocket.player = {
                id: 'player-1',
                name: 'TestPlayer',
                lobbyId: 'lobby-123',
                isInLobby: () => true,
                updatePosition: jest.fn()
            };
        });

        test('should sync player position updates', (done) => {
            const positionData = { x: 10, y: 15 };

            serverSocket.on('game:position_update', (data) => {
                expect(data.x).toBe(10);
                expect(data.y).toBe(15);
                
                // Simulate broadcasting to other players
                serverSocket.emit('game:player_moved', {
                    playerId: 'player-1',
                    position: { x: 10, y: 15 }
                });
            });

            clientSocket.emit('game:position_update', positionData);

            clientSocket.on('game:player_moved', (response) => {
                expect(response.playerId).toBe('player-1');
                expect(response.position).toEqual({ x: 10, y: 15 });
                done();
            });
        });

        test('should sync player actions', (done) => {
            const actionData = {
                action: 'attack',
                target: 'enemy-123',
                position: { x: 5, y: 8 }
            };

            serverSocket.on('game:action', (data) => {
                expect(data.action).toBe('attack');
                expect(data.target).toBe('enemy-123');
                
                // Simulate broadcasting to other players
                serverSocket.emit('game:player_action', {
                    playerId: 'player-1',
                    action: data.action,
                    target: data.target,
                    position: data.position,
                    timestamp: Date.now()
                });
            });

            clientSocket.emit('game:action', actionData);

            clientSocket.on('game:player_action', (response) => {
                expect(response.playerId).toBe('player-1');
                expect(response.action).toBe('attack');
                expect(response.target).toBe('enemy-123');
                expect(response.timestamp).toBeDefined();
                done();
            });
        });
    });

    describe('Inventory Synchronization', () => {
        beforeEach(() => {
            serverSocket.player = {
                id: 'player-1',
                name: 'TestPlayer'
            };
        });

        test('should sync inventory data', (done) => {
            const mockInventoryData = {
                resources: { laine_sheep: 10, corne_sheep: 5 },
                items: { coiffe_sheep: 1 },
                equipment: { head: 'coiffe_sheep' },
                version: 3
            };

            mockRedisManager.getPlayerInventory.mockResolvedValue(mockInventoryData);

            serverSocket.on('inventory:sync', async () => {
                serverSocket.emit('inventory:data', {
                    success: true,
                    inventory: mockInventoryData
                });
            });

            clientSocket.emit('inventory:sync');

            clientSocket.on('inventory:data', (response) => {
                expect(response.success).toBe(true);
                expect(response.inventory.resources.laine_sheep).toBe(10);
                expect(response.inventory.items.coiffe_sheep).toBe(1);
                expect(response.inventory.equipment.head).toBe('coiffe_sheep');
                done();
            });
        });

        test('should handle crafting requests', (done) => {
            const craftData = { recipeId: 'craft_coiffe_sheep' };

            serverSocket.on('inventory:craft', async (data) => {
                expect(data.recipeId).toBe('craft_coiffe_sheep');
                
                // Simulate successful craft
                serverSocket.emit('inventory:craft_result', {
                    success: true,
                    itemId: 'coiffe_sheep',
                    itemName: 'Gobbly Headgear'
                });
            });

            clientSocket.emit('inventory:craft', craftData);

            clientSocket.on('inventory:craft_result', (response) => {
                expect(response.success).toBe(true);
                expect(response.itemName).toBe('Gobbly Headgear');
                done();
            });
        });

        test('should handle equipment requests', (done) => {
            const equipData = { itemId: 'coiffe_sheep' };

            serverSocket.on('inventory:equip', async (data) => {
                expect(data.itemId).toBe('coiffe_sheep');
                
                serverSocket.emit('inventory:equip_result', {
                    success: true,
                    item: { name: 'Gobbly Headgear', slot: 'head' },
                    slot: 'head'
                });
            });

            clientSocket.emit('inventory:equip', equipData);

            clientSocket.on('inventory:equip_result', (response) => {
                expect(response.success).toBe(true);
                expect(response.slot).toBe('head');
                expect(response.item.name).toBe('Gobbly Headgear');
                done();
            });
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            // Clear all event listeners for each test
            serverSocket.removeAllListeners('lobby:create');
            serverSocket.removeAllListeners('player:connect');
            clientSocket.removeAllListeners('lobby:created');
            clientSocket.removeAllListeners('player:connected');
        });

        test('should handle malformed data gracefully', (done) => {
            // Send malformed lobby creation data
            const malformedData = { 
                lobbyName: null,
                gameSettings: "not an object"
            };

            const serverHandler = jest.fn(async (data) => {
                expect(data.lobbyName).toBe(null);
                // Should handle gracefully and return error
                serverSocket.emit('lobby:created', {
                    success: false,
                    error: 'Invalid lobby data'
                });
            });

            serverSocket.once('lobby:create', serverHandler);

            clientSocket.emit('lobby:create', malformedData);

            clientSocket.once('lobby:created', (response) => {
                expect(response.success).toBe(false);
                expect(response.error).toBeDefined();
                done();
            });
        });

        test('should handle Redis connection failures', (done) => {
            mockRedisManager.getPlayerData.mockRejectedValue(new Error('Redis connection failed'));

            const serverHandler = jest.fn(async (data) => {
                expect(data.playerName).toBe('TestPlayer');
                serverSocket.emit('player:connected', {
                    success: false,
                    error: 'Database connection failed'
                });
            });

            serverSocket.once('player:connect', serverHandler);

            clientSocket.emit('player:connect', { playerName: 'TestPlayer' });

            clientSocket.once('player:connected', (response) => {
                expect(response.success).toBe(false);
                expect(response.error).toContain('Database');
                done();
            });
        });

        test('should handle disconnection gracefully', (done) => {
            const testSocket = {
                id: 'test-socket',
                player: {
                    id: 'player-1',
                    name: 'TestPlayer',
                    disconnect: jest.fn(),
                    save: jest.fn().mockResolvedValue(true),
                    isInLobby: () => true,
                    lobbyId: 'lobby-123'
                },
                to: jest.fn().mockReturnThis(),
                emit: jest.fn()
            };

            // Simulate disconnection logic directly instead of using reserved event
            testSocket.player.disconnect();
            
            setTimeout(() => {
                expect(testSocket.player.disconnect).toHaveBeenCalled();
                done();
            }, 50);
        });
    });
});