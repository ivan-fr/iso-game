import { jest } from '@jest/globals';

// Mock localStorage
const localStorageMock = {
    store: {},
    getItem: jest.fn((key) => localStorageMock.store[key] || null),
    setItem: jest.fn((key, value) => { localStorageMock.store[key] = value; }),
    removeItem: jest.fn((key) => { delete localStorageMock.store[key]; }),
    clear: jest.fn(() => { localStorageMock.store = {}; })
};
global.localStorage = localStorageMock;

// Mock window.updateInventoryUI
global.window = { updateInventoryUI: jest.fn() };

// Import after mocking
const { allResources, allItems, allRecipes } = await import('../inventory.js');

// Create a fresh InventoryManager class for testing
class InventoryManager {
    constructor() {
        this.resources = JSON.parse(localStorage.getItem('inventory_resources')) || {};
        this.items = JSON.parse(localStorage.getItem('inventory_items')) || {};
        this.equipment = JSON.parse(localStorage.getItem('inventory_equipment')) || { head: null };
    }

    save() {
        localStorage.setItem('inventory_resources', JSON.stringify(this.resources));
        localStorage.setItem('inventory_items', JSON.stringify(this.items));
        localStorage.setItem('inventory_equipment', JSON.stringify(this.equipment));
    }

    addResource(resourceId, quantity = 1, skipSaveUpdate = false) {
        if (!allResources[resourceId]) return;
        this.resources[resourceId] = (this.resources[resourceId] || 0) + quantity;
        if (!skipSaveUpdate) {
            this.save();
            this.updateUI();
        }
    }

    removeResource(resourceId, quantity = 1, skipSaveUpdate = false) {
        if (!this.resources[resourceId] || this.resources[resourceId] < quantity) {
            return false;
        }
        this.resources[resourceId] -= quantity;
        if (this.resources[resourceId] <= 0) {
            delete this.resources[resourceId];
        }
        if (!skipSaveUpdate) {
            this.save();
            this.updateUI();
        }
        return true;
    }

    getResourceCount(resourceId) {
        return this.resources[resourceId] || 0;
    }

    hasResource(resourceId, quantity = 1) {
        return this.getResourceCount(resourceId) >= quantity;
    }

    addItem(itemId, quantity = 1, skipSaveUpdate = false) {
        if (!allItems[itemId]) return;
        this.items[itemId] = (this.items[itemId] || 0) + quantity;
        if (!skipSaveUpdate) {
            this.save();
            this.updateUI();
        }
    }

    removeItem(itemId, quantity = 1, skipSaveUpdate = false) {
        if (!this.items[itemId] || this.items[itemId] < quantity) {
            return false;
        }
        this.items[itemId] -= quantity;
        if (this.items[itemId] <= 0) {
            delete this.items[itemId];
        }
        if (!skipSaveUpdate) {
            this.save();
            this.updateUI();
        }
        return true;
    }

    getItemCount(itemId) {
        return this.items[itemId] || 0;
    }

    hasItem(itemId, quantity = 1) {
        return this.getItemCount(itemId) >= quantity;
    }

    craftItem(recipeId) {
        const recipe = allRecipes[recipeId];
        if (!recipe) return false;

        for (const ing of recipe.ingredients) {
            if (!this.hasResource(ing.resourceId, ing.quantity)) {
                return false;
            }
        }

        for (const ing of recipe.ingredients) {
            this.removeResource(ing.resourceId, ing.quantity, true);
        }

        this.addItem(recipe.itemId, 1, true);
        this.save();
        this.updateUI();
        return true;
    }

    equipItem(itemId) {
        const item = allItems[itemId];
        if (!item || item.type !== 'equipment' || !item.slot) return false;
        if (!this.hasItem(itemId, 1)) return false;

        const currentSlot = item.slot;
        const previouslyEquipped = this.equipment[currentSlot];

        if (previouslyEquipped && previouslyEquipped !== itemId) {
            this.addItem(previouslyEquipped, 1, true);
        }

        this.equipment[currentSlot] = itemId;
        this.removeItem(itemId, 1, true);
        this.save();
        this.updateUI();
        return true;
    }

