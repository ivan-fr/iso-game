import { jest } from '@jest/globals';

// Mock localStorage for any potential use
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });
Object.defineProperty(global, 'localStorage', { value: localStorageMock });


// Mock the entire inventory module to prevent it from accessing localStorage on import
jest.mock('../inventory.js', () => ({
  __esModule: true,
  allResources: {
    wood: { id: 'wood', name: 'Wood', type: 'resource' },
    stone: { id: 'stone', name: 'Stone', type: 'resource' },
    laine_sheep: { id: 'laine_sheep', name: 'Laine de Boufton' },
    laine_sheepist_noir: { id: 'laine_sheepist_noir', name: 'Laine de Boufton Noir' },
    corne_sheep: { id: 'corne_sheep', name: 'Corne de Boufton' },
    corne_chef_de_guerre: { id: 'corne_chef_de_guerre', name: 'Corne de Chef de Guerre' },
    oeil_sheep: { id: 'oeil_sheep', name: 'Oeil de Boufton' },
    sabot_sheep: { id: 'sabot_sheep', name: 'Sabot de Boufton' },
  },
  allItems: {
    sword: { id: 'sword', name: 'Sword', type: 'equipment', slot: 'hand' },
    helmet: { id: 'helmet', name: 'Helmet', type: 'equipment', slot: 'head' },
    coiffe_sheep: { id: 'coiffe_sheep', name: 'Coiffe du Boufton', type: 'equipment', slot: 'head', stats: { damage: 8 } },
  },
  allRecipes: {
    craft_coiffe_sheep: {
      id: 'craft_coiffe_sheep',
      itemId: 'coiffe_sheep',
      ingredients: [
        { resourceId: 'laine_sheep', quantity: 50 },
        { resourceId: 'laine_sheepist_noir', quantity: 25 },
      ],
    },
  },
  default: {}, // Mock the default export which is the problematic inventoryManager instance
}));

jest.mock('../client/multiplayer.js', () => ({
  __esModule: true,
  default: {
    on: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    isConnected: true, // Assume connected for tests
    requestInventorySync: jest.fn(),
    craftItem: jest.fn(),
    equipItem: jest.fn(),
  },
}));

// Mock UI update function
global.window.updateInventoryUI = jest.fn();

import multiplayerInventoryManager, { MultiplayerInventoryManager } from '../multiplayer-inventory.js';
import multiplayerClient from '../client/multiplayer.js';

describe('MultiplayerInventoryManager', () => {
  let inventory;

  beforeEach(() => {
    jest.clearAllMocks();
    // We need to create a new instance for each test to reset its state
    inventory = new MultiplayerInventoryManager();
    // Since multiplayerClient is a singleton, we need to ensure its state is what we expect
    multiplayerClient.isConnected = true;
  });

  test('constructor initializes correctly', () => {
    expect(inventory.resources).toEqual({});
    expect(inventory.items).toEqual({});
    expect(inventory.equipment).toEqual({ head: null });
    expect(inventory.pendingChanges.size).toBe(0);
  });

  describe('Initialization and Sync', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('initialize should request sync and set up interval', () => {
      inventory.initialize();
      expect(multiplayerClient.requestInventorySync).toHaveBeenCalledTimes(1);
      
      // Fast-forward time by 30 seconds
      jest.advanceTimersByTime(30000);
      expect(multiplayerClient.requestInventorySync).toHaveBeenCalledTimes(2);

      // Fast-forward time by another 30 seconds
      jest.advanceTimersByTime(30000);
      expect(multiplayerClient.requestInventorySync).toHaveBeenCalledTimes(3);
    });

    test('cleanup should clear the sync interval', () => {
        inventory.initialize();
        expect(inventory.syncInterval).not.toBeNull();
        
        inventory.cleanup();
        expect(inventory.syncInterval).toBeNull();

        // Check that the timer is actually cleared
        jest.advanceTimersByTime(30000);
        expect(multiplayerClient.requestInventorySync).toHaveBeenCalledTimes(1); // Only the initial one
    });

    test('updateFromServer should update local data and clear pending changes', () => {
        inventory.addResource('wood', 5);
        expect(inventory.pendingChanges.size).toBe(1);

        const serverData = {
            resources: { wood: 10, stone: 5 },
            items: { sword: 1 },
            equipment: { head: 'helmet' },
            lastSaved: 123456789,
            version: 2,
        };
        inventory.updateFromServer(serverData);

        expect(inventory.resources).toEqual({ wood: 10, stone: 5 });
        expect(inventory.items).toEqual({ sword: 1 });
        expect(inventory.equipment).toEqual({ head: 'helmet' });
        expect(inventory.lastSynced).toBe(123456789);
        expect(inventory.version).toBe(2);
        expect(inventory.pendingChanges.size).toBe(0);
        expect(window.updateInventoryUI).toHaveBeenCalled();
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
        expect(inventory.getResourceCount('wood')).toBe(0);
        expect(inventory.pendingChanges.size).toBe(0);
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
      inventory.addResource('laine_sheepist_noir', 25, true);
      
      const result = inventory.craftItem('craft_coiffe_sheep');
      
      expect(result).toBe(true);
      expect(multiplayerClient.craftItem).toHaveBeenCalledWith('craft_coiffe_sheep');
      
      // Check optimistic updates
      expect(inventory.getResourceCount('laine_sheep')).toBe(0);
      expect(inventory.getResourceCount('laine_sheepist_noir')).toBe(0);
      expect(inventory.getItemCount('coiffe_sheep')).toBe(1);
    });

    test('craftItem should fail if missing resources', () => {
        const result = inventory.craftItem('craft_coiffe_sheep');
        expect(result).toBe(false);
        expect(multiplayerClient.craftItem).not.toHaveBeenCalled();
    });
  });

  describe('Equipment', () => {
    test('equipItem should send request and perform optimistic update', () => {
        inventory.addItem('helmet', 1, true);
        const result = inventory.equipItem('helmet');

        expect(result).toBe(true);
        expect(multiplayerClient.equipItem).toHaveBeenCalledWith('helmet');
        expect(inventory.getEquippedItem('head')).toBe('helmet');
        expect(inventory.getItemCount('helmet')).toBe(0);
    });

    test('equipItem should unequip previous item', () => {
        inventory.addItem('helmet', 1, true);
        inventory.addItem('coiffe_sheep', 1, true);
        inventory.equipItem('helmet'); // Equip first item

        // Now equip second item in same slot
        inventory.equipItem('coiffe_sheep');

        expect(inventory.getEquippedItem('head')).toBe('coiffe_sheep');
        expect(inventory.getItemCount('helmet')).toBe(1); // Old item is back in inventory
        expect(inventory.getItemCount('coiffe_sheep')).toBe(0);
    });

    test('unequipItem should move item to inventory', () => {
        inventory.addItem('helmet', 1, true);
        inventory.equipItem('helmet');

        const result = inventory.unequipItem('head');
        expect(result).toBe(true);
        expect(inventory.getEquippedItem('head')).toBeNull();
        expect(inventory.getItemCount('helmet')).toBe(1);
    });
  });
});


