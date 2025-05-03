export const allResources = {
    corne_sheep: {
        id: 'corne_sheep',
        name: "sheep Horn",
        img: 'assets/corne_sheep.png',
        type: 'resource',
    },
    corne_chef_de_guerre: {
        id: 'corne_chef_de_guerre',
        name: "War Chief Horn",
        img: 'assets/corne_chef_de_guerre.png',
        type: 'resource',
    },
    laine_sheepist_noir: {
        id: 'laine_sheepist_noir',
        name: "Black Gobbly Wool",
        img: 'assets/laine_sheepist_noir.png',
        type: 'resource',
    },
    laine_sheep: {
        id: 'laine_sheep',
        name: "Gobbly Wool",
        img: 'assets/laine_sheep.png',
        type: 'resource',
    },
    laine_sheep_royal: {
        id: 'laine_sheep_royal',
        name: "Royal Gobbly Wool",
        img: 'assets/laine_sheep_royal.png',
        type: 'resource',
    },
    cuir_sheep_royal: {
        id: 'cuir_sheep_royal',
        name: "Royal Gobbly Leather",
        img: 'assets/cuir_sheep_royal.png',
        type: 'resource',
    },
    oeil_sheep: {
        id: 'oeil_sheep',
        name: "Gobbly Eye",
        img: 'assets/oeil_sheep.png',
        type: 'resource',
    },
    sabot_sheep: {
        id: 'sabot_sheep',
        name: "Gobbly Hoof",
        img: 'assets/sabot_sheep.png',
        type: 'resource',
    },
};

export const allItems = {
    coiffe_sheep: {
        id: 'coiffe_sheep',
        name: "Gobbly Headgear",
        img: 'assets/coiffe_sheep.png',
        type: 'equipment',
        slot: 'head',
        stats: {
            damage: 8,
        },
    },
    coiffe_sheep_royale: {
        id: 'coiffe_sheep_royale',
        name: "Royal Gobbly Headgear",
        img: 'assets/coiffe_sheep_royale.png',
        type: 'equipment',
        slot: 'head',
        stats: {
            damage: 10,
            pa: 1,
        },
    },
};

export const allRecipes = {
    craft_coiffe_sheep: {
        id: 'craft_coiffe_sheep',
        itemId: 'coiffe_sheep',
        ingredients: [
            { resourceId: 'laine_sheep', quantity: 50 },
            { resourceId: 'laine_sheepist_noir', quantity: 25 },
            { resourceId: 'corne_sheep', quantity: 30 },
            { resourceId: 'corne_chef_de_guerre', quantity: 15 },
            { resourceId: 'oeil_sheep', quantity: 2 },
            { resourceId: 'sabot_sheep', quantity: 4 },
        ],
    },
    craft_coiffe_sheep_royale: {
        id: 'craft_coiffe_sheep_royale',
        itemId: 'coiffe_sheep_royale',
        ingredients: [
            { resourceId: 'laine_sheep', quantity: 75 },
            { resourceId: 'laine_sheepist_noir', quantity: 25 },
            { resourceId: 'corne_chef_de_guerre', quantity: 15 },
            { resourceId: 'laine_sheep_royal', quantity: 1 },
            { resourceId: 'cuir_sheep_royal', quantity: 1 },
            { resourceId: 'oeil_sheep', quantity: 2 },
             // Note: Sabot not needed for Royal according to original request
        ],
    },
};

const dropTable = {
    // Define drops per enemy type ID (ensure these IDs match your enemy definitions)
    sheep: [
        { resourceId: 'corne_sheep', maxDrop: 2, chance: 0.40 },
        { resourceId: 'laine_sheep', maxDrop: 1, chance: 0.80 },
        { resourceId: 'oeil_sheep', maxDrop: 2, chance: 0.05 },
        { resourceId: 'sabot_sheep', maxDrop: 4, chance: 0.04 },
    ],
    sheepist_noir: [
        { resourceId: 'corne_sheep', maxDrop: 2, chance: 0.40 }, // Same as sheep?
        { resourceId: 'laine_sheepist_noir', maxDrop: 1, chance: 0.80 },
        { resourceId: 'oeil_sheep', maxDrop: 2, chance: 0.05 },
        { resourceId: 'sabot_sheep', maxDrop: 4, chance: 0.04 },
    ],
    chef_de_guerre: [
        { resourceId: 'corne_chef_de_guerre', maxDrop: 2, chance: 0.40 },
        { resourceId: 'oeil_sheep', maxDrop: 2, chance: 0.05 },
        { resourceId: 'sabot_sheep', maxDrop: 4, chance: 0.04 },
    ],
    sheep_royal: [ // Boss
        { resourceId: 'laine_sheep_royal', maxDrop: 1, chance: 0.1 },
        { resourceId: 'cuir_sheep_royal', maxDrop: 1, chance: 0.1 },
        { resourceId: 'oeil_sheep', maxDrop: 2, chance: 0.05 },
        { resourceId: 'sabot_sheep', maxDrop: 4, chance: 0.04 },
    ],
};