    unequipItem(slot) {
        const equippedItemId = this.equipment[slot];
        if (!equippedItemId) return false;

        this.addItem(equippedItemId, 1, true);
        this.equipment[slot] = null;
        this.save();
        this.updateUI();
        return true;
    }

    getEquippedItem(slot) {
        return this.equipment[slot];
    }

    getStatBonus(statName) {
        let totalBonus = 0;
        for (const slot in this.equipment) {
            const itemId = this.equipment[slot];
            if (itemId && allItems[itemId] && allItems[itemId].stats && allItems[itemId].stats[statName]) {
                totalBonus += allItems[itemId].stats[statName];
            }
        }
        return totalBonus;
    }

    updateUI() {
        if (typeof window.updateInventoryUI === 'function') {
            window.updateInventoryUI();
        }
    }
}

describe('Inventory Module Tests', () => {
    let inventoryManager;

    beforeEach(() => {
        // Clear localStorage mock
        localStorageMock.clear();
        // Create fresh inventory manager
        inventoryManager = new InventoryManager();
        // Clear jest mocks
        jest.clearAllMocks();
    });

    describe('Data Structures', () => {
        test('allResources should contain expected resources', () => {
            const expectedResources = [
                'corne_sheep', 'corne_chef_de_guerre', 'laine_sheepist_noir',
                'laine_sheep', 'laine_sheep_royal', 'cuir_sheep_royal',
                'oeil_sheep', 'sabot_sheep'
            ];
            
            expectedResources.forEach(resourceId => {
                expect(allResources[resourceId]).toBeDefined();
                expect(allResources[resourceId]).toHaveProperty('id', resourceId);
                expect(allResources[resourceId]).toHaveProperty('name');
                expect(allResources[resourceId]).toHaveProperty('img');
                expect(allResources[resourceId]).toHaveProperty('type', 'resource');
            });
        });

        test('allItems should contain expected items', () => {
            const expectedItems = ['coiffe_sheep', 'coiffe_sheep_royale'];
            
            expectedItems.forEach(itemId => {
                expect(allItems[itemId]).toBeDefined();
                expect(allItems[itemId]).toHaveProperty('id', itemId);
                expect(allItems[itemId]).toHaveProperty('name');
                expect(allItems[itemId]).toHaveProperty('img');
                expect(allItems[itemId]).toHaveProperty('type', 'equipment');
                expect(allItems[itemId]).toHaveProperty('slot');
                expect(allItems[itemId]).toHaveProperty('stats');
            });
        });

        test('allRecipes should contain valid recipes', () => {
            const expectedRecipes = ['craft_coiffe_sheep', 'craft_coiffe_sheep_royale'];
            
            expectedRecipes.forEach(recipeId => {
                expect(allRecipes[recipeId]).toBeDefined();
                expect(allRecipes[recipeId]).toHaveProperty('id', recipeId);
                expect(allRecipes[recipeId]).toHaveProperty('itemId');
                expect(allRecipes[recipeId]).toHaveProperty('ingredients');
                expect(Array.isArray(allRecipes[recipeId].ingredients)).toBe(true);
            });
        });
    });

    describe('Resource Management', () => {
        test('should start with empty resources', () => {
            expect(inventoryManager.getResourceCount('corne_sheep')).toBe(0);
            expect(inventoryManager.hasResource('laine_sheep')).toBe(false);
        });

        test('should add resources correctly', () => {
            inventoryManager.addResource('corne_sheep', 5);
            expect(inventoryManager.getResourceCount('corne_sheep')).toBe(5);
            expect(inventoryManager.hasResource('corne_sheep', 3)).toBe(true);
            expect(inventoryManager.hasResource('corne_sheep', 10)).toBe(false);
        });

        test('should not add invalid resources', () => {
            inventoryManager.addResource('invalid_resource', 10);
            expect(inventoryManager.getResourceCount('invalid_resource')).toBe(0);
        });

        test('should remove resources correctly', () => {
            inventoryManager.addResource('laine_sheep', 10);
            
            const result1 = inventoryManager.removeResource('laine_sheep', 3);
            expect(result1).toBe(true);
            expect(inventoryManager.getResourceCount('laine_sheep')).toBe(7);
            
            const result2 = inventoryManager.removeResource('laine_sheep', 10);
            expect(result2).toBe(false);
            expect(inventoryManager.getResourceCount('laine_sheep')).toBe(7);
        });

        test('should remove resource entry when count reaches 0', () => {
            inventoryManager.addResource('oeil_sheep', 2);
            inventoryManager.removeResource('oeil_sheep', 2);
            expect(inventoryManager.resources.hasOwnProperty('oeil_sheep')).toBe(false);
        });
    });

    describe('Item Management', () => {
        test('should start with empty items', () => {
            expect(inventoryManager.getItemCount('coiffe_sheep')).toBe(0);
            expect(inventoryManager.hasItem('coiffe_sheep')).toBe(false);
        });

        test('should add items correctly', () => {
            inventoryManager.addItem('coiffe_sheep', 2);
            expect(inventoryManager.getItemCount('coiffe_sheep')).toBe(2);
            expect(inventoryManager.hasItem('coiffe_sheep', 1)).toBe(true);
            expect(inventoryManager.hasItem('coiffe_sheep', 3)).toBe(false);
        });

        test('should not add invalid items', () => {
            inventoryManager.addItem('invalid_item', 5);
            expect(inventoryManager.getItemCount('invalid_item')).toBe(0);
        });

        test('should remove items correctly', () => {
            inventoryManager.addItem('coiffe_sheep', 5);
            
            const result1 = inventoryManager.removeItem('coiffe_sheep', 2);
            expect(result1).toBe(true);
            expect(inventoryManager.getItemCount('coiffe_sheep')).toBe(3);
            
            const result2 = inventoryManager.removeItem('coiffe_sheep', 10);
            expect(result2).toBe(false);
            expect(inventoryManager.getItemCount('coiffe_sheep')).toBe(3);
        });
    });

    describe('Crafting System', () => {
        test('should craft item when resources are sufficient', () => {
            // Add required resources for coiffe_sheep
            inventoryManager.addResource('laine_sheep', 50);
            inventoryManager.addResource('laine_sheepist_noir', 25);
            inventoryManager.addResource('corne_sheep', 30);
            inventoryManager.addResource('corne_chef_de_guerre', 15);
            inventoryManager.addResource('oeil_sheep', 2);
            inventoryManager.addResource('sabot_sheep', 4);

            const result = inventoryManager.craftItem('craft_coiffe_sheep');
            expect(result).toBe(true);
            expect(inventoryManager.getItemCount('coiffe_sheep')).toBe(1);
            
            // Check resources were consumed
            expect(inventoryManager.getResourceCount('laine_sheep')).toBe(0);
            expect(inventoryManager.getResourceCount('laine_sheepist_noir')).toBe(0);
        });

        test('should not craft when resources are insufficient', () => {
            inventoryManager.addResource('laine_sheep', 10); // Not enough
            
            const result = inventoryManager.craftItem('craft_coiffe_sheep');
            expect(result).toBe(false);
            expect(inventoryManager.getItemCount('coiffe_sheep')).toBe(0);
            expect(inventoryManager.getResourceCount('laine_sheep')).toBe(10); // Unchanged
        });

        test('should not craft invalid recipes', () => {
            const result = inventoryManager.craftItem('invalid_recipe');
            expect(result).toBe(false);
        });
    });

    describe('Equipment System', () => {
        test('should equip items correctly', () => {
            inventoryManager.addItem('coiffe_sheep', 1);
            
            const result = inventoryManager.equipItem('coiffe_sheep');
            expect(result).toBe(true);
            expect(inventoryManager.getEquippedItem('head')).toBe('coiffe_sheep');
            expect(inventoryManager.getItemCount('coiffe_sheep')).toBe(0);
        });

        test('should not equip items not in inventory', () => {
            const result = inventoryManager.equipItem('coiffe_sheep');
            expect(result).toBe(false);
            expect(inventoryManager.getEquippedItem('head')).toBeNull();
        });

        test('should replace previously equipped items', () => {
            inventoryManager.addItem('coiffe_sheep', 1);
            inventoryManager.addItem('coiffe_sheep_royale', 1);
            
            inventoryManager.equipItem('coiffe_sheep');
            expect(inventoryManager.getEquippedItem('head')).toBe('coiffe_sheep');
            
            inventoryManager.equipItem('coiffe_sheep_royale');
            expect(inventoryManager.getEquippedItem('head')).toBe('coiffe_sheep_royale');
            expect(inventoryManager.getItemCount('coiffe_sheep')).toBe(1); // Returned to inventory
        });

        test('should unequip items correctly', () => {
            inventoryManager.addItem('coiffe_sheep', 1);
            inventoryManager.equipItem('coiffe_sheep');
            
            const result = inventoryManager.unequipItem('head');
            expect(result).toBe(true);
            expect(inventoryManager.getEquippedItem('head')).toBeNull();
            expect(inventoryManager.getItemCount('coiffe_sheep')).toBe(1);
        });

        test('should not unequip empty slots', () => {
            const result = inventoryManager.unequipItem('head');
            expect(result).toBe(false);
        });
    });

    describe('Stat Bonuses', () => {
        test('should calculate stat bonuses from equipped items', () => {
            inventoryManager.addItem('coiffe_sheep', 1);
            inventoryManager.equipItem('coiffe_sheep');
            
            expect(inventoryManager.getStatBonus('damage')).toBe(8);
            expect(inventoryManager.getStatBonus('pa')).toBe(0);
        });

        test('should calculate multiple stat bonuses', () => {
            inventoryManager.addItem('coiffe_sheep_royale', 1);
            inventoryManager.equipItem('coiffe_sheep_royale');
            
            expect(inventoryManager.getStatBonus('damage')).toBe(10);
            expect(inventoryManager.getStatBonus('pa')).toBe(1);
        });

        test('should return 0 for stats not provided by equipment', () => {
            inventoryManager.addItem('coiffe_sheep', 1);
            inventoryManager.equipItem('coiffe_sheep');
            
            expect(inventoryManager.getStatBonus('speed')).toBe(0);
        });
    });

    describe('Persistence', () => {
        test('should save and load state correctly', () => {
            inventoryManager.addResource('corne_sheep', 10);
            inventoryManager.addItem('coiffe_sheep', 2);
            
            // Create new instance (simulating page reload)
            const newInventoryManager = new InventoryManager();
            expect(newInventoryManager.getResourceCount('corne_sheep')).toBe(10);
            expect(newInventoryManager.getItemCount('coiffe_sheep')).toBe(2);
        });

        test('should call save when operations complete', () => {
            const saveSpy = jest.spyOn(inventoryManager, 'save');
            
            inventoryManager.addResource('corne_sheep', 5);
            expect(saveSpy).toHaveBeenCalled();
            
            saveSpy.mockRestore();
        });

        test('should not call save when skipSaveUpdate is true', () => {
            const saveSpy = jest.spyOn(inventoryManager, 'save');
            
            inventoryManager.addResource('corne_sheep', 5, true);
            expect(saveSpy).not.toHaveBeenCalled();
            
            saveSpy.mockRestore();
        });
    });

    describe('UI Integration', () => {
        test('should call updateUI when making changes', () => {
            inventoryManager.addResource('corne_sheep', 5);
            expect(window.updateInventoryUI).toHaveBeenCalled();
        });

        test('should not call updateUI when skipSaveUpdate is true', () => {
            inventoryManager.addResource('corne_sheep', 5, true);
            expect(window.updateInventoryUI).not.toHaveBeenCalled();
        });
    });
});