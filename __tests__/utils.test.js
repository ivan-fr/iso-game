import { jest } from '@jest/globals';

// Import our utility modules
import { 
    GameError, 
    ValidationError, 
    PathfindingError, 
    EntityError, 
    ErrorLogger, 
    Validator, 
    safeExecute, 
    safeExecuteAsync, 
    retry 
} from '../utils/errors.js';

import { 
    MathUtils, 
    ArrayUtils, 
    ObjectUtils, 
    GameUtils, 
    PerformanceUtils 
} from '../utils/helpers.js';

import { gameState } from '../state/gameState.js';

// Mock localStorage for tests
const localStorageMock = {
    store: {},
    getItem: jest.fn((key) => localStorageMock.store[key] || null),
    setItem: jest.fn((key, value) => { localStorageMock.store[key] = value; }),
    removeItem: jest.fn((key) => { delete localStorageMock.store[key]; }),
    clear: jest.fn(() => { localStorageMock.store = {}; })
};
global.localStorage = localStorageMock;

describe('Utils Module Tests', () => {

    describe('Error Handling', () => {
        beforeEach(() => {
            ErrorLogger.clearLogs();
        });

        test('GameError should create proper error with context', () => {
            const error = new GameError('Test error', 'TEST_CODE', { test: true });
            
            expect(error.name).toBe('GameError');
            expect(error.message).toBe('Test error');
            expect(error.code).toBe('TEST_CODE');
            expect(error.context.test).toBe(true);
            expect(error.timestamp).toBeDefined();
        });

        test('ValidationError should extend GameError', () => {
            const error = new ValidationError('Invalid field', 'testField', 'invalidValue');
            
            expect(error instanceof GameError).toBe(true);
            expect(error.name).toBe('ValidationError');
            expect(error.context.field).toBe('testField');
            expect(error.context.value).toBe('invalidValue');
        });

        test('ErrorLogger should log and store errors', () => {
            const error = new GameError('Test error');
            
            ErrorLogger.log(error);
            
            const logs = ErrorLogger.getLogs();
            expect(logs).toHaveLength(1);
            expect(logs[0].error.message).toBe('Test error');
        });

        test('Validator should validate entities correctly', () => {
            const validEntity = { id: 'test', gridX: 5, gridY: 3, hp: 100 };
            
            expect(() => {
                Validator.validateEntity(validEntity);
            }).not.toThrow();
            
            expect(() => {
                Validator.validateEntity(null);
            }).toThrow(ValidationError);
            
            expect(() => {
                Validator.validateEntity({ id: 'test' }); // missing required fields
            }).toThrow(ValidationError);
        });

        test('safeExecute should handle errors gracefully', () => {
            const successFn = () => 'success';
            const errorFn = () => { throw new Error('test error'); };
            
            expect(safeExecute(successFn, 'test')).toBe('success');
            expect(safeExecute(errorFn, 'test', 'default')).toBe('default');
        });

        test('retry should attempt multiple times', async () => {
            let attemptCount = 0;
            const failingFn = () => {
                attemptCount++;
                if (attemptCount < 3) {
                    throw new Error('Not ready yet');
                }
                return 'success';
            };
            
            const result = await retry(failingFn, 3, 10, 'test operation');
            expect(result).toBe('success');
            expect(attemptCount).toBe(3);
        });
    });

    describe('Math Utils', () => {
        test('manhattanDistance should calculate correctly', () => {
            expect(MathUtils.manhattanDistance(0, 0, 3, 4)).toBe(7);
            expect(MathUtils.manhattanDistance(1, 1, 1, 1)).toBe(0);
            expect(MathUtils.manhattanDistance(-2, -3, 2, 3)).toBe(10);
        });

        test('euclideanDistance should calculate correctly', () => {
            expect(MathUtils.euclideanDistance(0, 0, 3, 4)).toBe(5);
            expect(MathUtils.euclideanDistance(1, 1, 1, 1)).toBe(0);
        });

        test('clamp should constrain values', () => {
            expect(MathUtils.clamp(5, 0, 10)).toBe(5);
            expect(MathUtils.clamp(-5, 0, 10)).toBe(0);
            expect(MathUtils.clamp(15, 0, 10)).toBe(10);
        });

        test('lerp should interpolate correctly', () => {
            expect(MathUtils.lerp(0, 10, 0.5)).toBe(5);
            expect(MathUtils.lerp(0, 10, 0)).toBe(0);
            expect(MathUtils.lerp(0, 10, 1)).toBe(10);
        });

        test('randomInt should generate integers in range', () => {
            for (let i = 0; i < 10; i++) {
                const random = MathUtils.randomInt(5, 15);
                expect(Number.isInteger(random)).toBe(true);
                expect(random).toBeGreaterThanOrEqual(5);
                expect(random).toBeLessThanOrEqual(15);
            }
        });
    });

    describe('Array Utils', () => {
        test('shuffle should randomize array order', () => {
            const original = [1, 2, 3, 4, 5];
            const shuffled = ArrayUtils.shuffle(original);
            
            expect(shuffled).toHaveLength(original.length);
            expect(shuffled).toEqual(expect.arrayContaining(original));
            // Note: There's a small chance shuffled equals original, but unlikely
        });

        test('unique should remove duplicates', () => {
            expect(ArrayUtils.unique([1, 2, 2, 3, 3, 4])).toEqual([1, 2, 3, 4]);
            
            const objects = [
                { id: 1, name: 'a' },
                { id: 2, name: 'b' },
                { id: 1, name: 'c' }
            ];
            const unique = ArrayUtils.unique(objects, obj => obj.id);
            expect(unique).toHaveLength(2);
            expect(unique[0].id).toBe(1);
            expect(unique[1].id).toBe(2);
        });

        test('chunk should split arrays correctly', () => {
            const chunked = ArrayUtils.chunk([1, 2, 3, 4, 5], 2);
            expect(chunked).toEqual([[1, 2], [3, 4], [5]]);
        });

        test('minBy and maxBy should find extreme values', () => {
            const items = [{ val: 3 }, { val: 1 }, { val: 5 }];
            
            const min = ArrayUtils.minBy(items, item => item.val);
            const max = ArrayUtils.maxBy(items, item => item.val);
            
            expect(min.val).toBe(1);
            expect(max.val).toBe(5);
        });
    });

    describe('Object Utils', () => {
        test('deepClone should create independent copy', () => {
            const original = { a: 1, b: { c: 2 } };
            const cloned = ObjectUtils.deepClone(original);
            
            cloned.b.c = 3;
            expect(original.b.c).toBe(2);
            expect(cloned.b.c).toBe(3);
        });

        test('deepMerge should merge objects recursively', () => {
            const obj1 = { a: 1, b: { c: 2 } };
            const obj2 = { b: { d: 3 }, e: 4 };
            
            const merged = ObjectUtils.deepMerge(obj1, obj2);
            
            expect(merged).toEqual({
                a: 1,
                b: { c: 2, d: 3 },
                e: 4
            });
        });

        test('get should access nested properties safely', () => {
            const obj = { a: { b: { c: 'value' } } };
            
            expect(ObjectUtils.get(obj, 'a.b.c')).toBe('value');
            expect(ObjectUtils.get(obj, 'a.b.d', 'default')).toBe('default');
            expect(ObjectUtils.get(obj, 'x.y.z')).toBeUndefined();
        });

        test('set should create nested properties', () => {
            const obj = {};
            ObjectUtils.set(obj, 'a.b.c', 'value');
            
            expect(obj.a.b.c).toBe('value');
        });
    });

    describe('Game Utils', () => {
        test('areAdjacent should detect adjacent entities', () => {
            const entity1 = { gridX: 5, gridY: 3 };
            const entity2 = { gridX: 5, gridY: 4 };
            const entity3 = { gridX: 7, gridY: 3 };
            
            expect(GameUtils.areAdjacent(entity1, entity2)).toBe(true);
            expect(GameUtils.areAdjacent(entity1, entity3)).toBe(false);
        });

        test('isInRange should check attack range correctly', () => {
            const attacker = { gridX: 0, gridY: 0 };
            const target1 = { gridX: 3, gridY: 0 };
            const target2 = { gridX: 5, gridY: 0 };
            
            expect(GameUtils.isInRange(attacker, target1, 3)).toBe(true);
            expect(GameUtils.isInRange(attacker, target2, 3)).toBe(false);
        });

        test('isAlive should check entity status', () => {
            expect(GameUtils.isAlive({ hp: 50 })).toBe(true);
            expect(GameUtils.isAlive({ hp: 0 })).toBe(false);
            expect(GameUtils.isAlive({ hp: 50, _isDying: true })).toBe(false);
            expect(GameUtils.isAlive(null)).toBe(false);
        });

        test('calculateDamage should vary within range', () => {
            const baseDamage = 100;
            const damages = [];
            
            for (let i = 0; i < 10; i++) {
                damages.push(GameUtils.calculateDamage(baseDamage, 0.2));
            }
            
            damages.forEach(damage => {
                expect(damage).toBeGreaterThanOrEqual(80);
                expect(damage).toBeLessThanOrEqual(120);
            });
        });

        test('generateId should create unique IDs', () => {
            const id1 = GameUtils.generateId('test');
            const id2 = GameUtils.generateId('test');
            
            expect(id1).toMatch(/^test-/);
            expect(id2).toMatch(/^test-/);
            expect(id1).not.toBe(id2);
        });

        test('sanitizeEntity should clean entity data', () => {
            const dirtyEntity = {
                id: 'test',
                gridX: 5.7,
                gridY: 3.2,
                hp: 150,
                maxHp: 1000,
                mp: -5,
                ap: 25
            };
            
            const clean = GameUtils.sanitizeEntity(dirtyEntity);
            
            expect(clean.gridX).toBe(6);
            expect(clean.gridY).toBe(3);
            expect(clean.hp).toBeLessThanOrEqual(999);
            expect(clean.maxHp).toBeLessThanOrEqual(999);
            expect(clean.mp).toBeGreaterThanOrEqual(0);
            expect(clean.ap).toBeLessThanOrEqual(10);
        });
    });

    describe('Performance Utils', () => {
        test('measureTime should return execution time', () => {
            const { result, time } = PerformanceUtils.measureTime(() => {
                // Simulate some work
                let sum = 0;
                for (let i = 0; i < 1000; i++) {
                    sum += i;
                }
                return sum;
            }, 'test-operation');
            
            expect(result).toBe(499500);
            expect(time).toBeGreaterThan(0);
        });

        test('debounce should delay function execution', (done) => {
            let callCount = 0;
            const debouncedFn = PerformanceUtils.debounce(() => {
                callCount++;
            }, 50);
            
            debouncedFn();
            debouncedFn();
            debouncedFn();
            
            expect(callCount).toBe(0);
            
            setTimeout(() => {
                expect(callCount).toBe(1);
                done();
            }, 100);
        });

        test('throttle should limit function calls', (done) => {
            let callCount = 0;
            const throttledFn = PerformanceUtils.throttle(() => {
                callCount++;
            }, 50);
            
            throttledFn();
            throttledFn();
            throttledFn();
            
            expect(callCount).toBe(1);
            
            setTimeout(() => {
                throttledFn();
                expect(callCount).toBe(2);
                done();
            }, 100);
        });
    });

    describe('Game State Management', () => {
        beforeEach(() => {
            // Reset game state for each test
            gameState.setCurrentTurn('player');
            gameState.setGameOver(false);
        });

        test('should initialize with default state', () => {
            expect(gameState.currentTurn).toBe('player');
            expect(gameState.gameOver).toBe(false);
            expect(gameState.currentRoomId).toBe(-1);
        });

        test('should validate state changes', () => {
            expect(() => {
                gameState.setCurrentTurn('invalid');
            }).toThrow();
            
            expect(() => {
                gameState.setCurrentTurn('enemy');
            }).not.toThrow();
        });

        test('should handle entity management', () => {
            const testPlayer = {
                id: 'player',
                gridX: 5,
                gridY: 3,
                hp: 100,
                maxHp: 100,
                mp: 6,
                ap: 2
            };
            
            gameState.setPlayer(testPlayer);
            expect(gameState.player).toEqual(testPlayer);
            
            const entities = gameState.getAllEntities();
            expect(entities).toContain(testPlayer);
        });

        test('should manage projectiles', () => {
            const projectile = { id: 'proj1', x: 10, y: 20 };
            
            gameState.addProjectile(projectile);
            expect(gameState.projectiles).toContain(projectile);
            
            gameState.removeProjectile('proj1');
            expect(gameState.projectiles).not.toContain(projectile);
        });

        test('should track defeated enemies', () => {
            gameState.incrementDefeatedCount('sheep');
            gameState.incrementDefeatedCount('sheep');
            
            expect(gameState.defeatedEnemiesCount.sheep).toBe(2);
        });

        test('should support state subscription', (done) => {
            const unsubscribe = gameState.subscribe(['currentTurn'], (changes) => {
                expect(changes['currentTurn'].new).toBe('enemy');
                unsubscribe();
                done();
            });
            
            gameState.setCurrentTurn('enemy');
        });
    });
});