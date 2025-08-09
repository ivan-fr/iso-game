import { 
    TILE_W, 
    TILE_H, 
    isoToScreen, 
    screenToIso, 
    updateCameraOffset,
    isTileValidAndFree,
    getAdjacentTiles,
    hasLineOfSight,
    getTilesInRangeBFS
} from '../grid.js';

describe('Grid Module Tests', () => {
    
    describe('Constants', () => {
        test('TILE_W should be 80', () => {
            expect(TILE_W).toBe(80);
        });

        test('TILE_H should be half of TILE_W', () => {
            expect(TILE_H).toBe(TILE_W / 2);
            expect(TILE_H).toBe(40);
        });
    });

    describe('Camera and Coordinate Transformations', () => {
        beforeEach(() => {
            updateCameraOffset(800, 600, 10, 10);
        });

        test('isoToScreen should convert grid coordinates to screen coordinates', () => {
            const result = isoToScreen(5, 5);
            expect(result).toHaveProperty('x');
            expect(result).toHaveProperty('y');
            expect(typeof result.x).toBe('number');
            expect(typeof result.y).toBe('number');
        });

        test('isoToScreen should handle origin correctly', () => {
            const result = isoToScreen(0, 0);
            expect(result.x).toBeDefined();
            expect(result.y).toBeDefined();
        });

        test('screenToIso should convert screen coordinates to grid coordinates', () => {
            const screenPos = isoToScreen(3, 4);
            const result = screenToIso(screenPos.x, screenPos.y, 10, 10);
            expect(result.x).toBe(3);
            expect(result.y).toBe(4);
        });

        test('screenToIso should clamp coordinates to grid boundaries', () => {
            const result = screenToIso(-1000, -1000, 10, 10);
            expect(result.x).toBeGreaterThanOrEqual(0);
            expect(result.y).toBeGreaterThanOrEqual(0);
            expect(result.x).toBeLessThan(10);
            expect(result.y).toBeLessThan(10);
        });
    });

    describe('Grid Logic Functions', () => {
        const mockGrid = [
            [0, 0, 0, 1, 0],
            [0, 1, 0, 0, 0],
            [0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0],
            [0, 0, 1, 0, 0]
        ];
        const cols = 5;
        const rows = 5;

        test('isTileValidAndFree should return false for obstacles', () => {
            const entity = { gridX: 0, gridY: 0 };
            expect(isTileValidAndFree(3, 0, entity, [], mockGrid, cols, rows)).toBe(false);
            expect(isTileValidAndFree(1, 1, entity, [], mockGrid, cols, rows)).toBe(false);
        });

        test('isTileValidAndFree should return false for out of bounds', () => {
            const entity = { gridX: 0, gridY: 0 };
            expect(isTileValidAndFree(-1, 0, entity, [], mockGrid, cols, rows)).toBe(false);
            expect(isTileValidAndFree(5, 0, entity, [], mockGrid, cols, rows)).toBe(false);
            expect(isTileValidAndFree(0, -1, entity, [], mockGrid, cols, rows)).toBe(false);
            expect(isTileValidAndFree(0, 5, entity, [], mockGrid, cols, rows)).toBe(false);
        });

        test('isTileValidAndFree should return false for occupied tiles', () => {
            const entity = { gridX: 0, gridY: 0 };
            const occupyingEntity = { gridX: 2, gridY: 2, hp: 100 };
            expect(isTileValidAndFree(2, 2, entity, [occupyingEntity], mockGrid, cols, rows)).toBe(false);
        });

        test('isTileValidAndFree should return true for valid free tiles', () => {
            const entity = { gridX: 0, gridY: 0 };
            expect(isTileValidAndFree(0, 0, entity, [], mockGrid, cols, rows)).toBe(true);
            expect(isTileValidAndFree(2, 1, entity, [], mockGrid, cols, rows)).toBe(true);
        });

        test('getAdjacentTiles should return 4 adjacent tiles for center position', () => {
            const result = getAdjacentTiles(2, 2, cols, rows);
            expect(result).toHaveLength(4);
            expect(result).toContainEqual({ x: 3, y: 2 });
            expect(result).toContainEqual({ x: 1, y: 2 });
            expect(result).toContainEqual({ x: 2, y: 3 });
            expect(result).toContainEqual({ x: 2, y: 1 });
        });

        test('getAdjacentTiles should return fewer tiles for edge positions', () => {
            const result = getAdjacentTiles(0, 0, cols, rows);
            expect(result).toHaveLength(2);
            expect(result).toContainEqual({ x: 1, y: 0 });
            expect(result).toContainEqual({ x: 0, y: 1 });
        });

        test('hasLineOfSight should return true for clear path', () => {
            expect(hasLineOfSight(0, 0, 2, 0, [], mockGrid)).toBe(true);
        });

        test('hasLineOfSight should return false when blocked by obstacle', () => {
            expect(hasLineOfSight(0, 0, 4, 0, [], mockGrid)).toBe(false); // Blocked by obstacle at (3,0)
        });

        test('getTilesInRangeBFS should return reachable tiles within range', () => {
            const result = getTilesInRangeBFS(0, 0, 2, [], false, mockGrid, cols, rows);
            expect(result.length).toBeGreaterThan(0);
            result.forEach(tile => {
                expect(tile.cost).toBeLessThanOrEqual(2);
                expect(tile).toHaveProperty('x');
                expect(tile).toHaveProperty('y');
                expect(tile).toHaveProperty('cost');
            });
        });

        test('getTilesInRangeBFS should include origin when includeOrigin is true', () => {
            const result = getTilesInRangeBFS(0, 0, 2, [], true, mockGrid, cols, rows);
            expect(result).toContainEqual({ x: 0, y: 0, cost: 0 });
        });

        test('getTilesInRangeBFS should exclude origin when includeOrigin is false', () => {
            const result = getTilesInRangeBFS(0, 0, 2, [], false, mockGrid, cols, rows);
            expect(result).not.toContainEqual({ x: 0, y: 0, cost: 0 });
        });
    });

    describe('updateCameraOffset', () => {
        test('should update camera offset for different canvas sizes', () => {
            expect(() => {
                updateCameraOffset(1024, 768, 12, 12);
            }).not.toThrow();
        });

        test('should handle small grids', () => {
            expect(() => {
                updateCameraOffset(400, 300, 3, 3);
            }).not.toThrow();
        });
    });
});