/**
 * Game Constants
 * Centralized configuration for the isometric game
 */

// === Grid & Rendering Constants ===
export const TILE_W = 80;
export const TILE_H = TILE_W / 2;
export const PROJECTILE_SPEED = 8;

// === Game Balance Constants ===
export const PLAYER_STATS = {
    MAX_HP: 100,
    BASE_MAX_MP: 6,
    BASE_MAX_AP: 2,
    BASE_DAMAGE: 10,
    ATTACK_RANGE: 7,
    STARTING_X: 2,
    STARTING_Y: 2
};

export const BOSS_STATS = {
    MAX_HP: 150,
    MAX_MP: 6,
    MAX_AP: 2,
    ATTACK_RANGE: 5,
    ATTACK_RANGE_SQ: 25 // BOSS_ATTACK_RANGE * BOSS_ATTACK_RANGE
};

export const ENEMY_TYPES = {
    SHEEP: 'sheep',
    SHEEPIST_NOIR: 'sheepist_noir',
    CHEF_DE_GUERRE: 'chef_de_guerre',
    BOSS: 'boss'
};

// === AI Constants ===
export const AI_CONSTANTS = {
    SPECIAL_RANGE: 4,
    SPECIAL_COST_AP: 2,
    MAX_ACTIONS_PER_TURN: 5,
    ACTION_DELAY_MS: 300
};

// === Animation Constants ===
export const ANIMATION = {
    DAMAGE_DURATION: 1000,
    BUFF_DURATION: 1500,
    MOVEMENT_SPEED: 200,
    FADE_SPEED: 0.05,
    PARTICLE_COUNT: 6,
    PARTICLE_SIZE: 3,
    PARTICLE_ALPHA: 0.4
};

// === Audio Constants ===
export const AUDIO = {
    ATTACK_SOUND: 'damage-40114.mp3',
    SPELL_SOUND: 'magic-spell-6005.mp3',
    MOVEMENT_SOUND: 'running-14658.mp3',
    AMBIENT_SOUND: 'arcade-ui-4-229502.mp3'
};

// === UI Constants ===
export const UI = {
    TOOLTIP_DELAY: 500,
    MESSAGE_DURATION: 2000,
    INVENTORY_MODAL_ID: 'inventory-modal',
    SPELL_BAR_CLASS: 'spell-bar'
};

// === Game States ===
export const GAME_STATES = {
    IDLE: 'idle',
    MOVING: 'moving',
    ATTACKING: 'attacking',
    CASTING: 'casting',
    DEAD: 'dead'
};

export const TURN_STATES = {
    PLAYER: 'player',
    ENEMY: 'enemy',
    GAME_OVER: 'gameOver'
};

// === Resource Drop Rates ===
export const DROP_RATES = {
    SHEEP: {
        CORNE_SHEEP: { chance: 0.40, maxDrop: 2 },
        LAINE_SHEEP: { chance: 0.80, maxDrop: 1 },
        OEIL_SHEEP: { chance: 0.05, maxDrop: 2 },
        SABOT_SHEEP: { chance: 0.04, maxDrop: 4 }
    },
    SHEEPIST_NOIR: {
        CORNE_SHEEP: { chance: 0.40, maxDrop: 2 },
        LAINE_SHEEPIST_NOIR: { chance: 0.80, maxDrop: 1 },
        OEIL_SHEEP: { chance: 0.05, maxDrop: 2 },
        SABOT_SHEEP: { chance: 0.04, maxDrop: 4 }
    },
    CHEF_DE_GUERRE: {
        CORNE_CHEF_DE_GUERRE: { chance: 0.40, maxDrop: 2 },
        OEIL_SHEEP: { chance: 0.05, maxDrop: 2 },
        SABOT_SHEEP: { chance: 0.04, maxDrop: 4 }
    },
    BOSS: {
        LAINE_SHEEP_ROYAL: { chance: 0.1, maxDrop: 1 },
        CUIR_SHEEP_ROYAL: { chance: 0.1, maxDrop: 1 },
        OEIL_SHEEP: { chance: 0.05, maxDrop: 2 },
        SABOT_SHEEP: { chance: 0.04, maxDrop: 4 }
    }
};

// === Validation Constants ===
export const VALIDATION = {
    MIN_GRID_SIZE: 3,
    MAX_GRID_SIZE: 50,
    MIN_HP: 0,
    MAX_HP: 999,
    MIN_MP: 0,
    MAX_MP: 20,
    MIN_AP: 0,
    MAX_AP: 10
};

// === Development Constants ===
export const DEBUG = {
    ENABLE_LOGGING: true,
    LOG_AI_DECISIONS: true,
    LOG_PATHFINDING: false,
    SHOW_GRID_COORDINATES: false
};

// === Error Messages ===
export const ERROR_MESSAGES = {
    INVALID_ENTITY: 'Invalid entity provided',
    PATH_NOT_FOUND: 'No valid path found',
    OUT_OF_BOUNDS: 'Coordinates are out of grid bounds',
    INSUFFICIENT_RESOURCES: 'Insufficient resources',
    INVALID_TARGET: 'Invalid target selected',
    GAME_NOT_INITIALIZED: 'Game has not been properly initialized'
};

// === Success Messages ===
export const SUCCESS_MESSAGES = {
    ITEM_CRAFTED: 'Item successfully crafted',
    ITEM_EQUIPPED: 'Item equipped successfully',
    ENEMY_DEFEATED: 'Enemy defeated',
    LEVEL_COMPLETED: 'Level completed',
    SPELL_CAST: 'Spell cast successfully'
};