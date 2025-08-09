import { MultiplayerInventoryManager } from '../multiplayer-inventory.js';
import { MultiplayerClient } from '../client/multiplayer.js';

jest.mock('../client/multiplayer.js', () => {
    const mockMultiplayerClient = {
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
    };
    return {
        MultiplayerClient: {
            getInstance: jest.fn().mockReturnValue(mockMultiplayerClient),
        },
    };
});

jest.mock('../constants.js', () => ({
    ...jest.requireActual('../constants.js'),
    recipes: {
        'craft_coiffe_sheep': {
            name: 'Coiffe du Sheep',
            materials: { 'laine_sheep': 50, 'corne_sheep': 30 },
            result: { 'coiffe_sheep': 1 },
            type: 'equipment',
            slot: 'head'
        }
    },
    allItems: {
        'helmet': {
            type: 'equipment',
            slot: 'head'
        },
        'coiffe_sheep': {
            type: 'equipment',
            slot: 'head'
        }
    }
}));

describe('MultiplayerInventoryManager', () => {
    let inventory;
    let multiplayerClient;
    let mockUpdateInventoryUI;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock global functions and objects
        mockUpdateInventoryUI = jest.fn();
        global.window = {
            updateInventoryUI: mockUpdateInventoryUI,
        };
        global.localStorage = {
            getItem: jest.fn().mockReturnValue(null),
            setItem: jest.fn(),
            removeItem: jest.fn(),
        };

        multiplayerClient = MultiplayerClient.getInstance();
        inventory = MultiplayerInventoryManager.getInstance();
        inventory.initialize(multiplayerClient);
    });

    afterEach(() => {
        inventory.cleanup();
        MultiplayerInventoryManager.resetInstance(); // Clean up singleton
        jest.useRealTimers();
    });

    describe('Initialization and Sync', () => {
        test('getInstance should return a singleton instance', () => {
            const instance1 = MultiplayerInventoryManager.getInstance();
            const instance2 = MultiplayerInventoryManager.getInstance();
            expect(instance1).toBe(instance2);
        });

        test('initialize should request sync and set up interval', () => {
            jest.useFakeTimers();
            inventory.initialize(multiplayerClient);
            expect(multiplayerClient.requestInventorySync).toHaveBeenCalledTimes(1);
            
            jest.advanceTimersByTime(5000);
            expect(multiplayerClient.requestInventorySync).toHaveBeenCalledTimes(2);
        });

        test('cleanup should clear the sync interval', () => {
            jest.useFakeTimers();
            inventory.initialize(multiplayerClient);
            expect(multiplayerClient.requestInventorySync).toHaveBeenCalledTimes(1);
            
            inventory.cleanup();
            jest.advanceTimersByTime(10000);
            expect(multiplayerClient.requestInventorySync).toHaveBeenCalledTimes(1); // Should not be called again
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
          inventory.addResource('wood', 15, true); // from server, don't track
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
          
          // Check optimistic updates
          expect(inventory.getResourceCount('laine_sheep')).toBe(0);
          expect(inventory.getResourceCount('corne_sheep')).toBe(0);
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
            inventory.equipItem('another_helmet'); // Equip first item
            
            const result = inventory.equipItem('helmet');

            expect(result).toBe(true);
            expect(inventory.getEquippedItem('head')).toBe('helmet');
            expect(inventory.getItemCount('another_helmet')).toBe(1); // Previous item returned
        });

        test('unequipItem should move item to inventory', () => {
            inventory.equipItem('helmet'); // Equip it first
            
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


