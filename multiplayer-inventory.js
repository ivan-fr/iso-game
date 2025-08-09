/**
 * Multiplayer-compatible inventory system
 * Extends the original inventory to work with server synchronization
 */
import { allResources, allItems, allRecipes } from './inventory.js';

let instance = null;

export class MultiplayerInventoryManager {
    constructor() {
        if (instance) {
            return instance;
        }
        // Server-synced data
        this.resources = {};
        this.items = {};
        this.equipment = { head: null };
        this.lastSynced = 0;
        this.version = 1;
        
        // Local cache for optimistic updates
        this.pendingChanges = new Set();
        
        // Sync interval
        this.syncInterval = null;

        // Multiplayer client will be injected
        this.multiplayerClient = null;
        
        instance = this;
    }

    static getInstance() {
        if (!instance) {
            instance = new MultiplayerInventoryManager();
        }
        return instance;
    }

    static resetInstance() {
        instance = null;
    }

    /**
     * Initialize the multiplayer inventory system
     * @param {object} client - The multiplayer client instance
     */
    initialize(client) {
        this.multiplayerClient = client;

        // Request initial sync from server
        this.requestSync();
        
        // Set up periodic sync (every 30 seconds)
        this.syncInterval = setInterval(() => {
            this.requestSync();
        }, 30000);
        
        console.log('[MultiplayerInventory] Initialized');
    }

    /**
     * Clean up when disconnecting
     */
    cleanup() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    /**
     * Request inventory sync from server
     */
    requestSync() {
        if (this.multiplayerClient && this.multiplayerClient.isConnected) {
            this.multiplayerClient.requestInventorySync();
        }
    }

    /**
     * Update local inventory from server data
     */
    updateFromServer(serverData) {
        this.resources = { ...serverData.resources };
        this.items = { ...serverData.items };
        this.equipment = { ...serverData.equipment };
        this.lastSynced = serverData.lastSaved || Date.now();
        this.version = serverData.version || 1;
        
        // Clear pending changes that are now synced
        this.pendingChanges.clear();
        
        // Update UI
        this.updateUI();
        
        console.log('[MultiplayerInventory] Updated from server (version ' + this.version + ')');
    }

    // --- Resource Management ---
    addResource(resourceId, quantity = 1, fromServer = false) {
        if (!allResources[resourceId]) return false;
        
        // Optimistic update
        this.resources[resourceId] = (this.resources[resourceId] || 0) + quantity;
        
        if (!fromServer) {
            this.pendingChanges.add(`add_resource_${resourceId}_${quantity}`);
            // Note: For now, we trust local updates. In a full implementation,
            // you'd want to send this to the server for validation
        }
        
        this.updateUI();
        return true;
    }

    removeResource(resourceId, quantity = 1, fromServer = false) {
        if (!this.resources[resourceId] || this.resources[resourceId] < quantity) {
            return false; // Not enough resources
        }
        
        // Optimistic update
        this.resources[resourceId] -= quantity;
        if (this.resources[resourceId] <= 0) {
            delete this.resources[resourceId];
        }
        
        if (!fromServer) {
            this.pendingChanges.add(`remove_resource_${resourceId}_${quantity}`);
        }
        
        this.updateUI();
        return true;
    }

    getResourceCount(resourceId) {
        return this.resources[resourceId] || 0;
    }

    hasResource(resourceId, quantity = 1) {
        return this.getResourceCount(resourceId) >= quantity;
    }

    // --- Item Management ---
    addItem(itemId, quantity = 1, fromServer = false) {
        if (!allItems[itemId]) return false;
        
        this.items[itemId] = (this.items[itemId] || 0) + quantity;
        
        if (!fromServer) {
            this.pendingChanges.add(`add_item_${itemId}_${quantity}`);
        }
        
        this.updateUI();
        return true;
    }

    removeItem(itemId, quantity = 1, fromServer = false) {
        if (!this.items[itemId] || this.items[itemId] < quantity) {
            return false;
        }
        
        this.items[itemId] -= quantity;
        if (this.items[itemId] <= 0) {
            delete this.items[itemId];
        }
        
        if (!fromServer) {
            this.pendingChanges.add(`remove_item_${itemId}_${quantity}`);
        }
        
        this.updateUI();
        return true;
    }

    getItemCount(itemId) {
        return this.items[itemId] || 0;
    }

    hasItem(itemId, quantity = 1) {
        return this.getItemCount(itemId) >= quantity;
    }

