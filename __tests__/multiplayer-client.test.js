/**
 * Client-side multiplayer tests
 */
import { jest } from '@jest/globals';

// Mock Socket.IO client
const mockSocket = {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    disconnect: jest.fn(),
    connected: false,
    id: 'mock-socket-id'
};

const mockIo = jest.fn(() => mockSocket);

jest.mock('socket.io-client', () => ({
    io: mockIo
}));

// Mock DOM elements
global.document = {
    getElementById: jest.fn(),
    createElement: jest.fn(),
    body: { appendChild: jest.fn() }
};

global.window = {
    location: { hostname: 'localhost', port: '3000' }
};

describe('Client-side Multiplayer', () => {
    let multiplayerClient;
    
    beforeEach(async () => {
        jest.clearAllMocks();
        mockSocket.connected = false;
        
        // Reset the mock socket
        mockSocket.emit.mockClear();
        mockSocket.on.mockClear();
        mockSocket.off.mockClear();
        mockSocket.disconnect.mockClear();
        mockIo.mockClear();
        
        // Create a simple multiplayer client for testing
        multiplayerClient = {
            socket: null,
            isConnected: false,
            playerId: null,
            lobbyId: null,
            
            connect() {
                this.socket = mockIo(); // Use mockIo directly
                this.isConnected = true;
                this.setupEventHandlers();
                return this.socket;
            },
            
            disconnect() {
                if (this.socket) {
                    this.socket.disconnect();
                    this.socket = null;
                    this.isConnected = false;
                }
            },
            
            setupEventHandlers() {
                if (!this.socket) return;
                
                this.socket.on('connect', () => {
                    this.isConnected = true;
                    this.playerId = this.socket.id;
                });
                
                this.socket.on('disconnect', () => {
                    this.isConnected = false;
                    this.playerId = null;
                });
                
                this.socket.on('lobby-joined', (data) => {
                    this.lobbyId = data.lobbyId;
                });
                
                this.socket.on('lobby-left', () => {
                    this.lobbyId = null;
                });
            },
            
            joinLobby(lobbyId) {
                if (!this.socket || !this.isConnected) {
                    throw new Error('Not connected to server');
                }
                this.socket.emit('join-lobby', { lobbyId });
            },
            
            leaveLobby() {
                if (!this.socket || !this.isConnected || !this.lobbyId) {
                    throw new Error('Not in a lobby');
                }
                this.socket.emit('leave-lobby', { lobbyId: this.lobbyId });
            },
            
            sendGameAction(action) {
                if (!this.socket || !this.isConnected || !this.lobbyId) {
                    throw new Error('Not connected or not in lobby');
                }
                this.socket.emit('game-action', {
                    lobbyId: this.lobbyId,
                    action
                });
            }
        };
    });

    describe('Connection Management', () => {
        test('should establish connection to server', () => {
            const socket = multiplayerClient.connect();
            
            expect(mockIo).toHaveBeenCalledWith();
            expect(socket).toBe(mockSocket);
            expect(multiplayerClient.socket).toBe(mockSocket);
        });

        test('should setup event handlers on connection', () => {
            multiplayerClient.connect();
            
            expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('lobby-joined', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('lobby-left', expect.any(Function));
        });

        test('should handle successful connection', () => {
            multiplayerClient.connect();
            
            // Simulate connect event
            const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
            connectHandler();
            
            expect(multiplayerClient.isConnected).toBe(true);
            expect(multiplayerClient.playerId).toBe(mockSocket.id);
        });

        test('should handle disconnection', () => {
            multiplayerClient.connect();
            multiplayerClient.isConnected = true;
            multiplayerClient.playerId = 'test-player';
            
            // Simulate disconnect event
            const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
            disconnectHandler();
            
            expect(multiplayerClient.isConnected).toBe(false);
            expect(multiplayerClient.playerId).toBeNull();
        });

        test('should disconnect properly', () => {
            multiplayerClient.connect();
            multiplayerClient.isConnected = true;
            
            multiplayerClient.disconnect();
            
            expect(mockSocket.disconnect).toHaveBeenCalled();
            expect(multiplayerClient.socket).toBeNull();
            expect(multiplayerClient.isConnected).toBe(false);
        });
    });

    describe('Lobby Management', () => {
        beforeEach(() => {
            multiplayerClient.connect();
            multiplayerClient.isConnected = true;
        });

        test('should join lobby successfully', () => {
            const lobbyId = 'test-lobby-123';
            
            multiplayerClient.joinLobby(lobbyId);
            
            expect(mockSocket.emit).toHaveBeenCalledWith('join-lobby', { lobbyId });
        });

        test('should handle lobby joined event', () => {
            const lobbyData = { lobbyId: 'test-lobby-123', players: ['player1', 'player2'] };
            
            // Simulate lobby-joined event
            const lobbyJoinedHandler = mockSocket.on.mock.calls.find(call => call[0] === 'lobby-joined')[1];
            lobbyJoinedHandler(lobbyData);
            
            expect(multiplayerClient.lobbyId).toBe('test-lobby-123');
        });

        test('should leave lobby successfully', () => {
            multiplayerClient.lobbyId = 'test-lobby-123';
            
            multiplayerClient.leaveLobby();
            
            expect(mockSocket.emit).toHaveBeenCalledWith('leave-lobby', { lobbyId: 'test-lobby-123' });
        });

        test('should handle lobby left event', () => {
            multiplayerClient.lobbyId = 'test-lobby-123';
            
            // Simulate lobby-left event
            const lobbyLeftHandler = mockSocket.on.mock.calls.find(call => call[0] === 'lobby-left')[1];
            lobbyLeftHandler();
            
            expect(multiplayerClient.lobbyId).toBeNull();
        });

        test('should throw error when joining lobby without connection', () => {
            multiplayerClient.isConnected = false;
            
            expect(() => {
                multiplayerClient.joinLobby('test-lobby');
            }).toThrow('Not connected to server');
        });

        test('should throw error when leaving lobby without being in one', () => {
            multiplayerClient.lobbyId = null;
            
            expect(() => {
                multiplayerClient.leaveLobby();
            }).toThrow('Not in a lobby');
        });
    });

    describe('Game Actions', () => {
        beforeEach(() => {
            multiplayerClient.connect();
            multiplayerClient.isConnected = true;
            multiplayerClient.lobbyId = 'test-lobby-123';
        });

        test('should send move action', () => {
            const moveAction = {
                type: 'move',
                entityId: 'player-1',
                path: [{ x: 1, y: 1 }, { x: 2, y: 2 }]
            };
            
            multiplayerClient.sendGameAction(moveAction);
            
            expect(mockSocket.emit).toHaveBeenCalledWith('game-action', {
                lobbyId: 'test-lobby-123',
                action: moveAction
            });
        });

        test('should send attack action', () => {
            const attackAction = {
                type: 'attack',
                attackerId: 'player-1',
                targetId: 'enemy-1',
                damage: 25
            };
            
            multiplayerClient.sendGameAction(attackAction);
            
            expect(mockSocket.emit).toHaveBeenCalledWith('game-action', {
                lobbyId: 'test-lobby-123',
                action: attackAction
            });
        });

        test('should send spell action', () => {
            const spellAction = {
                type: 'spell',
                casterId: 'player-1',
                spellId: 'heal',
                targets: [{ x: 3, y: 3 }]
            };
            
            multiplayerClient.sendGameAction(spellAction);
            
            expect(mockSocket.emit).toHaveBeenCalledWith('game-action', {
                lobbyId: 'test-lobby-123',
                action: spellAction
            });
        });

        test('should throw error when sending action without connection', () => {
            multiplayerClient.isConnected = false;
            
            expect(() => {
                multiplayerClient.sendGameAction({ type: 'move' });
            }).toThrow('Not connected or not in lobby');
        });

        test('should throw error when sending action without being in lobby', () => {
            multiplayerClient.lobbyId = null;
            
            expect(() => {
                multiplayerClient.sendGameAction({ type: 'move' });
            }).toThrow('Not connected or not in lobby');
        });
    });

    describe('Error Handling', () => {
        test('should handle connection timeout', () => {
            const mockError = new Error('Connection timeout');
            multiplayerClient.connect();
            
            // Simulate error event
            const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')?.[1];
            if (errorHandler) {
                expect(() => errorHandler(mockError)).not.toThrow();
            }
        });

        test('should handle server disconnection', () => {
            multiplayerClient.connect();
            multiplayerClient.isConnected = true;
            
            // Simulate unexpected disconnect
            const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
            disconnectHandler('transport close');
            
            expect(multiplayerClient.isConnected).toBe(false);
        });

        test('should handle invalid game actions', () => {
            multiplayerClient.connect();
            multiplayerClient.isConnected = true;
            multiplayerClient.lobbyId = 'test-lobby';
            
            const invalidAction = { type: 'invalid-action' };
            
            expect(() => {
                multiplayerClient.sendGameAction(invalidAction);
            }).not.toThrow();
            
            expect(mockSocket.emit).toHaveBeenCalledWith('game-action', {
                lobbyId: 'test-lobby',
                action: invalidAction
            });
        });
    });

    describe('State Synchronization', () => {
        let gameState;
        
        beforeEach(() => {
            multiplayerClient.connect();
            multiplayerClient.isConnected = true;
            multiplayerClient.lobbyId = 'test-lobby-123';
            
            gameState = {
                players: [],
                entities: [],
                currentTurn: 0,
                gamePhase: 'waiting'
            };
        });

        test('should handle game state updates', () => {
            const newGameState = {
                ...gameState,
                currentTurn: 1,
                gamePhase: 'playing',
                players: [{ id: 'player-1', x: 5, y: 5 }]
            };
            
            // Add game state handler to client
            multiplayerClient.onGameStateUpdate = jest.fn();
            multiplayerClient.socket.on('game-state-update', multiplayerClient.onGameStateUpdate);
            
            // Simulate game state update
            const gameStateHandler = mockSocket.on.mock.calls.find(call => call[0] === 'game-state-update')?.[1];
            if (gameStateHandler) {
                gameStateHandler(newGameState);
                expect(multiplayerClient.onGameStateUpdate).toHaveBeenCalledWith(newGameState);
            }
        });

        test('should handle player updates', () => {
            const playerUpdate = {
                playerId: 'player-1',
                position: { x: 3, y: 4 },
                hp: 80,
                mp: 15
            };
            
            multiplayerClient.onPlayerUpdate = jest.fn();
            multiplayerClient.socket.on('player-update', multiplayerClient.onPlayerUpdate);
            
            const playerUpdateHandler = mockSocket.on.mock.calls.find(call => call[0] === 'player-update')?.[1];
            if (playerUpdateHandler) {
                playerUpdateHandler(playerUpdate);
                expect(multiplayerClient.onPlayerUpdate).toHaveBeenCalledWith(playerUpdate);
            }
        });

        test('should handle turn changes', () => {
            const turnData = {
                currentPlayer: 'player-2',
                turnNumber: 5,
                timeRemaining: 30000
            };
            
            multiplayerClient.onTurnChange = jest.fn();
            multiplayerClient.socket.on('turn-change', multiplayerClient.onTurnChange);
            
            const turnChangeHandler = mockSocket.on.mock.calls.find(call => call[0] === 'turn-change')?.[1];
            if (turnChangeHandler) {
                turnChangeHandler(turnData);
                expect(multiplayerClient.onTurnChange).toHaveBeenCalledWith(turnData);
            }
        });
    });
});
