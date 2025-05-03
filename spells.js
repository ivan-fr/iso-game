// --- Sorts ---
/**
 * List of available spells.
 * @type {ReadonlyArray<{name: string, key: string, color: string, damage: () => number, range: number, aoe: boolean, push: boolean}>}
 */
export const SPELLS = Object.freeze([
    {
        name: 'Mono-cible',
        key: '1',
        color: '#f1c40f',
        damage: () => 22 + Math.floor(Math.random() * 7), // 22-28
        range: 7,
        aoe: false,
        push: false,
        cost: 1
    },
    {
        name: 'Zone croix',
        key: '2',
        color: '#e67e22',
        damage: () => 10 + Math.floor(Math.random() * 6), // 10-15
        range: 7,
        aoe: true,
        push: false,
        cost: 1
    },
    {
        name: 'Poussée',
        key: '3',
        color: '#00b894',
        damage: () => 8 + Math.floor(Math.random() * 5), // 8-12
        range: 7,
        aoe: false,
        push: 2,
        cost: 1
    },
    // Sort de corps à corps du boss
    {
        name: 'Coup de Masse (CAC)',
        key: null,
        color: '#c0392b',
        damage: () => 30 + Math.floor(Math.random() * 7), // 30-36
        range: 1,
        aoe: false,
        push: false,
        bossOnly: true,
        cost: 1
    },
    // Sort à distance du boss
    {
        name: 'Boule de Feu',
        key: null,
        color: '#ff5733',
        damage: () => 13 + Math.floor(Math.random() * 5), // 13-17
        range: 5,
        aoe: false,
        push: false,
        bossOnly: true,
        cost: 1
    },
    // Sort Attaque du sheepist Noir
    {
        name: 'Bave',
        key: null, // NPC only
        color: '#7f8c8d', // Grayish color
        damage: () => 6 + Math.floor(Math.random() * 3), // 6-8
        range: 3,  // CORRECTED range
        aoe: false,
        push: false,
        cost: 1, // CORRECTED cost
        npcOnly: true // Prevent player selection
    },
    // Sort Spécial du sheepist Noir (MP Removal)
    {
        name: 'Crachat Gênant', // New name for MP removal
        key: null, // NPC only
        color: '#525657', // Darker gray
        damage: () => 0, // No damage
        range: 4, // Spec range
        aoe: false,
        push: false,
        cost: 1, // Assumed cost
        effect: 'removeMP', // Indicate effect type
        effectValue: 2, // MP to remove
        useLimit: 1, // Can only be used once per turn
        npcOnly: true
    }
]);

// Internal state for selected spell
let _selectedSpell = 0;

/**
 * Set the selected spell index.
 * @param {number} index
 */
export function setSelectedSpell(index) {
    if (index >= 0 && index < SPELLS.length) {
        _selectedSpell = index;
    }
}

/**
 * Get the current selected spell index.
 * @returns {number}
 */
export function getSelectedSpellIndex() {
    return _selectedSpell;
}

/**
 * Get the currently selected spell object.
 * @returns {object}
 */
export function getSelectedSpell() {
    return SPELLS[_selectedSpell];
}