class InventoryManager {
    constructor() {
        this.resources = JSON.parse(localStorage.getItem('inventory_resources')) || {};
        this.items = JSON.parse(localStorage.getItem('inventory_items')) || {};
        this.equipment = JSON.parse(localStorage.getItem('inventory_equipment')) || { head: null /* Add other slots if needed */ };
    }

    save() {
        localStorage.setItem('inventory_resources', JSON.stringify(this.resources));
        localStorage.setItem('inventory_items', JSON.stringify(this.items));
        localStorage.setItem('inventory_equipment', JSON.stringify(this.equipment));
    }

    // --- Resource Management ---
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
            return false; // Not enough resources
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

    // --- Item Management ---
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
            return false; // Not enough items
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

    // --- Crafting ---
    craftItem(recipeId) {
        const recipe = allRecipes[recipeId];
        if (!recipe) return false;

        // Check if all ingredients are available
        for (const ing of recipe.ingredients) {
            if (!this.hasResource(ing.resourceId, ing.quantity)) {
                console.log(`Missing resource: ${ing.resourceId} (Need ${ing.quantity}, Have ${this.getResourceCount(ing.resourceId)})`);
                return false; // Missing ingredients
            }
        }

        // Consume ingredients (skip save/update here)
        for (const ing of recipe.ingredients) {
            this.removeResource(ing.resourceId, ing.quantity, true);
        }

        // Add crafted item (skip save/update here)
        this.addItem(recipe.itemId, 1, true);

        // Save and update UI ONCE at the end
        this.save();
        this.updateUI();

        console.log(`Crafted: ${allItems[recipe.itemId].name}`);
        return true;
    }

    // --- Equipment ---
    equipItem(itemId) {
        const item = allItems[itemId];
        if (!item || item.type !== 'equipment' || !item.slot) return false;
        if (!this.hasItem(itemId, 1)) return false; // Don't have the item

        const currentSlot = item.slot;
        const previouslyEquipped = this.equipment[currentSlot];

        // If something else is equipped in that slot, unequip it first
        if (previouslyEquipped && previouslyEquipped !== itemId) {
             this.addItem(previouslyEquipped, 1, true); // Add the old item back (skip save/update)
        }

        // Equip the new item
        this.equipment[currentSlot] = itemId;
        this.removeItem(itemId, 1, true); // Remove one instance from inventory (skip save/update)

        console.log(`Equipped ${item.name} in ${currentSlot} slot.`);
        // Save and update UI ONCE at the end
        this.save();
        this.updateUI(); // Update inventory display only
        return true;
    }

    unequipItem(slot) {
        const equippedItemId = this.equipment[slot];
        if (!equippedItemId) return false; // Nothing to unequip

        // Add the item back to inventory (skip save/update)
        this.addItem(equippedItemId, 1, true);

        // Clear the slot
        this.equipment[slot] = null;

        console.log(`Unequipped item from ${slot} slot.`);
        // Save and update UI ONCE at the end
        this.save();
        this.updateUI(); // Update inventory display only
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

    // --- Drops ---
    calculateDrops(defeatedEnemiesCount) {
        const totalDrops = {};
        for (const enemyType in defeatedEnemiesCount) {
            const count = defeatedEnemiesCount[enemyType];
            if (count > 0) {
                const table = dropTable[enemyType];
                if (table) {
                    for (let i = 0; i < count; i++) {
                        table.forEach(dropInfo => {
                            if (Math.random() < dropInfo.chance) {
                                const quantity = Math.floor(Math.random() * dropInfo.maxDrop) + 1;
                                // Add resource directly to inventory
                                this.addResource(dropInfo.resourceId, quantity);
                                // Tally drops for display (addResource updates inventory, this tracks *what* dropped)
                                totalDrops[dropInfo.resourceId] = (totalDrops[dropInfo.resourceId] || 0) + quantity;
                                console.log(`Dropped: ${allResources[dropInfo.resourceId]?.name}`);
                            }
                        });
                    }
                }
            }
        }
        // Don't call updateUI here - it's called by addResource
        // this.updateUI(); 
        return totalDrops; // Return the summary of what dropped
    }

    // --- UI Update Trigger ---
    updateUI() {
        // Call the globally exposed function to update the inventory panel display
        if (typeof window.updateInventoryUI === 'function') {
            window.updateInventoryUI();
        } else {
            console.warn("window.updateInventoryUI is not defined. Cannot refresh inventory display.");
        }
        // REMOVED: No need to trigger stat updates from here
        // if (typeof window.applyEquipmentStats === 'function') {
        //     // This assumes player object is globally accessible, which might be fragile
        //     // Consider passing the player object if this needs to be called
        //     window.applyEquipmentStats(); 
        // } else {
        //     console.warn("window.applyEquipmentStats is not defined. Cannot update stats.");
        // }
    }
}

// --- Instantiate and Export a Single Instance ---
const inventoryManager = new InventoryManager();

export default inventoryManager;

// Optionally attach to window for easier debugging or access from non-module scripts
// window.inventoryManager = inventoryManager; 