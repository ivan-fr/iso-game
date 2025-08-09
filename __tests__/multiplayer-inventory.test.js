import { jest } from '@jest/globals';

// Mock localStorage
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

// Mock socket.io-client
const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
};
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}));

import { MultiplayerInventoryManager } from '../multiplayer-inventory.js';

describe('MultiplayerInventoryManager', () => {
  let inventory;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    window.localStorage.clear();
    inventory = new MultiplayerInventory();
  });

  test('constructor initializes correctly', () => {
    expect(inventory.resources).toEqual({});
    expect(inventory.items).toEqual({});
    expect(inventory.equipment).toEqual({ head: null });
    expect(inventory.socket).toBe(mockSocket);
  });

  test('addResource should update resources and emit event', () => {
    inventory.addResource('wood', 10);
    expect(inventory.resources.wood).toBe(10);
    expect(mockSocket.emit).toHaveBeenCalledWith('inventory_update', { resources: { wood: 10 } });

    inventory.addResource('wood', 5);
    expect(inventory.resources.wood).toBe(15);
    expect(mockSocket.emit).toHaveBeenCalledWith('inventory_update', { resources: { wood: 15 } });
  });

  test('removeResource should update resources and emit event', () => {
    inventory.addResource('wood', 20);
    inventory.removeResource('wood', 5);
    expect(inventory.resources.wood).toBe(15);
    expect(mockSocket.emit).toHaveBeenCalledWith('inventory_update', { resources: { wood: 15 } });
  });

  test('removeResource should not go below zero', () => {
    inventory.addResource('wood', 5);
    inventory.removeResource('wood', 10);
    expect(inventory.resources.wood).toBe(0);
    expect(mockSocket.emit).toHaveBeenCalledWith('inventory_update', { resources: { wood: 0 } });
  });

  test('addItem should add item to inventory and emit event', () => {
    const item = { id: 'sword', name: 'Sword' };
    inventory.addItem(item, 1);
    expect(inventory.items.sword).toEqual({ item, quantity: 1 });
    expect(mockSocket.emit).toHaveBeenCalledWith('inventory_update', { items: { sword: { item, quantity: 1 } } });
  });

  test('removeItem should remove item from inventory and emit event', () => {
    const item = { id: 'sword', name: 'Sword' };
    inventory.addItem(item, 1);
    inventory.removeItem('sword', 1);
    expect(inventory.items.sword).toBeUndefined();
    expect(mockSocket.emit).toHaveBeenCalledWith('inventory_update', { items: {} });
  });

  test('equipItem should equip an item and emit event', () => {
    const item = { id: 'helmet', name: 'Helmet', slot: 'head' };
    inventory.addItem(item, 1);
    inventory.equipItem('helmet');
    expect(inventory.equipment.head).toEqual(item);
    expect(inventory.items.helmet).toBeUndefined();
    expect(mockSocket.emit).toHaveBeenCalledWith('equipment_update', { equipment: { head: item } });
  });

  test('unequipItem should unequip an item and emit event', () => {
    const item = { id: 'helmet', name: 'Helmet', slot: 'head' };
    inventory.equipItem(item);
    inventory.unequipItem('head');
    expect(inventory.equipment.head).toBeNull();
    expect(inventory.items.helmet).toEqual({ item, quantity: 1 });
    expect(mockSocket.emit).toHaveBeenCalledWith('equipment_update', { equipment: { head: null } });
  });
});
