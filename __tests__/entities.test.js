import { 
    Entity, 
    player, 
    boss, 
    createEnemy, 
    findPath 
} from '../entities.js';

describe('Entities Module Tests', () => {
    
    describe('Entity Class', () => {
        test('should create entity with correct properties', () => {
            const entity = new Entity(5, 7, 32, 100, 100, 6, 2, 'test', 'test-id');
            
            expect(entity.id).toBe('test-id');
            expect(entity.gridX).toBe(5);
            expect(entity.gridY).toBe(7);
            expect(entity.size).toBe(32);
            expect(entity.hp).toBe(100);
            expect(entity.maxHp).toBe(100);
            expect(entity.mp).toBe(6);
            expect(entity.ap).toBe(2);
            expect(entity.maxMp).toBe(6);
            expect(entity.maxAp).toBe(2);
            expect(entity.aiType).toBe('test');
            expect(entity.usedSpecialThisTurn).toBe(false);
        });

        test('should generate UUID when no ID provided', () => {
            const entity = new Entity(0, 0, 16, 50, 50, 3, 1);
            expect(entity.id).toBeDefined();
            expect(typeof entity.id).toBe('string');
        });
    });

    describe('Player Entity', () => {
        test('should have correct initial properties', () => {
            expect(player.id).toBe('player');
            expect(player.gridX).toBe(2);
            expect(player.gridY).toBe(2);
            expect(player.size).toBe(28);
            expect(player.hp).toBe(100);
            expect(player.maxHp).toBe(100);
            expect(player.mp).toBe(6);
            expect(player.maxMp).toBe(6);
            expect(player.ap).toBe(2);
            expect(player.maxAp).toBe(2);
            expect(player.aiType).toBe('player');
        });

        test('should have base stats defined', () => {
            expect(player.baseMaxAp).toBe(2);
            expect(player.baseMaxMp).toBe(6);
            expect(player.baseDamage).toBe(10);
        });
    });

    describe('Boss Entity', () => {
        test('should have correct initial properties', () => {
            expect(boss.id).toBe('boss');
            expect(boss.gridX).toBe(11);
            expect(boss.gridY).toBe(11);
            expect(boss.size).toBe(36);
            expect(boss.hp).toBe(150);
            expect(boss.maxHp).toBe(150);
            expect(boss.mp).toBe(6);
            expect(boss.maxMp).toBe(6);
            expect(boss.ap).toBe(2);
            expect(boss.maxAp).toBe(2);
            expect(boss.aiType).toBe('boss');
        });
    });

    describe('createEnemy Function', () => {
        test('should create sheep enemy with correct properties', () => {
            const sheep = createEnemy('sheep', 3, 4);
            
            expect(sheep.gridX).toBe(3);
            expect(sheep.gridY).toBe(4);
            expect(sheep.size).toBe(26);
            expect(sheep.hp).toBe(50);
            expect(sheep.maxHp).toBe(50);
            expect(sheep.mp).toBe(4);
            expect(sheep.maxMp).toBe(4);
            expect(sheep.ap).toBe(1);
            expect(sheep.maxAp).toBe(1);
            expect(sheep.aiType).toBe('sheep');
            expect(sheep.image).toBe('sheep.png');
            expect(sheep.id).toContain('sheep-');
        });

        test('should create sheepist_noir enemy with correct properties', () => {
            const noir = createEnemy('sheepist_noir', 5, 6);
            
            expect(noir.gridX).toBe(5);
            expect(noir.gridY).toBe(6);
            expect(noir.size).toBe(24);
            expect(noir.hp).toBe(60);
            expect(noir.maxHp).toBe(60);
            expect(noir.mp).toBe(6);
            expect(noir.maxMp).toBe(6);
            expect(noir.ap).toBe(2);
            expect(noir.maxAp).toBe(2);
            expect(noir.aiType).toBe('sheepist_noir');
            expect(noir.image).toBe('sheepist_noir.png');
            expect(noir.id).toContain('sheepist_noir-');
        });

        test('should create chef_de_guerre enemy with correct properties', () => {
            const chef = createEnemy('chef_de_guerre', 7, 8);
            
            expect(chef.gridX).toBe(7);
            expect(chef.gridY).toBe(8);
            expect(chef.size).toBe(30);
            expect(chef.hp).toBe(100);
            expect(chef.maxHp).toBe(100);
            expect(chef.mp).toBe(4);
            expect(chef.maxMp).toBe(4);
            expect(chef.ap).toBe(2);
            expect(chef.maxAp).toBe(2);
            expect(chef.aiType).toBe('chef_de_guerre');
            expect(chef.image).toBe('chef.png');
            expect(chef.id).toContain('chef_de_guerre-');
        });

        test('should create boss enemy with correct properties', () => {
            const bossEnemy = createEnemy('boss', 10, 11);
            
            expect(bossEnemy.gridX).toBe(10);
            expect(bossEnemy.gridY).toBe(11);
            expect(bossEnemy.size).toBe(36);
            expect(bossEnemy.hp).toBe(150);
            expect(bossEnemy.maxHp).toBe(150);
            expect(bossEnemy.mp).toBe(6);
            expect(bossEnemy.maxMp).toBe(6);
            expect(bossEnemy.ap).toBe(2);
            expect(bossEnemy.maxAp).toBe(2);
            expect(bossEnemy.aiType).toBe('boss');
            expect(bossEnemy.image).toBe('boss.png');
            expect(bossEnemy.id).toContain('boss-');
        });

        test('should return null for unknown enemy type', () => {
            const unknown = createEnemy('unknown_type', 1, 1);
            expect(unknown).toBeNull();
        });
    });

    describe('findPath Function', () => {
        const mockTileValidFunction = (x, y) => {
            // Simple validation: within bounds and not obstacle positions
            if (x < 0 || x >= 5 || y < 0 || y >= 5) return false;
            if ((x === 2 && y === 2) || (x === 3 && y === 1)) return false; // Mock obstacles
            return true;
        };

        const mockEntity = { gridX: 0, gridY: 0 };
        const mockEntities = [];
        const mockGrid = [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 1, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0]
        ];

        test('should return single-tile path when start equals end', () => {
            const path = findPath(2, 2, 2, 2, mockEntity, mockTileValidFunction, mockEntities, mockGrid, 5, 5);
            expect(path).toEqual([{ x: 2, y: 2 }]);
        });

        test('should find path between valid adjacent tiles', () => {
            const path = findPath(0, 0, 1, 0, mockEntity, mockTileValidFunction, mockEntities, mockGrid, 5, 5);
            expect(path).not.toBeNull();
            expect(path.length).toBeGreaterThanOrEqual(2);
            expect(path[0]).toEqual({ x: 0, y: 0 });
            expect(path[path.length - 1]).toEqual({ x: 1, y: 0 });
        });

        test('should find path around obstacles', () => {
            const path = findPath(0, 0, 4, 4, mockEntity, mockTileValidFunction, mockEntities, mockGrid, 5, 5);
            expect(path).not.toBeNull();
            expect(path.length).toBeGreaterThan(0);
            expect(path[0]).toEqual({ x: 0, y: 0 });
            expect(path[path.length - 1]).toEqual({ x: 4, y: 4 });
        });

        test('should return null when no path exists to obstacle', () => {
            const alwaysInvalidTile = () => false;
            const path = findPath(0, 0, 2, 2, mockEntity, alwaysInvalidTile, mockEntities, mockGrid, 5, 5);
            expect(path).toBeNull();
        });

        test('should find adjacent path when adjacentToTarget is true', () => {
            const path = findPath(0, 0, 4, 4, mockEntity, mockTileValidFunction, mockEntities, mockGrid, 5, 5, true);
            if (path) {
                const lastTile = path[path.length - 1];
                const distanceToTarget = Math.abs(lastTile.x - 4) + Math.abs(lastTile.y - 4);
                expect(distanceToTarget).toBe(1);
            }
        });
    });

    describe('Entity State Management', () => {
        test('entities should start with full resources', () => {
            const sheep = createEnemy('sheep', 1, 1);
            expect(sheep.hp).toBe(sheep.maxHp);
            expect(sheep.mp).toBe(sheep.maxMp);
            expect(sheep.ap).toBe(sheep.maxAp);
        });

        test('entities should have screen position initially null', () => {
            const noir = createEnemy('sheepist_noir', 2, 2);
            expect(noir.screenX).toBeNull();
            expect(noir.screenY).toBeNull();
        });

        test('entities should start with usedSpecialThisTurn false', () => {
            const chef = createEnemy('chef_de_guerre', 3, 3);
            expect(chef.usedSpecialThisTurn).toBe(false);
        });
    });
});