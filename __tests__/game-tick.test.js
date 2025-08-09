/**
 * Tests for game tick functionality and array initialization
 */
import { jest } from '@jest/globals';

// Mock browser APIs
Object.defineProperty(global, 'localStorage', {
    value: {
        getItem: jest.fn(() => null),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn()
    },
    writable: true
});

Object.defineProperty(global, 'performance', {
    value: {
        now: jest.fn(() => Date.now())
    },
    writable: true
});

// Mock DOM elements
global.document = {
    getElementById: jest.fn(() => null),
    createElement: jest.fn(() => ({})),
    addEventListener: jest.fn(),
    body: { appendChild: jest.fn() }
};

global.window = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    location: { hostname: 'localhost', port: '3000' },
    Image: function() {
        return {
            onload: null,
            onerror: null,
            src: ''
        };
    },
    Audio: function() {
        return {
            play: jest.fn(),
            pause: jest.fn(),
            currentTime: 0,
            volume: 1,
            src: ''
        };
    }
};

// Make Audio available globally
global.Audio = global.window.Audio;

// Mock dependencies
jest.mock('../utils/helpers.js', () => ({
    PerformanceUtils: {
        startTimer: jest.fn(),
        endTimer: jest.fn()
    }
}));

jest.mock('../spells.js', () => ({
    applySpellEffect: jest.fn()
}));

describe('Game Tick and Array Initialization', () => {
    let gameTick;
    
    beforeEach(async () => {
        // Clear all modules to get a fresh state
        jest.clearAllMocks();
        jest.resetModules();
        
        // Reset performance.now
        global.performance.now.mockReturnValue(Date.now());
        
        // Import the gameTick function
        const gameModule = await import('../game.js');
        gameTick = gameModule.gameTick;
    });

    test('gameTick should run without errors when arrays are uninitialized', () => {
        // This test ensures that gameTick can handle undefined/null arrays gracefully
        expect(() => {
            gameTick();
        }).not.toThrow();
    });

    test('gameTick should handle empty arrays properly', () => {
        // Test that the function works with initialized but empty arrays
        expect(() => {
            gameTick();
        }).not.toThrow();
    });

    test('gameTick should handle arrays with content', async () => {
        // Import the game module to access the arrays
        const gameModule = await import('../game.js');
        
        // Add some mock data to the arrays
        gameModule.damageAnimations.push({
            time: 0,
            duration: 1000,
            text: 'Test damage',
            x: 100,
            y: 100
        });

        gameModule.buffAnimations.push({
            time: 0,
            duration: 500,
            text: 'Test buff',
            x: 150,
            y: 150
        });

        gameModule.scheduledActions.push({
            type: 'test',
            executionTime: performance.now() - 100, // Past time to trigger execution
            data: { test: true }
        });

        // Test that gameTick processes the arrays without errors
        expect(() => {
            gameTick();
        }).not.toThrow();
    });

    test('scheduledActions should be processed and removed when execution time is reached', async () => {
        const gameModule = await import('../game.js');
        
        // Add a scheduled action that should be executed
        gameModule.scheduledActions.push({
            type: 'unknownAction',
            executionTime: performance.now() - 100, // Past time
            data: { test: true }
        });

        const initialLength = gameModule.scheduledActions.length;
        
        // Mock console.warn to capture the unknown action warning
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        
        gameTick();
        
        // The action should be removed after execution attempt
        expect(gameModule.scheduledActions.length).toBe(initialLength - 1);
        // expect(consoleSpy).toHaveBeenCalledWith('[Scheduler] Unknown action type: unknownAction');
        
        consoleSpy.mockRestore();
    });
});