    // --- Crafting ---
    craftItem(recipeId) {
        const recipe = allRecipes[recipeId];
        if (!recipe) {
            console.warn('[MultiplayerInventory] Unknown recipe:', recipeId);
            return false;
        }

        // Check if all ingredients are available
        for (const ing of recipe.ingredients) {
            if (!this.hasResource(ing.resourceId, ing.quantity)) {
                console.log(`[MultiplayerInventory] Missing resource: ${ing.resourceId} (Need ${ing.quantity}, Have ${this.getResourceCount(ing.resourceId)})`);
                return false;
            }
        }

        // Send craft request to server
        if (this.multiplayerClient && this.multiplayerClient.isConnected) {
            this.multiplayerClient.craftItem(recipeId);
            
            // Optimistic update - assume it will succeed
            for (const ing of recipe.ingredients) {
                this.removeResource(ing.resourceId, ing.quantity, false);
            }
            this.addItem(recipe.itemId, 1, false);
            
            console.log(`[MultiplayerInventory] Sent craft request for: ${allItems[recipe.itemId].name}`);
            return true;
        } else {
            console.warn('[MultiplayerInventory] Not connected to server, cannot craft');
            return false;
        }
    }

    // --- Equipment ---
    equipItem(itemId) {
        const item = allItems[itemId];
        if (!item || item.type !== 'equipment' || !item.slot) {
            console.warn('[MultiplayerInventory] Invalid equipment item:', itemId);
            return false;
        }
        
        if (!this.hasItem(itemId, 1)) {
            console.warn('[MultiplayerInventory] Item not in inventory:', itemId);
            return false;
        }

        // Send equip request to server
        if (this.multiplayerClient && this.multiplayerClient.isConnected) {
            this.multiplayerClient.equipItem(itemId);
            
            // Optimistic update
            const currentSlot = item.slot;
            const previouslyEquipped = this.equipment[currentSlot];

            if (previouslyEquipped && previouslyEquipped !== itemId) {
                this.addItem(previouslyEquipped, 1, false);
            }

            this.equipment[currentSlot] = itemId;
            this.removeItem(itemId, 1, false);
            
            this.updateUI();
            console.log(`[MultiplayerInventory] Equipped ${item.name} in ${currentSlot} slot`);
            return true;
        } else {
            console.warn('[MultiplayerInventory] Not connected to server, cannot equip');
            return false;
        }
    }

    unequipItem(slot) {
        const equippedItemId = this.equipment[slot];
        if (!equippedItemId) {
            console.warn('[MultiplayerInventory] Nothing equipped in slot:', slot);
            return false;
        }

        // For now, handle unequip locally (could add server sync)
        this.addItem(equippedItemId, 1, false);
        this.equipment[slot] = null;
        
        this.updateUI();
        console.log(`[MultiplayerInventory] Unequipped item from ${slot} slot`);
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

    // --- Drops (handled server-side now) ---
    calculateDrops(defeatedEnemiesCount) {
        console.log('[MultiplayerInventory] Drop calculation is now handled server-side');
        // In multiplayer, drops are calculated on the server to prevent cheating
        // This method is kept for compatibility but doesn't do anything
        return {};
    }

    // --- UI Updates ---
    updateUI() {
        // Call the globally exposed function to update the inventory panel display
        if (typeof window.updateInventoryUI === 'function') {
            window.updateInventoryUI();
        } else {
            console.warn("[MultiplayerInventory] window.updateInventoryUI is not defined. Cannot refresh inventory display.");
        }
    }

    // --- Data Export ---
    getPublicData() {
        return {
            resources: { ...this.resources },
            items: { ...this.items },
            equipment: { ...this.equipment },
            lastSynced: this.lastSynced,
            version: this.version,
            pendingChanges: this.pendingChanges.size
        };
    }

    // --- Compatibility Methods ---
    // These methods maintain compatibility with the existing single-player code
    
    save() {
        // In multiplayer, saving is handled by server sync
        console.log('[MultiplayerInventory] Save requested - syncing with server');
        this.requestSync();
    }

    // Make it compatible with the original InventoryManager interface
    getAllResources() {
        return { ...this.resources };
    }

    getAllItems() {
        return { ...this.items };
    }

    getAllEquipment() {
        return { ...this.equipment };
    }
}

// Global functions for server communication
window.syncInventoryFromServer = function(inventoryData) {
    MultiplayerInventoryManager.getInstance().updateFromServer(inventoryData);
};

window.handleCraftResult = function(result) {
    const inventory = MultiplayerInventoryManager.getInstance();
    if (result.success) {
        console.log(`[MultiplayerInventory] Craft successful: ${result.itemName}`);
        // Inventory will be synced from server automatically
    } else {
        console.error(`[MultiplayerInventory] Craft failed: ${result.error}`);
        // Refresh inventory to revert optimistic updates
        inventory.requestSync();
    }
};

window.handleEquipResult = function(result) {
    const inventory = MultiplayerInventoryManager.getInstance();
    if (result.success) {
        console.log(`[MultiplayerInventory] Equip successful`);
    } else {
        console.error(`[MultiplayerInventory] Equip failed: ${result.error}`);
        // Refresh inventory to revert optimistic updates
        inventory.requestSync();
    }
};

// Export for module usage
export default MultiplayerInventoryManager;

// Also make it globally available for backward compatibility
window.MultiplayerInventoryManager = MultiplayerInventoryManager;