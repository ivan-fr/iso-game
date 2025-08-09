import { getRoomData } from '../rooms.js';

describe('Lobby System', () => {

    describe('Room Configuration', () => {
        test('should have lobby room with ID -1', () => {
            const lobbyRoom = getRoomData(-1);
            expect(lobbyRoom).toBeDefined();
            expect(lobbyRoom.id).toBe(-1);
            expect(lobbyRoom.name).toBe('Lobby');
        });

        test('lobby should have dungeon portals', () => {
            const lobbyRoom = getRoomData(-1);
            expect(lobbyRoom.dungeonPortals).toBeDefined();
            expect(Array.isArray(lobbyRoom.dungeonPortals)).toBe(true);
            expect(lobbyRoom.dungeonPortals.length).toBeGreaterThan(0);
            
            // Check portal structure
            const portal = lobbyRoom.dungeonPortals[0];
            expect(portal).toHaveProperty('gridX');
            expect(portal).toHaveProperty('gridY');
            expect(portal).toHaveProperty('targetRoom');
            expect(portal).toHaveProperty('name');
            expect(portal).toHaveProperty('description');
        });

        test('dungeon rooms should have exit portals', () => {
            const room0 = getRoomData(0);
            const room1 = getRoomData(1);
            const room2 = getRoomData(2);
            
            expect(room0.exitPortal).toBeDefined();
            expect(room0.exitPortal.targetRoom).toBe(-1);
            
            expect(room1.exitPortal).toBeDefined();
            expect(room1.exitPortal.targetRoom).toBe(-1);
            
            expect(room2.exitPortal).toBeDefined();
            expect(room2.exitPortal.targetRoom).toBe(-1);
        });

        test('lobby should have no enemies', () => {
            const lobbyRoom = getRoomData(-1);
            expect(lobbyRoom.enemies).toBeDefined();
            expect(lobbyRoom.enemies).toHaveLength(0);
        });

        test('lobby should have appropriate starting position', () => {
            const lobbyRoom = getRoomData(-1);
            expect(lobbyRoom.playerStart).toBeDefined();
            expect(typeof lobbyRoom.playerStart.x).toBe('number');
            expect(typeof lobbyRoom.playerStart.y).toBe('number');
        });
    });

    describe('Portal Interactions', () => {
        test('should have valid portal structure', () => {
            const lobbyRoom = getRoomData(-1);
            const portal = lobbyRoom.dungeonPortals[0];
            
            expect(portal).toHaveProperty('gridX');
            expect(portal).toHaveProperty('gridY');
            expect(portal).toHaveProperty('targetRoom');
            expect(portal).toHaveProperty('name');
            expect(portal).toHaveProperty('description');
            
            // Check target room exists
            const targetRoom = getRoomData(portal.targetRoom);
            expect(targetRoom).toBeDefined();
        });
    });

    describe('Game Initialization', () => {
        test('should have lobby room data available', () => {
            const lobbyRoom = getRoomData(-1);
            expect(lobbyRoom).toBeDefined();
            expect(lobbyRoom.id).toBe(-1);
            expect(lobbyRoom.name).toBe('Lobby');
        });
    });

    describe('Room Navigation', () => {
        test('should navigate from lobby to training room', () => {
            const lobbyRoom = getRoomData(-1);
            const trainingPortal = lobbyRoom.dungeonPortals.find(p => p.targetRoom === 0);
            
            expect(trainingPortal).toBeDefined();
            expect(trainingPortal.targetRoom).toBe(0);
            
            const trainingRoom = getRoomData(0);
            expect(trainingRoom).toBeDefined();
            expect(trainingRoom.id).toBe(0);
        });

        test('should navigate back from dungeon to lobby', () => {
            const trainingRoom = getRoomData(0);
            expect(trainingRoom.exitPortal).toBeDefined();
            expect(trainingRoom.exitPortal.targetRoom).toBe(-1);
            
            const lobbyRoom = getRoomData(-1);
            expect(lobbyRoom).toBeDefined();
            expect(lobbyRoom.id).toBe(-1);
        });

        test('all dungeon rooms should be accessible from lobby', () => {
            const lobbyRoom = getRoomData(-1);
            const dungeonRoomIds = [0, 1, 2];
            
            dungeonRoomIds.forEach(roomId => {
                const portal = lobbyRoom.dungeonPortals.find(p => p.targetRoom === roomId);
                expect(portal).toBeDefined();
                
                const targetRoom = getRoomData(roomId);
                expect(targetRoom).toBeDefined();
                expect(targetRoom.id).toBe(roomId);
            });
        });

        test('all dungeon rooms should have return path to lobby', () => {
            const dungeonRoomIds = [0, 1, 2];
            
            dungeonRoomIds.forEach(roomId => {
                const room = getRoomData(roomId);
                expect(room.exitPortal).toBeDefined();
                expect(room.exitPortal.targetRoom).toBe(-1);
            });
        });
    });

    describe('Portal Positioning', () => {
        test('portal positions should be within room bounds', () => {
            const lobbyRoom = getRoomData(-1);
            
            lobbyRoom.dungeonPortals.forEach(portal => {
                expect(portal.gridX).toBeGreaterThanOrEqual(0);
                expect(portal.gridX).toBeLessThan(lobbyRoom.cols);
                expect(portal.gridY).toBeGreaterThanOrEqual(0);
                expect(portal.gridY).toBeLessThan(lobbyRoom.rows);
            });
        });

        test('exit portal positions should be within room bounds', () => {
            const dungeonRoomIds = [0, 1, 2];
            
            dungeonRoomIds.forEach(roomId => {
                const room = getRoomData(roomId);
                const exitPortal = room.exitPortal;
                
                expect(exitPortal.gridX).toBeGreaterThanOrEqual(0);
                expect(exitPortal.gridX).toBeLessThan(room.cols);
                expect(exitPortal.gridY).toBeGreaterThanOrEqual(0);
                expect(exitPortal.gridY).toBeLessThan(room.rows);
            });
        });

        test('portal positions should not be on obstacles', () => {
            const lobbyRoom = getRoomData(-1);
            
            lobbyRoom.dungeonPortals.forEach(portal => {
                const tileType = lobbyRoom.mapGrid[portal.gridY][portal.gridX];
                expect(tileType).toBe(0); // Should be walkable tile
            });
        });
    });
});
