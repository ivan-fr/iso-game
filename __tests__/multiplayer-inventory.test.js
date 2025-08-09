import { jest } from '@jest/globals';
import { MultiplayerInventoryManager } from '../multiplayer-inventory.js';
import multiplayerClient from '../client/multiplayer.js';

// Mock dependencies before any other imports
jest.mock('../client/multiplayer.js', () => ({
    __esModule: true,
    default: {
        init: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
        requestInventorySync: jest.fn(),
        craftItem: jest.fn(),
        equipItem: jest.fn(),
        unequipItem: jest.fn(),
        isConnected: true,
        socket: {
            emit: jest.fn(),
        },
    }
}));

jest.mock('../inventory.js', () => ({
    allResources: {
        'wood': { name: 'Wood' },
        'stone': { name: 'Stone' },
        'laine_sheep': { name: 'Laine de Sheep' },
        'corne_sheep': { name: 'Corne de Sheep' },
    },
    allItems: {
        'sword': { name: 'Sword', type: 'weapon' },
        'helmet': { name: 'Helmet', type: 'equipment', slot: 'head' },
        'another_helmet': { name: 'Another Helmet', type: 'equipment', slot: 'head' },
        'coiffe_sheep': { name: 'Coiffe du Sheep', type: 'equipment', slot: 'head' },
        'non_existent_item': { name: 'Non Existent', type: 'junk' }
    },
    allRecipes: {
        'craft_coiffe_sheep': {
            name: 'Coiffe du Sheep',
            ingredients: [
                { resourceId: 'laine_sheep', quantity: 50 },
                { resourceId: 'corne_sheep', quantity: 30 }
            ],
            itemId: 'coiffe_sheep',
        }
    }
}));

