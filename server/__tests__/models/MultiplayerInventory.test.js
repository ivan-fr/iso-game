/**
 * Tests for MultiplayerInventory model
 */
import { jest } from '@jest/globals';
import { MultiplayerInventory } from '../../models/MultiplayerInventory.js';
import redisManager from '../../utils/redis.js';

// Mock Redis manager
const mockRedisManager = {
    savePlayerInventory: jest.fn(),
    getPlayerInventory: jest.fn(),
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn(),
    isConnected: true
};

jest.mock('../../utils/redis.js', () => ({
    default: mockRedisManager
}));

describe('MultiplayerInventory Model', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRedisManager.savePlayerInventory.mockResolvedValue(true);
        mockRedisManager.getPlayerInventory.mockResolvedValue(null);
    });

    describe('Inventory Creation', () => {
        test('should create a new inventory with default values', () => {
            const inventory = new MultiplayerInventory('player-1');
            
            expect(inventory.playerId).toBe('player-1');
            expect(inventory.resources).toEqual({});
            expect(inventory.items).toEqual({});
            expect(inventory.equipment).toEqual({ head: null });
            expect(inventory.version).toBe(1);
        });

        test('should create inventory with existing data', () => {
            const existingData = {
                resources: { laine_sheep: 10, corne_sheep: 5 },
                items: { coiffe_sheep: 1 },
                equipment: { head: 'coiffe_sheep' },
                version: 3
            };

            const inventory = new MultiplayerInventory('player-1', existingData);
            
            expect(inventory.resources).toEqual({ laine_sheep: 10, corne_sheep: 5 });
            expect(inventory.items).toEqual({ coiffe_sheep: 1 });
            expect(inventory.equipment.head).toBe('coiffe_sheep');
            expect(inventory.version).toBe(3);
        });
    });

    describe('Resource Management', () => {
        let inventory;

        beforeEach(() => {
            inventory = new MultiplayerInventory('player-1');
        });

        test('should add resources correctly', () => {
            const result = inventory.addResource('laine_sheep', 5);
            
            expect(result).toBe(true);
            expect(inventory.resources.laine_sheep).toBe(5);
        });

        test('should accumulate resources', () => {
            inventory.addResource('laine_sheep', 3);
            inventory.addResource('laine_sheep', 2);
            
            expect(inventory.resources.laine_sheep).toBe(5);
        });

        test('should not add unknown resources', () => {
            const result = inventory.addResource('unknown_resource', 5);
            
            expect(result).toBe(false);
            expect(inventory.resources.unknown_resource).toBeUndefined();
        });

        test('should remove resources correctly', () => {
            inventory.addResource('laine_sheep', 10);
            const result = inventory.removeResource('laine_sheep', 3);
            
            expect(result).toBe(true);
            expect(inventory.resources.laine_sheep).toBe(7);
        });

        test('should not remove more resources than available', () => {
            inventory.addResource('laine_sheep', 5);
            const result = inventory.removeResource('laine_sheep', 10);
            
            expect(result).toBe(false);
            expect(inventory.resources.laine_sheep).toBe(5);
        });

        test('should delete resource when quantity reaches zero', () => {
            inventory.addResource('laine_sheep', 5);
            inventory.removeResource('laine_sheep', 5);
            
            expect(inventory.resources.laine_sheep).toBeUndefined();
        });

        test('should check resource availability', () => {
            inventory.addResource('laine_sheep', 10);
            
            expect(inventory.hasResource('laine_sheep', 5)).toBe(true);
            expect(inventory.hasResource('laine_sheep', 15)).toBe(false);
            expect(inventory.hasResource('unknown_resource', 1)).toBe(false);
        });

        test('should get resource count', () => {
            inventory.addResource('laine_sheep', 7);
            
            expect(inventory.getResourceCount('laine_sheep')).toBe(7);
            expect(inventory.getResourceCount('unknown_resource')).toBe(0);
        });
    });

    describe('Item Management', () => {
        let inventory;

        beforeEach(() => {
            inventory = new MultiplayerInventory('player-1');
        });

        test('should add items correctly', () => {
            const result = inventory.addItem('coiffe_sheep', 1);
            
            expect(result).toBe(true);
            expect(inventory.items.coiffe_sheep).toBe(1);
        });

        test('should accumulate items', () => {
            inventory.addItem('coiffe_sheep', 1);
            inventory.addItem('coiffe_sheep', 2);
            
            expect(inventory.items.coiffe_sheep).toBe(3);
        });

        test('should not add unknown items', () => {
            const result = inventory.addItem('unknown_item', 1);
            
            expect(result).toBe(false);
            expect(inventory.items.unknown_item).toBeUndefined();
        });

        test('should remove items correctly', () => {
            inventory.addItem('coiffe_sheep', 3);
            const result = inventory.removeItem('coiffe_sheep', 1);
            
            expect(result).toBe(true);
            expect(inventory.items.coiffe_sheep).toBe(2);
        });

        test('should not remove more items than available', () => {
            inventory.addItem('coiffe_sheep', 2);
            const result = inventory.removeItem('coiffe_sheep', 5);
            
            expect(result).toBe(false);
            expect(inventory.items.coiffe_sheep).toBe(2);
        });
    });

    describe('Crafting System', () => {
        let inventory;

        beforeEach(() => {
            inventory = new MultiplayerInventory('player-1');
            // Add resources needed for crafting
            inventory.addResource('laine_sheep', 100);
            inventory.addResource('laine_sheepist_noir', 50);
            inventory.addResource('corne_sheep', 50);
            inventory.addResource('corne_chef_de_guerre', 30);
            inventory.addResource('oeil_sheep', 10);
            inventory.addResource('sabot_sheep', 20);
        });

        test('should craft item successfully', async () => {
            mockRedisManager.savePlayerInventory.mockResolvedValue(true);

            const result = await inventory.craftItem('craft_coiffe_sheep');
            
            expect(result.success).toBe(true);
            expect(result.itemId).toBe('coiffe_sheep');
            expect(result.itemName).toBe('Gobbly Headgear');
            expect(inventory.items.coiffe_sheep).toBe(1);
            
            // Check that resources were consumed
            expect(inventory.resources.laine_sheep).toBe(50); // 100 - 50
            expect(inventory.resources.laine_sheepist_noir).toBe(25); // 50 - 25
        });

        test('should fail crafting with insufficient resources', async () => {
            // Remove most resources
            inventory.resources = { laine_sheep: 10 };

            const result = await inventory.craftItem('craft_coiffe_sheep');
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Missing resource');
            expect(result.missing).toBeDefined();
            expect(result.missing.resourceId).toBe('laine_sheepist_noir');
        });

        test('should fail crafting with unknown recipe', async () => {
            const result = await inventory.craftItem('unknown_recipe');
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Unknown recipe');
        });
    });

    describe('Equipment System', () => {
        let inventory;

        beforeEach(() => {
            inventory = new MultiplayerInventory('player-1');
            inventory.addItem('coiffe_sheep', 2);
            inventory.addItem('coiffe_sheep_royale', 1);
        });

        test('should equip item successfully', async () => {
            mockRedisManager.savePlayerInventory.mockResolvedValue(true);

            const result = await inventory.equipItem('coiffe_sheep');
            
            expect(result.success).toBe(true);
            expect(result.slot).toBe('head');
            expect(inventory.equipment.head).toBe('coiffe_sheep');
            expect(inventory.items.coiffe_sheep).toBe(1); // One consumed
        });

        test('should replace equipped item', async () => {
            redisManager.savePlayerInventory.mockResolvedValue(true);

            // Equip first item
            await inventory.equipItem('coiffe_sheep');
            expect(inventory.equipment.head).toBe('coiffe_sheep');
            expect(inventory.items.coiffe_sheep).toBe(1);

            // Equip second item (should replace first)
            await inventory.equipItem('coiffe_sheep_royale');
            expect(inventory.equipment.head).toBe('coiffe_sheep_royale');
            expect(inventory.items.coiffe_sheep).toBe(2); // First item returned
            expect(inventory.items.coiffe_sheep_royale).toBe(0); // Second item consumed
        });

        test('should fail to equip item not in inventory', async () => {
            inventory.items = {}; // Empty inventory

            const result = await inventory.equipItem('coiffe_sheep');
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Item not in inventory');
        });

        test('should fail to equip invalid item', async () => {
            const result = await inventory.equipItem('unknown_item');
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid equipment item');
        });

        test('should unequip item successfully', async () => {
            redisManager.savePlayerInventory.mockResolvedValue(true);

            // First equip an item
            await inventory.equipItem('coiffe_sheep');
            expect(inventory.equipment.head).toBe('coiffe_sheep');

            // Then unequip it
            const result = await inventory.unequipItem('head');
            
            expect(result.success).toBe(true);
            expect(inventory.equipment.head).toBeNull();
            expect(inventory.items.coiffe_sheep).toBe(2); // Item returned to inventory
        });

        test('should fail to unequip empty slot', async () => {
            const result = await inventory.unequipItem('head');
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Nothing equipped in that slot');
        });

        test('should calculate stat bonuses correctly', () => {
            inventory.equipment.head = 'coiffe_sheep';
            
            const damageBonus = inventory.getStatBonus('damage');
            expect(damageBonus).toBe(8); // coiffe_sheep gives +8 damage

            inventory.equipment.head = 'coiffe_sheep_royale';
            const paBonus = inventory.getStatBonus('pa');
            expect(paBonus).toBe(1); // coiffe_sheep_royale gives +1 pa
        });
    });

    describe('Drop System', () => {
        let inventory;

        beforeEach(() => {
            inventory = new MultiplayerInventory('player-1');
        });

        test('should calculate drops from defeated enemies', async () => {
            redisManager.savePlayerInventory.mockResolvedValue(true);

            // Mock random to always succeed
            const originalRandom = Math.random;
            Math.random = jest.fn(() => 0.1); // Always less than drop chances

            const defeatedEnemies = {
                sheep: 2,
                sheepist_noir: 1
            };

            const drops = await inventory.calculateDrops(defeatedEnemies);
            
            expect(drops).toBeDefined();
            expect(Object.keys(drops).length).toBeGreaterThan(0);
            
            // Should have added resources to inventory
            expect(inventory.resources.laine_sheep).toBeGreaterThan(0);

            // Restore original Math.random
            Math.random = originalRandom;
        });

        test('should handle no drops from enemies', async () => {
            redisManager.savePlayerInventory.mockResolvedValue(true);

            // Mock random to always fail
            const originalRandom = Math.random;
            Math.random = jest.fn(() => 0.9); // Always greater than drop chances

            const defeatedEnemies = {
                sheep: 1
            };

            const drops = await inventory.calculateDrops(defeatedEnemies);
            
            expect(drops).toEqual({});
            expect(Object.keys(inventory.resources)).toHaveLength(0);

            // Restore original Math.random
            Math.random = originalRandom;
        });
    });

    describe('Persistence', () => {
        test('should save inventory to Redis', async () => {
            redisManager.savePlayerInventory.mockResolvedValue(true);

            const inventory = new MultiplayerInventory('player-1');
            inventory.addResource('laine_sheep', 10);
            
            const result = await inventory.save();
            
            expect(result).toBe(true);
            expect(redisManager.savePlayerInventory).toHaveBeenCalledWith('player-1', expect.objectContaining({
                resources: expect.any(Object),
                items: expect.any(Object),
                equipment: expect.any(Object),
                version: expect.any(Number)
            }));
        });

        test('should load inventory from Redis', async () => {
            const inventoryData = {
                resources: { laine_sheep: 15, corne_sheep: 8 },
                items: { coiffe_sheep: 2 },
                equipment: { head: 'coiffe_sheep' },
                version: 5
            };

            redisManager.getPlayerInventory.mockResolvedValue(inventoryData);

            const inventory = await MultiplayerInventory.load('player-1');
            
            expect(inventory).toBeDefined();
            expect(inventory.playerId).toBe('player-1');
            expect(inventory.resources).toEqual({ laine_sheep: 15, corne_sheep: 8 });
            expect(inventory.items).toEqual({ coiffe_sheep: 2 });
            expect(inventory.equipment.head).toBe('coiffe_sheep');
            expect(inventory.version).toBe(5);
        });

        test('should create new inventory for new player', async () => {
            redisManager.getPlayerInventory.mockResolvedValue(null);

            const inventory = await MultiplayerInventory.load('new-player');
            
            expect(inventory).toBeDefined();
            expect(inventory.playerId).toBe('new-player');
            expect(inventory.resources).toEqual({});
            expect(inventory.items).toEqual({});
            expect(inventory.version).toBe(1);
        });
    });

    describe('Data Validation', () => {
        test('should validate inventory data correctly', () => {
            const inventory = new MultiplayerInventory('player-1');
            inventory.addResource('laine_sheep', 10);
            inventory.addItem('coiffe_sheep', 1);
            
            const validation = inventory.validate();
            
            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        test('should detect invalid resources', () => {
            const inventory = new MultiplayerInventory('player-1');
            inventory.resources = { 
                'unknown_resource': 5,
                'laine_sheep': -3
            };
            
            const validation = inventory.validate();
            
            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Unknown resource: unknown_resource');
            expect(validation.errors).toContain('Invalid quantity for resource laine_sheep: -3');
        });

        test('should detect invalid items', () => {
            const inventory = new MultiplayerInventory('player-1');
            inventory.items = { 
                'unknown_item': 1,
                'coiffe_sheep': -2
            };
            
            const validation = inventory.validate();
            
            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Unknown item: unknown_item');
            expect(validation.errors).toContain('Invalid quantity for item coiffe_sheep: -2');
        });

        test('should detect invalid equipment', () => {
            const inventory = new MultiplayerInventory('player-1');
            inventory.equipment = { 
                head: 'unknown_item'
            };
            
            const validation = inventory.validate();
            
            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Unknown equipped item: unknown_item in slot head');
        });
    });

    describe('Data Export', () => {
        test('should return public data', () => {
            const inventory = new MultiplayerInventory('player-1');
            inventory.addResource('laine_sheep', 10);
            inventory.addItem('coiffe_sheep', 1);
            
            const publicData = inventory.getPublicData();
            
            expect(publicData).toEqual({
                resources: { laine_sheep: 10 },
                items: { coiffe_sheep: 1 },
                equipment: { head: null },
                lastSaved: expect.any(Number),
                version: expect.any(Number)
            });
        });

        test('should return summary statistics', () => {
            const inventory = new MultiplayerInventory('player-1');
            inventory.addResource('laine_sheep', 10);
            inventory.addResource('corne_sheep', 5);
            inventory.addItem('coiffe_sheep', 2);
            inventory.equipment.head = 'coiffe_sheep';
            
            const summary = inventory.getSummary();
            
            expect(summary).toEqual({
                resourceTypes: 2,
                itemTypes: 1,
                totalResources: 15,
                totalItems: 2,
                hasEquipment: true
            });
        });
    });
});