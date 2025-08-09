import { 
    computesheepPlan,
    computeBossPlan,
    computesheepistNoirPlan,
    computeChefPlan
} from '../ai.js';

import { jest } from '@jest/globals';

// Simple mock implementations
const mockIsTileValidAndFree = jest.fn(() => true);
const mockHasLineOfSight = jest.fn(() => true);
const mockFindPath = jest.fn(() => [{ x: 3, y: 3 }, { x: 2, y: 2 }, { x: 1, y: 1 }]);
const mockGetAdjacentTiles = jest.fn(() => [
    { x: 4, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 4 }, { x: 3, y: 2 }
]);
const mockGetTilesInRangeBFS = jest.fn(() => [
    { x: 4, y: 3, cost: 1 }, { x: 2, y: 3, cost: 1 }
]);

describe('AI Module Tests', () => {
    let mockSheep, mockBoss, mockPlayer, mockAllEntities, mockMapGrid;

    beforeEach(() => {
        // Create mock entities
        mockSheep = {
            id: 'sheep-1',
            gridX: 3,
            gridY: 3,
            hp: 50,
            mp: 4,
            ap: 1,
            aiType: 'sheep'
        };

        mockBoss = {
            id: 'boss',
            gridX: 5,
            gridY: 5,
            hp: 150,
            mp: 6,
            ap: 2,
            aiType: 'boss'
        };

        mockPlayer = {
            id: 'player',
            gridX: 1,
            gridY: 1,
            hp: 100,
            mp: 6,
            ap: 2,
            aiType: 'player'
        };

        mockAllEntities = [mockPlayer, mockSheep, mockBoss];

        mockMapGrid = [
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0]
        ];
    });

    describe('computesheepPlan', () => {
        test('should return attack plan when sheep is adjacent to player', () => {
            mockSheep.gridX = 2;
            mockSheep.gridY = 1;
            
            const plan = computesheepPlan(mockSheep, mockAllEntities, mockMapGrid, 6, 6);
            
            expect(plan.initialAttack).toBe(true);
            expect(plan.postMoveAttack).toBe(false);
            expect(plan.movePath).toEqual([]);
            expect(plan.moveCost).toBe(0);
        });

        test('should return empty plan when no player found', () => {
            const entitiesWithoutPlayer = [mockSheep, mockBoss];
            
            const plan = computesheepPlan(mockSheep, entitiesWithoutPlayer, mockMapGrid, 6, 6);
            
            expect(plan.movePath).toEqual([]);
            expect(plan.initialAttack).toBe(false);
            expect(plan.postMoveAttack).toBe(false);
            expect(plan.moveCost).toBe(0);
        });

        test('should return valid plan structure', () => {
            const plan = computesheepPlan(mockSheep, mockAllEntities, mockMapGrid, 6, 6);
            
            expect(plan).toHaveProperty('movePath');
            expect(plan).toHaveProperty('initialAttack');
            expect(plan).toHaveProperty('postMoveAttack');
            expect(plan).toHaveProperty('moveCost');
            expect(typeof plan.initialAttack).toBe('boolean');
            expect(typeof plan.postMoveAttack).toBe('boolean');
            expect(typeof plan.moveCost).toBe('number');
            expect(Array.isArray(plan.movePath)).toBe(true);
        });
    });

    describe('computeBossPlan', () => {
        test('should return melee plan when boss is adjacent to player', () => {
            mockBoss.gridX = 2;
            mockBoss.gridY = 1;
            
            const plan = computeBossPlan(mockBoss, mockAllEntities, mockMapGrid, 6, 6);
            
            expect(plan.initialMelee).toBe(true);
        });

        test('should return valid plan structure', () => {
            const plan = computeBossPlan(mockBoss, mockAllEntities, mockMapGrid, 6, 6);
            
            expect(plan).toHaveProperty('initialMelee');
            expect(plan).toHaveProperty('movePath');
            expect(plan).toHaveProperty('postMoveMelee');
            expect(plan).toHaveProperty('rangedAttack');
            expect(plan).toHaveProperty('rangedTarget');
            expect(plan).toHaveProperty('moveCost');
            expect(typeof plan.initialMelee).toBe('boolean');
            expect(typeof plan.postMoveMelee).toBe('boolean');
            expect(typeof plan.rangedAttack).toBe('boolean');
            expect(typeof plan.moveCost).toBe('number');
        });
    });

    describe('computesheepistNoirPlan', () => {
        let mockSheepistNoir;

        beforeEach(() => {
            mockSheepistNoir = {
                id: 'sheepist_noir-1',
                gridX: 4,
                gridY: 4,
                hp: 60,
                mp: 6,
                ap: 2,
                aiType: 'sheepist_noir',
                usedSpecialThisTurn: false
            };
        });

        test('should return valid plan structure', () => {
            const plan = computesheepistNoirPlan(mockSheepistNoir, mockAllEntities, mockMapGrid, 6, 6);
            
            expect(plan).toHaveProperty('actions');
            expect(Array.isArray(plan.actions)).toBe(true);
        });

        test('should return empty actions when no target found', () => {
            const entitiesWithoutPlayer = [mockSheepistNoir, mockBoss];
            
            const plan = computesheepistNoirPlan(mockSheepistNoir, entitiesWithoutPlayer, mockMapGrid, 6, 6);
            
            expect(plan.actions).toEqual([]);
        });
    });

    describe('computeChefPlan', () => {
        let mockChef, mockAlly;

        beforeEach(() => {
            mockChef = {
                id: 'chef-1',
                gridX: 6,
                gridY: 6,
                hp: 100,
                mp: 4,
                ap: 2,
                aiType: 'chef_de_guerre',
                usedSpecialThisTurn: false
            };

            mockAlly = {
                id: 'sheep-ally',
                gridX: 7,
                gridY: 7,
                hp: 30,
                mp: 2,
                maxMp: 4,
                aiType: 'sheep'
            };

            mockAllEntities = [mockPlayer, mockChef, mockAlly];
        });

        test('should return array of actions', () => {
            const actions = computeChefPlan(mockChef, mockAllEntities, mockMapGrid, 6, 6);
            
            expect(Array.isArray(actions)).toBe(true);
        });

        test('should return valid action structures', () => {
            const actions = computeChefPlan(mockChef, mockAllEntities, mockMapGrid, 6, 6);
            
            actions.forEach(action => {
                expect(action).toHaveProperty('type');
                expect(typeof action.type).toBe('string');
                if (action.cost) {
                    expect(typeof action.cost).toBe('object');
                }
            });
        });
    });

    describe('Edge Cases', () => {
        test('should handle null/undefined entities', () => {
            // This test demonstrates the function behavior with null input
            // In practice, null entities would be filtered out before calling AI functions
            expect(() => {
                computesheepPlan(null, mockAllEntities, mockMapGrid, 6, 6);
            }).toThrow();
        });

        test('should handle empty entity arrays', () => {
            const plan = computesheepPlan(mockSheep, [], mockMapGrid, 6, 6);
            expect(plan.movePath).toEqual([]);
            expect(plan.initialAttack).toBe(false);
        });

        test('should handle invalid grid dimensions', () => {
            expect(() => {
                computesheepPlan(mockSheep, mockAllEntities, mockMapGrid, 0, 0);
            }).not.toThrow();
        });
    });

    describe('Resource Management', () => {
        test('sheep should not exceed available MP in plans', () => {
            mockSheep.mp = 2;
            
            const plan = computesheepPlan(mockSheep, mockAllEntities, mockMapGrid, 6, 6);
            
            expect(plan.moveCost).toBeLessThanOrEqual(mockSheep.mp);
        });

        test('boss should consider AP in plans', () => {
            mockBoss.ap = 1;
            
            const plan = computeBossPlan(mockBoss, mockAllEntities, mockMapGrid, 6, 6);
            
            expect(plan).toBeDefined();
            expect(typeof plan.initialMelee).toBe('boolean');
        });
    });
});