describe('MultiplayerInventoryManager', () => {
    let inventory;
    let mockUpdateInventoryUI;
    let originalConsole;

    beforeAll(() => {
        originalConsole = { ...console };
        console.log = jest.fn();
        console.warn = jest.fn();
        console.error = jest.fn();
    });

    afterAll(() => {
        global.console = originalConsole;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        MultiplayerInventoryManager.resetInstance();

        mockUpdateInventoryUI = jest.fn();
        global.window = {
            updateInventoryUI: mockUpdateInventoryUI,
            ...global.window,
        };
        
        inventory = MultiplayerInventoryManager.getInstance();
        inventory.initialize();
    });

    afterEach(() => {
        inventory.cleanup();
        jest.useRealTimers();
    });

    describe('Initialization and Sync', () => {
        test('getInstance should return a singleton instance', () => {
            const instance1 = MultiplayerInventoryManager.getInstance();
            expect(instance1).toBe(inventory);
        });

        test('initialize should request sync and set up interval', () => {
            jest.useFakeTimers();
            MultiplayerInventoryManager.resetInstance();
            inventory = MultiplayerInventoryManager.getInstance();
            inventory.initialize();

            expect(multiplayerClient.requestInventorySync).toHaveBeenCalledTimes(1);
            
            jest.advanceTimersByTime(30000);
            expect(multiplayerClient.requestInventorySync).toHaveBeenCalledTimes(2);
        });

        test('cleanup should clear the sync interval', () => {
            jest.useFakeTimers();
            inventory.initialize(); // Called once here
            inventory.cleanup();
            jest.advanceTimersByTime(60000);
            expect(multiplayerClient.requestInventorySync).toHaveBeenCalledTimes(1);
        });

        test('updateFromServer should update local data and clear pending changes', () => {
            inventory.addResource('wood', 5);
            expect(inventory.pendingChanges.size).toBe(1);

            const serverData = {
                resources: { wood: 10, stone: 5 },
                items: { sword: 1 },
                equipment: { head: 'helmet' },
            };
            inventory.updateFromServer(serverData);

            expect(inventory.getResourceCount('wood')).toBe(10);
            expect(inventory.getResourceCount('stone')).toBe(5);
            expect(inventory.getItemCount('sword')).toBe(1);
            expect(inventory.getEquippedItem('head')).toBe('helmet');
            expect(inventory.pendingChanges.size).toBe(0);
            expect(mockUpdateInventoryUI).toHaveBeenCalled();
        });
    });

    describe('Resource Management', () => {
        test('addResource performs optimistic update and tracks change', () => {
          const result = inventory.addResource('wood', 10);
          expect(result).toBe(true);
          expect(inventory.getResourceCount('wood')).toBe(10);
          expect(inventory.pendingChanges.has('add_resource_wood_10')).toBe(true);
          expect(window.updateInventoryUI).toHaveBeenCalled();
        });
    
        test('removeResource performs optimistic update and tracks change', () => {
          inventory.addResource('wood', 15, true);
          const result = inventory.removeResource('wood', 5);
          expect(result).toBe(true);
          expect(inventory.getResourceCount('wood')).toBe(10);
          expect(inventory.pendingChanges.has('remove_resource_wood_5')).toBe(true);
        });
    
        test('removeResource should fail if not enough resources', () => {
          const result = inventory.removeResource('wood', 5);
          expect(result).toBe(false);
        });
      });
    
      describe('Item Management', () => {
        test('addItem performs optimistic update and tracks change', () => {
          inventory.addItem('sword', 1);
          expect(inventory.getItemCount('sword')).toBe(1);
          expect(inventory.pendingChanges.has('add_item_sword_1')).toBe(true);
        });
    
        test('removeItem performs optimistic update and tracks change', () => {
          inventory.addItem('sword', 2, true);
          inventory.removeItem('sword', 1);
          expect(inventory.getItemCount('sword')).toBe(1);
          expect(inventory.pendingChanges.has('remove_item_sword_1')).toBe(true);
        });
      });
    
      describe('Crafting', () => {
        test('craftItem should send request and perform optimistic update', () => {
          inventory.addResource('laine_sheep', 50, true);
          inventory.addResource('corne_sheep', 30, true);
          
          const result = inventory.craftItem('craft_coiffe_sheep');
          
          expect(result).toBe(true);
          expect(multiplayerClient.craftItem).toHaveBeenCalledWith('craft_coiffe_sheep');
          expect(inventory.getResourceCount('laine_sheep')).toBe(0);
          expect(inventory.getResourceCount('corne_sheep')).toBe(0);
          expect(inventory.getItemCount('coiffe_sheep')).toBe(1);
        });
    
        test('craftItem should fail if missing resources', () => {
            const result = inventory.craftItem('craft_coiffe_sheep');
            expect(result).toBe(false);
            expect(multiplayerClient.craftItem).not.toHaveBeenCalled();
        });
      });
    
      describe('Equipment', () => {
        beforeEach(() => {
            inventory.addItem('helmet', 1, true);
        });

        test('equipItem should send request and perform optimistic update', () => {
            const result = inventory.equipItem('helmet');
            expect(result).toBe(true);
            expect(multiplayerClient.equipItem).toHaveBeenCalledWith('helmet');
            expect(inventory.getEquippedItem('head')).toBe('helmet');
            expect(inventory.getItemCount('helmet')).toBe(0);
        });

        test('equipItem should fail for invalid item', () => {
            const result = inventory.equipItem('non_existent_item');
            expect(result).toBe(false);
        });

        test('equipItem should unequip previous item', () => {
            inventory.addItem('another_helmet', 1, true);
            inventory.equipItem('another_helmet');
            
            const result = inventory.equipItem('helmet');

            expect(result).toBe(true);
            expect(inventory.getEquippedItem('head')).toBe('helmet');
            expect(inventory.getItemCount('another_helmet')).toBe(1);
        });

        test('unequipItem should move item to inventory', () => {
            inventory.equipItem('helmet');
            
            const result = inventory.unequipItem('head');
            expect(result).toBe(true);
            expect(inventory.getEquippedItem('head')).toBeNull();
            expect(inventory.getItemCount('helmet')).toBe(1);
        });

        test('unequipItem should fail for empty slot', () => {
            const result = inventory.unequipItem('body');
            expect(result).toBe(false);
        });
    });
});


