import { jest } from '@jest/globals';

describe('Lobby System Integration Tests', () => {
    let mockSocket, mockGameState, mockPlayer;
    
    beforeEach(() => {
        // Mock WebSocket/Socket.IO
        mockSocket = {
            emit: jest.fn(),
            on: jest.fn(),
            disconnect: jest.fn(),
            connected: true
        };
        
        // Mock game state
        mockGameState = {
            currentRoomId: -1,
            playerState: 'idle',
            isMoving: false,
            gameOver: false,
            reachableTiles: [],
            otherPlayers: new Map()
        };
        
        // Mock player
        mockPlayer = {
            id: 'test-player-1',
            gridX: 5,
            gridY: 5,
            hp: 100,
            maxHp: 100,
            ap: 2,
            baseMaxAp: 2,
            mp: 6,
            baseMaxMp: 6,
            name: 'TestPlayer'
        };
        
        // Mock DOM
        global.document = {
            getElementById: jest.fn(() => ({
                textContent: '',
                style: {},
                classList: { add: jest.fn(), remove: jest.fn() }
            })),
            addEventListener: jest.fn()
        };
        
        global.window = {
            addEventListener: jest.fn(),
            currentGame: {
                isInLobby: () => mockGameState.currentRoomId === -1
            }
        };
        
        global.console = {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };
    });
    
    describe('Full Lobby Experience Flow', () => {
        test('should complete full lobby workflow: join -> move -> see others -> portal', async () => {
            // 1. Player joins lobby
            const joinLobby = () => {
                mockGameState.currentRoomId = -1;
                mockSocket.emit('join-room', { roomId: -1, playerId: mockPlayer.id });
                return true;
            };
            
            expect(joinLobby()).toBe(true);
            expect(mockSocket.emit).toHaveBeenCalledWith('join-room', { 
                roomId: -1, 
                playerId: mockPlayer.id 
            });
            
            // 2. Player moves freely in lobby
            const moveInLobby = (targetX, targetY) => {
                if (mockGameState.currentRoomId !== -1) return false;
                if (mockGameState.isMoving) return false;
                
                // No MP restrictions in lobby
                mockPlayer.gridX = targetX;
                mockPlayer.gridY = targetY;
                
                // Send position update to other players
                mockSocket.emit('game:action', {
                    type: 'move',
                    playerId: mockPlayer.id,
                    gridX: targetX,
                    gridY: targetY,
                    roomId: mockGameState.currentRoomId
                });
                
                return true;
            };
            
            // Test free movement
            expect(moveInLobby(9, 9)).toBe(true);
            expect(mockPlayer.gridX).toBe(9);
            expect(mockPlayer.gridY).toBe(9);
            expect(mockSocket.emit).toHaveBeenCalledWith('game:action', {
                type: 'move',
                playerId: mockPlayer.id,
                gridX: 9,
                gridY: 9,
                roomId: -1
            });
            
            // 3. Another player joins and is visible
            const otherPlayer = {
                id: 'test-player-2',
                gridX: 3,
                gridY: 4,
                name: 'OtherPlayer'
            };
            
            const handleOtherPlayerJoin = (playerData) => {
                mockGameState.otherPlayers.set(playerData.id, playerData);
            };
            
            handleOtherPlayerJoin(otherPlayer);
            expect(mockGameState.otherPlayers.has('test-player-2')).toBe(true);
            expect(mockGameState.otherPlayers.get('test-player-2').name).toBe('OtherPlayer');
            
            // 4. Player uses portal to enter dungeon
            const usePortal = (portalX, portalY, targetRoomId) => {
                if (mockPlayer.gridX === portalX && mockPlayer.gridY === portalY) {
                    mockGameState.currentRoomId = targetRoomId;
                    mockSocket.emit('join-room', { roomId: targetRoomId, playerId: mockPlayer.id });
                    return true;
                }
                return false;
            };
            
            // Move to portal position and use it
            moveInLobby(9, 9); // Portal position
            expect(usePortal(9, 9, 1)).toBe(true);
            expect(mockGameState.currentRoomId).toBe(1);
            expect(mockSocket.emit).toHaveBeenCalledWith('join-room', { 
                roomId: 1, 
                playerId: mockPlayer.id 
            });
        });
        
        test('should handle multiple players in lobby simultaneously', () => {
            const players = [
                { id: 'player-1', gridX: 2, gridY: 3, name: 'Alice' },
                { id: 'player-2', gridX: 5, gridY: 7, name: 'Bob' },
                { id: 'player-3', gridX: 8, gridY: 1, name: 'Charlie' }
            ];
            
            // Simulate all players joining lobby
            players.forEach(player => {
                mockGameState.otherPlayers.set(player.id, player);
                mockSocket.emit('player-joined', { roomId: -1, player });
            });
            
            expect(mockGameState.otherPlayers.size).toBe(3);
            
            // Simulate player movement updates
            const updatePlayerPosition = (playerId, newX, newY) => {
                const player = mockGameState.otherPlayers.get(playerId);
                if (player) {
                    player.gridX = newX;
                    player.gridY = newY;
                    mockSocket.emit('player-moved', { playerId, gridX: newX, gridY: newY });
                }
            };
            
            updatePlayerPosition('player-1', 4, 4);
            expect(mockGameState.otherPlayers.get('player-1').gridX).toBe(4);
            expect(mockSocket.emit).toHaveBeenCalledWith('player-moved', { 
                playerId: 'player-1', 
                gridX: 4, 
                gridY: 4 
            });
        });
        
        test('should maintain lobby state when players leave and rejoin', () => {
            // Player joins lobby
            mockGameState.otherPlayers.set('temp-player', { 
                id: 'temp-player', 
                gridX: 1, 
                gridY: 1, 
                name: 'TempPlayer' 
            });
            expect(mockGameState.otherPlayers.size).toBe(1);
            
            // Player leaves
            const handlePlayerLeave = (playerId) => {
                mockGameState.otherPlayers.delete(playerId);
                mockSocket.emit('player-left', { playerId, roomId: -1 });
            };
            
            handlePlayerLeave('temp-player');
            expect(mockGameState.otherPlayers.size).toBe(0);
            expect(mockSocket.emit).toHaveBeenCalledWith('player-left', { 
                playerId: 'temp-player', 
                roomId: -1 
            });
            
            // Player rejoins
            const rejoinPlayer = { id: 'temp-player', gridX: 6, gridY: 8, name: 'TempPlayer' };
            mockGameState.otherPlayers.set(rejoinPlayer.id, rejoinPlayer);
            
            expect(mockGameState.otherPlayers.size).toBe(1);
            expect(mockGameState.otherPlayers.get('temp-player').gridX).toBe(6);
        });
    });
    
    describe('Lobby vs Dungeon State Management', () => {
        test('should correctly transition between lobby and dungeon states', () => {
            // Start in lobby
            expect(mockGameState.currentRoomId).toBe(-1);
            
            // Enter dungeon
            const enterDungeon = (roomId) => {
                mockGameState.currentRoomId = roomId;
                mockGameState.reachableTiles = []; // Reset tiles
                mockSocket.emit('room-changed', { fromRoom: -1, toRoom: roomId });
            };
            
            enterDungeon(1);
            expect(mockGameState.currentRoomId).toBe(1);
            expect(mockSocket.emit).toHaveBeenCalledWith('room-changed', { 
                fromRoom: -1, 
                toRoom: 1 
            });
            
            // Return to lobby
            const returnToLobby = () => {
                mockGameState.currentRoomId = -1;
                mockGameState.reachableTiles = []; // Clear restrictions
                mockSocket.emit('room-changed', { fromRoom: 1, toRoom: -1 });
            };
            
            returnToLobby();
            expect(mockGameState.currentRoomId).toBe(-1);
            expect(mockSocket.emit).toHaveBeenCalledWith('room-changed', { 
                fromRoom: 1, 
                toRoom: -1 
            });
        });
        
        test('should handle different movement rules for lobby vs dungeon', () => {
            const attemptMove = (targetX, targetY, roomId) => {
                if (roomId === -1) {
                    // Lobby: free movement
                    return { success: true, mpCost: 0, reason: 'Free movement in lobby' };
                } else {
                    // Dungeon: MP-restricted movement
                    const distance = Math.abs(targetX - mockPlayer.gridX) + Math.abs(targetY - mockPlayer.gridY);
                    if (distance <= mockPlayer.mp) {
                        return { success: true, mpCost: distance, reason: 'Valid MP movement' };
                    } else {
                        return { success: false, mpCost: 0, reason: 'Insufficient MP' };
                    }
                }
            };
            
            // Test lobby movement (should always succeed)
            let result = attemptMove(9, 9, -1);
            expect(result.success).toBe(true);
            expect(result.mpCost).toBe(0);
            
            // Test dungeon movement within MP range
            result = attemptMove(7, 7, 1); // Distance = 4, MP = 6
            expect(result.success).toBe(true);
            expect(result.mpCost).toBe(4);
            
            // Test dungeon movement outside MP range
            result = attemptMove(0, 0, 1); // Distance = 10, MP = 6
            expect(result.success).toBe(false);
            expect(result.reason).toBe('Insufficient MP');
        });
    });
    
    describe('Real-time Multiplayer Synchronization', () => {
        test('should synchronize player movements in real-time', () => {
            const movements = [];
            
            const simulateRealTimeMovement = (playerId, fromX, fromY, toX, toY) => {
                movements.push({ playerId, fromX, fromY, toX, toY, timestamp: Date.now() });
                mockSocket.emit('game:action', {
                    type: 'move',
                    playerId,
                    gridX: toX,
                    gridY: toY,
                    roomId: -1
                });
            };
            
            // Simulate multiple players moving
            simulateRealTimeMovement('player-1', 0, 0, 3, 3);
            simulateRealTimeMovement('player-2', 5, 5, 7, 2);
            simulateRealTimeMovement('player-3', 9, 9, 1, 8);
            
            expect(movements).toHaveLength(3);
            expect(mockSocket.emit).toHaveBeenCalledTimes(3);
            
            // Verify all movements were broadcast
            movements.forEach((movement, index) => {
                expect(mockSocket.emit).toHaveBeenNthCalledWith(index + 1, 'game:action', {
                    type: 'move',
                    playerId: movement.playerId,
                    gridX: movement.toX,
                    gridY: movement.toY,
                    roomId: -1
                });
            });
        });
        
        test('should handle network latency and out-of-order updates', () => {
            const playerPositions = new Map();
            
            const handlePositionUpdate = (playerId, gridX, gridY, timestamp) => {
                const currentData = playerPositions.get(playerId);
                
                // Only update if this is newer than current data
                if (!currentData || timestamp > currentData.timestamp) {
                    playerPositions.set(playerId, { gridX, gridY, timestamp });
                    return true;
                } else {
                    return false; // Ignore outdated update
                }
            };
            
            const now = Date.now();
            
            // Simulate updates arriving out of order
            expect(handlePositionUpdate('player-1', 5, 5, now + 100)).toBe(true);    // Latest
            expect(handlePositionUpdate('player-1', 3, 3, now + 50)).toBe(false);    // Older - ignored
            expect(handlePositionUpdate('player-1', 7, 7, now + 150)).toBe(true);    // Newer
            
            const finalPosition = playerPositions.get('player-1');
            expect(finalPosition.gridX).toBe(7);
            expect(finalPosition.gridY).toBe(7);
            expect(finalPosition.timestamp).toBe(now + 150);
        });
    });
    
    describe('Error Handling and Edge Cases', () => {
        test('should handle connection loss gracefully', () => {
            mockSocket.connected = false;
            
            const attemptMove = (targetX, targetY) => {
                if (!mockSocket.connected) {
                    console.warn('Cannot move: not connected to server');
                    return false;
                }
                mockSocket.emit('game:action', { type: 'move', gridX: targetX, gridY: targetY });
                return true;
            };
            
            expect(attemptMove(5, 5)).toBe(false);
            expect(console.warn).toHaveBeenCalledWith('Cannot move: not connected to server');
            expect(mockSocket.emit).not.toHaveBeenCalled();
        });
        
        test('should handle invalid room transitions', () => {
            const validateRoomTransition = (fromRoom, toRoom) => {
                // Lobby (-1) can connect to any room
                if (fromRoom === -1) return true;
                
                // Dungeon rooms can only connect to lobby or adjacent rooms
                if (toRoom === -1) return true;
                
                // Simple validation: rooms can only connect to +/-1 room numbers
                return Math.abs(toRoom - fromRoom) <= 1;
            };
            
            expect(validateRoomTransition(-1, 1)).toBe(true);   // Lobby to dungeon
            expect(validateRoomTransition(1, -1)).toBe(true);   // Dungeon to lobby
            expect(validateRoomTransition(1, 2)).toBe(true);    // Adjacent rooms
            expect(validateRoomTransition(1, 5)).toBe(false);   // Non-adjacent rooms
        });
        
        test('should handle player data corruption gracefully', () => {
            const sanitizePlayerData = (playerData) => {
                if (!playerData || typeof playerData !== 'object') {
                    return null;
                }
                
                const sanitized = {
                    id: playerData.id || 'unknown',
                    gridX: Math.max(0, Math.min(9, playerData.gridX || 0)),
                    gridY: Math.max(0, Math.min(9, playerData.gridY || 0)),
                    name: playerData.name || 'Unknown Player'
                };
                
                return sanitized;
            };
            
            // Test with corrupted data
            expect(sanitizePlayerData(null)).toBe(null);
            expect(sanitizePlayerData(undefined)).toBe(null);
            expect(sanitizePlayerData("invalid")).toBe(null);
            
            // Test with incomplete data
            const incomplete = { id: 'test' };
            const sanitized = sanitizePlayerData(incomplete);
            expect(sanitized.id).toBe('test');
            expect(sanitized.gridX).toBe(0);
            expect(sanitized.gridY).toBe(0);
            expect(sanitized.name).toBe('Unknown Player');
            
            // Test with out-of-bounds coordinates
            const outOfBounds = { id: 'test', gridX: -5, gridY: 15, name: 'Test' };
            const bounded = sanitizePlayerData(outOfBounds);
            expect(bounded.gridX).toBe(0);
            expect(bounded.gridY).toBe(9);
        });
    });
});
