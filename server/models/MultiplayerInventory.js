/**
 * Multiplayer inventory system with Redis persistence
 */
import { v4 as uuidv4 } from 'uuid';
import { PlayerError, ErrorLogger } from '../utils/errors.js';
import redisManager from '../utils/redis.js';

// Import game data from client side (these should be moved to shared location)
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
        ],
    },
};

const dropTable = {
    sheep: [
        { resourceId: 'corne_sheep', maxDrop: 2, chance: 0.40 },
        { resourceId: 'laine_sheep', maxDrop: 1, chance: 0.80 },
        { resourceId: 'oeil_sheep', maxDrop: 2, chance: 0.05 },
        { resourceId: 'sabot_sheep', maxDrop: 4, chance: 0.04 },
    ],
    sheepist_noir: [
        { resourceId: 'corne_sheep', maxDrop: 2, chance: 0.40 },
        { resourceId: 'laine_sheepist_noir', maxDrop: 1, chance: 0.80 },
        { resourceId: 'oeil_sheep', maxDrop: 2, chance: 0.05 },
        { resourceId: 'sabot_sheep', maxDrop: 4, chance: 0.04 },
    ],
    chef_de_guerre: [
        { resourceId: 'corne_chef_de_guerre', maxDrop: 2, chance: 0.40 },
        { resourceId: 'oeil_sheep', maxDrop: 2, chance: 0.05 },
        { resourceId: 'sabot_sheep', maxDrop: 4, chance: 0.04 },
    ],
    sheep_royal: [
        { resourceId: 'laine_sheep_royal', maxDrop: 1, chance: 0.1 },
        { resourceId: 'cuir_sheep_royal', maxDrop: 1, chance: 0.1 },
        { resourceId: 'oeil_sheep', maxDrop: 2, chance: 0.05 },
        { resourceId: 'sabot_sheep', maxDrop: 4, chance: 0.04 },
    ],
};

export class MultiplayerInventory {
    constructor(playerId, data = {}) {
        this.playerId = playerId;
        this.resources = data.resources || {};
        this.items = data.items || {};
        this.equipment = data.equipment || { head: null };
        this.lastSaved = data.lastSaved || 0;
        this.version = data.version || 1; // For conflict resolution
    }

    /**
     * Loads player inventory from Redis
     */
    static async load(playerId) {
        if (!redisManager.isConnected) {
            console.warn(`[Inventory] Redis not connected. Creating a temporary inventory for player ${playerId}.`);
            return new MultiplayerInventory(playerId);
        }
        try {
            const data = await redisManager.getPlayerInventory(playerId);
            
            if (!data) {
                // Create new inventory for new player
                console.log(`[Inventory] Creating new inventory for player ${playerId}`);
                return new MultiplayerInventory(playerId);
            }
            
            console.log(`[Inventory] Loaded inventory for player ${playerId}`);
            return new MultiplayerInventory(playerId, data);
        } catch (error) {
            ErrorLogger.log(new PlayerError(`Failed to load inventory: ${error.message}`, { playerId, error: error.message }));
            return new MultiplayerInventory(playerId); // Return empty inventory on error
        }
    }

    /**
     * Saves inventory to Redis
     */
    async save() {
        if (!redisManager.isConnected) {
            console.warn(`[Inventory] Redis not connected. Skipping save for player ${this.playerId}.`);
            return false;
        }
        try {
            this.lastSaved = Date.now();
            this.version++;
            
            const data = {
                resources: this.resources,
                items: this.items,
                equipment: this.equipment,
                lastSaved: this.lastSaved,
                version: this.version
            };
            
            const saved = await redisManager.savePlayerInventory(this.playerId, data);
            
            if (saved) {
                console.log(`[Inventory] Saved inventory for player ${this.playerId} (version ${this.version})`);
            }
            
            return saved;
        } catch (error) {
            ErrorLogger.log(new PlayerError(`Failed to save inventory: ${error.message}`, { playerId: this.playerId, error: error.message }));
            return false;
        }
    }

    // --- Resource Management ---
    addResource(resourceId, quantity = 1) {
        if (!allResources[resourceId]) {
            console.warn(`[Inventory] Unknown resource: ${resourceId}`);
            return false;
        }
        
        this.resources[resourceId] = (this.resources[resourceId] || 0) + quantity;
        console.log(`[Inventory] Added ${quantity} ${resourceId} to player ${this.playerId}`);
        return true;
    }

    removeResource(resourceId, quantity = 1) {
        if (!this.resources[resourceId] || this.resources[resourceId] < quantity) {
            return false; // Not enough resources
        }
        
        this.resources[resourceId] -= quantity;
        if (this.resources[resourceId] <= 0) {
            delete this.resources[resourceId];
        }
        
        console.log(`[Inventory] Removed ${quantity} ${resourceId} from player ${this.playerId}`);
        return true;
    }

    getResourceCount(resourceId) {
        return this.resources[resourceId] || 0;
    }

    hasResource(resourceId, quantity = 1) {
        return this.getResourceCount(resourceId) >= quantity;
    }

    // --- Item Management ---
    addItem(itemId, quantity = 1) {
        if (!allItems[itemId]) {
            console.warn(`[Inventory] Unknown item: ${itemId}`);
            return false;
        }
        
        this.items[itemId] = (this.items[itemId] || 0) + quantity;
        console.log(`[Inventory] Added ${quantity} ${itemId} to player ${this.playerId}`);
        return true;
    }

