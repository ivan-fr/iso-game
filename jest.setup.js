// jest.setup.js
import { jest } from '@jest/globals';

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

global.Audio = global.window.Audio;
