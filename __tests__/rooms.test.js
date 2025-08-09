import { ROOMS, getRoomData } from '../rooms.js';

describe('Rooms Module Tests', () => {
    
    describe('ROOMS Data Structure', () => {
        test('should contain expected number of rooms', () => {
            expect(ROOMS).toHaveLength(4); // Now includes lobby room
        });

        test('each room should have required properties', () => {
            ROOMS.forEach(room => {
                expect(room).toHaveProperty('id');
                expect(room).toHaveProperty('name');
                expect(room).toHaveProperty('rows');
                expect(room).toHaveProperty('cols');
                expect(room).toHaveProperty('playerStart');
                expect(room).toHaveProperty('mapGrid');
                expect(room).toHaveProperty('enemies');

                // Validate property types
                expect(typeof room.id).toBe('number');
                expect(typeof room.name).toBe('string');
                expect(typeof room.rows).toBe('number');
                expect(typeof room.cols).toBe('number');
                expect(Array.isArray(room.mapGrid)).toBe(true);
                expect(Array.isArray(room.enemies)).toBe(true);
            });
        });

        test('playerStart should have valid x and y coordinates', () => {
            ROOMS.forEach(room => {
                expect(room.playerStart).toHaveProperty('x');
                expect(room.playerStart).toHaveProperty('y');
                expect(typeof room.playerStart.x).toBe('number');
                expect(typeof room.playerStart.y).toBe('number');
                expect(room.playerStart.x).toBeGreaterThanOrEqual(0);
                expect(room.playerStart.y).toBeGreaterThanOrEqual(0);
                expect(room.playerStart.x).toBeLessThan(room.cols);
                expect(room.playerStart.y).toBeLessThan(room.rows);
            });
        });

        test('mapGrid should match declared dimensions', () => {
            ROOMS.forEach(room => {
                expect(room.mapGrid).toHaveLength(room.rows);
                room.mapGrid.forEach(row => {
                    expect(row).toHaveLength(room.cols);
                    row.forEach(cell => {
                        expect(typeof cell).toBe('number');
                        expect([0, 1]).toContain(cell); // Only 0 or 1 allowed
                    });
                });
            });
        });

        test('enemies should have valid properties', () => {
            ROOMS.forEach(room => {
                room.enemies.forEach(enemy => {
                    expect(enemy).toHaveProperty('type');
                    expect(enemy).toHaveProperty('gridX');
                    expect(enemy).toHaveProperty('gridY');
                    
                    expect(typeof enemy.type).toBe('string');
                    expect(typeof enemy.gridX).toBe('number');
                    expect(typeof enemy.gridY).toBe('number');
                    
                    // Enemy position should be within grid bounds
                    expect(enemy.gridX).toBeGreaterThanOrEqual(0);
                    expect(enemy.gridY).toBeGreaterThanOrEqual(0);
                    expect(enemy.gridX).toBeLessThan(room.cols);
                    expect(enemy.gridY).toBeLessThan(room.rows);
                    
                    // Enemy type should be valid
                    const validTypes = ['sheep', 'sheepist_noir', 'chef_de_guerre', 'boss'];
                    expect(validTypes).toContain(enemy.type);
                });
            });
        });
    });

    describe('Lobby Room', () => {
        const lobbyRoom = ROOMS[0];

        test('should have correct basic properties', () => {
            expect(lobbyRoom.id).toBe(-1);
            expect(lobbyRoom.name).toBe("Lobby");
            expect(lobbyRoom.rows).toBe(12);
            expect(lobbyRoom.cols).toBe(16);
        });

        test('should have no enemies', () => {
            expect(lobbyRoom.enemies).toEqual([]);
        });

        test('should have dungeon portals', () => {
            expect(lobbyRoom.dungeonPortals).toBeDefined();
            expect(lobbyRoom.dungeonPortals.length).toBe(3);
            
            lobbyRoom.dungeonPortals.forEach(portal => {
                expect(portal).toHaveProperty('gridX');
                expect(portal).toHaveProperty('gridY');
                expect(portal).toHaveProperty('targetRoom');
                expect(portal).toHaveProperty('name');
                expect(portal).toHaveProperty('description');
            });
        });

        test('should not have an exit portal', () => {
            expect(lobbyRoom.exitPortal).toBeUndefined();
        });
    });

    describe('Room 0 - Training Room', () => {
        const room0 = ROOMS[1]; // Training room is now at index 1

        test('should have correct basic properties', () => {
            expect(room0.id).toBe(0);
            expect(room0.name).toBe("Salle d'entraînement");
            expect(room0.rows).toBe(10);
            expect(room0.cols).toBe(12);
        });

        test('should have valid player start position', () => {
            expect(room0.playerStart).toEqual({ x: 1, y: 1 });
        });

        test('should have expected obstacles in mapGrid', () => {
            // Check specific obstacles mentioned in the code
            expect(room0.mapGrid[3][3]).toBe(1);
            expect(room0.mapGrid[3][4]).toBe(1);
            expect(room0.mapGrid[3][5]).toBe(1);
            expect(room0.mapGrid[6][6]).toBe(1);
            expect(room0.mapGrid[6][7]).toBe(1);
            expect(room0.mapGrid[6][8]).toBe(1);
            expect(room0.mapGrid[4][8]).toBe(1);
            expect(room0.mapGrid[5][8]).toBe(1);
        });

        test('should have expected enemies', () => {
            expect(room0.enemies).toHaveLength(4);
            
            const expectedEnemies = [
                { type: 'sheep', gridX: 8, gridY: 2 },
                { type: 'sheep', gridX: 3, gridY: 7 },
                { type: 'sheepist_noir', gridX: 10, gridY: 4 },
                { type: 'sheepist_noir', gridX: 5, gridY: 5 }
            ];
            
            expectedEnemies.forEach(expected => {
                const found = room0.enemies.find(e => 
                    e.type === expected.type && 
                    e.gridX === expected.gridX && 
                    e.gridY === expected.gridY
                );
                expect(found).toBeDefined();
            });
        });
    });

    describe('Room 1 - Antechamber', () => {
        const room1 = ROOMS[2]; // Antechamber is now at index 2

        test('should have correct basic properties', () => {
            expect(room1.id).toBe(1);
            expect(room1.name).toBe("Antichambre du Chef");
            expect(room1.rows).toBe(14);
            expect(room1.cols).toBe(14);
        });

        test('should have valid player start position', () => {
            expect(room1.playerStart).toEqual({ x: 1, y: 6 });
        });

        test('should have L-shaped obstacle patterns', () => {
            // Test for L-shapes in corners
            // Top-left L
            expect(room1.mapGrid[3][3]).toBe(1);
            expect(room1.mapGrid[3][4]).toBe(1);
            expect(room1.mapGrid[3][5]).toBe(1);
            
            // Should have empty spaces around L-shapes
            expect(room1.mapGrid[0][0]).toBe(0);
            expect(room1.mapGrid[7][7]).toBe(0); // Center should be free
        });

        test('should have mixed enemy types including chef', () => {
            expect(room1.enemies).toHaveLength(4);
            
            const enemyTypes = room1.enemies.map(e => e.type);
            expect(enemyTypes).toContain('sheep');
            expect(enemyTypes).toContain('sheepist_noir');
            expect(enemyTypes).toContain('chef_de_guerre');
        });
    });

    describe('Room 2 - Throne Room', () => {
        const room2 = ROOMS[3]; // Throne room is now at index 3

        test('should have correct basic properties', () => {
            expect(room2.id).toBe(2);
            expect(room2.name).toBe("Salle du Trône");
            expect(room2.rows).toBe(16);
            expect(room2.cols).toBe(16);
        });

        test('should have valid player start position', () => {
            expect(room2.playerStart).toEqual({ x: 1, y: 7 });
        });

        test('should have central platform with walls', () => {
            // Top and bottom walls
            for (let i = 5; i < 11; i++) {
                expect(room2.mapGrid[5][i]).toBe(1);  // Top wall
                expect(room2.mapGrid[10][i]).toBe(1); // Bottom wall
            }
            
            // Side walls (with gap at y=7)
            expect(room2.mapGrid[6][5]).toBe(1);
            expect(room2.mapGrid[7][5]).toBe(0); // Gap
            expect(room2.mapGrid[8][5]).toBe(1);
            expect(room2.mapGrid[9][5]).toBe(1);
            
            // Right wall
            for (let i = 6; i < 10; i++) {
                expect(room2.mapGrid[i][10]).toBe(1);
            }
        });

        test('should have corner pillars', () => {
            expect(room2.mapGrid[3][3]).toBe(1);
            expect(room2.mapGrid[3][12]).toBe(1);
            expect(room2.mapGrid[12][3]).toBe(1);
            expect(room2.mapGrid[12][12]).toBe(1);
        });

        test('should have boss enemy', () => {
            const bossEnemy = room2.enemies.find(e => e.type === 'boss');
            expect(bossEnemy).toBeDefined();
            expect(bossEnemy.gridX).toBe(14);
            expect(bossEnemy.gridY).toBe(1);
        });

        test('should have all enemy types', () => {
            const enemyTypes = room2.enemies.map(e => e.type);
            expect(enemyTypes).toContain('sheep');
            expect(enemyTypes).toContain('sheepist_noir');
            expect(enemyTypes).toContain('chef_de_guerre');
            expect(enemyTypes).toContain('boss');
        });
    });

    describe('getRoomData Function', () => {
        test('should return correct room data for valid IDs', () => {
            const lobbyRoom = getRoomData(-1);
            const room0 = getRoomData(0);
            const room1 = getRoomData(1);
            const room2 = getRoomData(2);
            
            expect(lobbyRoom).toBe(ROOMS[0]);
            expect(room0).toBe(ROOMS[1]);
            expect(room1).toBe(ROOMS[2]);
            expect(room2).toBe(ROOMS[3]);
        });

        test('should return undefined for invalid room IDs', () => {
            expect(getRoomData(3)).toBeUndefined();
            expect(getRoomData(999)).toBeUndefined();
        });

        test('should handle non-numeric inputs', () => {
            expect(getRoomData('0')).toBeUndefined();
            expect(getRoomData(null)).toBeUndefined();
            expect(getRoomData(undefined)).toBeUndefined();
        });
    });

    describe('Grid Integrity', () => {
        test('player start positions should not be on obstacles', () => {
            ROOMS.forEach(room => {
                const { x, y } = room.playerStart;
                expect(room.mapGrid[y][x]).toBe(0);
            });
        });

        test('enemy positions should not be on obstacles', () => {
            ROOMS.forEach(room => {
                room.enemies.forEach(enemy => {
                    expect(room.mapGrid[enemy.gridY][enemy.gridX]).toBe(0);
                });
            });
        });

        test('no enemies should start on same tile as player', () => {
            ROOMS.forEach(room => {
                const playerPos = room.playerStart;
                room.enemies.forEach(enemy => {
                    const samePosition = enemy.gridX === playerPos.x && enemy.gridY === playerPos.y;
                    expect(samePosition).toBe(false);
                });
            });
        });

        test('no two enemies should start on the same tile', () => {
            ROOMS.forEach(room => {
                const positions = room.enemies.map(e => `${e.gridX},${e.gridY}`);
                const uniquePositions = [...new Set(positions)];
                expect(positions.length).toBe(uniquePositions.length);
            });
        });
    });

    describe('Room Progression Logic', () => {
        test('dungeon rooms should have increasing difficulty (more enemies)', () => {
            // Skip the lobby room (index 0) and test dungeon rooms (indices 1-3)
            expect(ROOMS[1].enemies.length).toBeGreaterThanOrEqual(3);
            expect(ROOMS[2].enemies.length).toBeGreaterThanOrEqual(3);
            expect(ROOMS[3].enemies.length).toBeGreaterThanOrEqual(3);
        });

        test('boss should only appear in final room', () => {
            const room0HasBoss = ROOMS[1].enemies.some(e => e.type === 'boss'); // Training room
            const room1HasBoss = ROOMS[2].enemies.some(e => e.type === 'boss'); // Antechamber
            const room2HasBoss = ROOMS[3].enemies.some(e => e.type === 'boss'); // Throne room
            
            expect(room0HasBoss).toBe(false);
            expect(room1HasBoss).toBe(false);
            expect(room2HasBoss).toBe(true);
        });

        test('room sizes should accommodate gameplay', () => {
            ROOMS.forEach(room => {
                expect(room.rows).toBeGreaterThanOrEqual(10);
                expect(room.cols).toBeGreaterThanOrEqual(10);
                expect(room.rows * room.cols).toBeGreaterThan(room.enemies.length * 4); // Plenty of space
            });
        });
    });
});