    removeItem(itemId, quantity = 1) {
        if (!this.items[itemId] || this.items[itemId] < quantity) {
            return false; // Not enough items
        }
        
        this.items[itemId] -= quantity;
        if (this.items[itemId] <= 0) {
            delete this.items[itemId];
        }
        
        console.log(`[Inventory] Removed ${quantity} ${itemId} from player ${this.playerId}`);
        return true;
    }

    getItemCount(itemId) {
        return this.items[itemId] || 0;
    }

    hasItem(itemId, quantity = 1) {
        return this.getItemCount(itemId) >= quantity;
    }

    // --- Crafting ---
    async craftItem(recipeId) {
        const recipe = allRecipes[recipeId];
        if (!recipe) {
            console.log(`[Inventory] Unknown recipe: ${recipeId}`);
            return { success: false, error: 'Unknown recipe' };
        }

        // Check if all ingredients are available
        for (const ing of recipe.ingredients) {
            if (!this.hasResource(ing.resourceId, ing.quantity)) {
                console.log(`[Inventory] Missing resource: ${ing.resourceId} (Need ${ing.quantity}, Have ${this.getResourceCount(ing.resourceId)})`);
                return { 
                    success: false, 
                    error: `Missing resource: ${allResources[ing.resourceId]?.name || ing.resourceId}`,
                    missing: {
                        resourceId: ing.resourceId,
                        needed: ing.quantity,
                        have: this.getResourceCount(ing.resourceId)
                    }
                };
            }
        }

        // Consume ingredients
        for (const ing of recipe.ingredients) {
            this.removeResource(ing.resourceId, ing.quantity);
        }

        // Add crafted item
        this.addItem(recipe.itemId, 1);

        // Save to Redis
        await this.save();

        console.log(`[Inventory] Player ${this.playerId} crafted: ${allItems[recipe.itemId].name}`);
        return { 
            success: true, 
            itemId: recipe.itemId,
            itemName: allItems[recipe.itemId].name
        };
    }

    // --- Equipment ---
    async equipItem(itemId) {
        const item = allItems[itemId];
        if (!item || item.type !== 'equipment' || !item.slot) {
            return { success: false, error: 'Invalid equipment item' };
        }
        
        if (!this.hasItem(itemId, 1)) {
            return { success: false, error: 'Item not in inventory' };
        }

        const currentSlot = item.slot;
        const previouslyEquipped = this.equipment[currentSlot];

        // If something else is equipped in that slot, unequip it first
        if (previouslyEquipped && previouslyEquipped !== itemId) {
            this.addItem(previouslyEquipped, 1);
        }

        // Equip the new item
        this.equipment[currentSlot] = itemId;
        this.removeItem(itemId, 1);

        // Save to Redis
        await this.save();

        console.log(`[Inventory] Player ${this.playerId} equipped ${item.name} in ${currentSlot} slot`);
        return { success: true, item: item, slot: currentSlot };
    }

    async unequipItem(slot) {
        const equippedItemId = this.equipment[slot];
        if (!equippedItemId) {
            return { success: false, error: 'Nothing equipped in that slot' };
        }

        // Add the item back to inventory
        this.addItem(equippedItemId, 1);

        // Clear the slot
        this.equipment[slot] = null;

        // Save to Redis
        await this.save();

        console.log(`[Inventory] Player ${this.playerId} unequipped item from ${slot} slot`);
        return { success: true, item: allItems[equippedItemId] };
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
    async calculateDrops(defeatedEnemiesCount) {
        const totalDrops = {};
        let hasNewDrops = false;
        
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
                                // Tally drops for display
                                totalDrops[dropInfo.resourceId] = (totalDrops[dropInfo.resourceId] || 0) + quantity;
                                hasNewDrops = true;
                                console.log(`[Inventory] Player ${this.playerId} got drop: ${quantity}x ${allResources[dropInfo.resourceId]?.name}`);
                            }
                        });
                    }
                }
            }
        }
        
        if (hasNewDrops) {
            await this.save();
        }
        
        return totalDrops;
    }

    // --- Data Export ---
    getPublicData() {
        return {
            resources: { ...this.resources },
            items: { ...this.items },
            equipment: { ...this.equipment },
            lastSaved: this.lastSaved,
            version: this.version
        };
    }

    // Get summary data for UI
    getSummary() {
        const resourceCount = Object.keys(this.resources).length;
        const itemCount = Object.keys(this.items).length;
        const totalResources = Object.values(this.resources).reduce((sum, count) => sum + count, 0);
        const totalItems = Object.values(this.items).reduce((sum, count) => sum + count, 0);
        
        return {
            resourceTypes: resourceCount,
            itemTypes: itemCount,
            totalResources,
            totalItems,
            hasEquipment: Object.values(this.equipment).some(item => item !== null)
        };
    }

    // Validate inventory data
    validate() {
        const errors = [];

        // Validate resources
        for (const [resourceId, quantity] of Object.entries(this.resources)) {
            if (!allResources[resourceId]) {
                errors.push(`Unknown resource: ${resourceId}`);
            }
            if (typeof quantity !== 'number' || quantity < 0) {
                errors.push(`Invalid quantity for resource ${resourceId}: ${quantity}`);
            }
        }

        // Validate items
        for (const [itemId, quantity] of Object.entries(this.items)) {
            if (!allItems[itemId]) {
                errors.push(`Unknown item: ${itemId}`);
            }
            if (typeof quantity !== 'number' || quantity < 0) {
                errors.push(`Invalid quantity for item ${itemId}: ${quantity}`);
            }
        }

        // Validate equipment
        for (const [slot, itemId] of Object.entries(this.equipment)) {
            if (itemId !== null && !allItems[itemId]) {
                errors.push(`Unknown equipped item: ${itemId} in slot ${slot}`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}