import { jest } from '@jest/globals';
import * as draw from '../draw.js';

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

// Mock the canvas context
const mockContext = {
  save: jest.fn(),
  restore: jest.fn(),
  translate: jest.fn(),
  scale: jest.fn(),
  clearRect: jest.fn(),
  drawImage: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
  fill: jest.fn(),
  arc: jest.fn(),
  fillText: jest.fn(),
  measureText: jest.fn(() => ({ width: 50 })),
  createLinearGradient: jest.fn(() => ({
    addColorStop: jest.fn(),
  })),
  createRadialGradient: jest.fn(() => ({
    addColorStop: jest.fn(),
  })),
};

describe('Draw Functions', () => {
  let canvas;

  beforeEach(() => {
    canvas = {
      getContext: jest.fn(() => mockContext),
      width: 800,
      height: 600,
    };
    jest.clearAllMocks();
  });

  test('drawGame should call necessary drawing functions', () => {
    const state = {
      canvas,
      ctx: mockContext,
      mapGrid: [[]],
      entities: [],
      floatingTexts: [],
      damageAnimations: [],
      buffAnimations: [],
      projectiles: [],
      explosions: [],
      player: {},
      showGrid: true,
      cameraOffsetX: 0,
      cameraOffsetY: 0,
    };

    // Mock individual drawing functions to avoid testing their implementations here
    draw.drawGrid = jest.fn();
    draw.drawEntities = jest.fn();
    draw.drawFloatingTexts = jest.fn();
    draw.drawDamageAnimations = jest.fn();
    draw.drawBuffAnimations = jest.fn();
    draw.drawProjectiles = jest.fn();
    draw.drawExplosions = jest.fn();
    draw.drawPlayerUI = jest.fn();

    draw.drawGame(state);

    expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, canvas.width, canvas.height);
    expect(draw.drawGrid).toHaveBeenCalled();
    expect(draw.drawEntities).toHaveBeenCalled();
    expect(draw.drawFloatingTexts).toHaveBeenCalled();
    expect(draw.drawDamageAnimations).toHaveBeenCalled();
    expect(draw.drawBuffAnimations).toHaveBeenCalled();
    expect(draw.drawProjectiles).toHaveBeenCalled();
    expect(draw.drawExplosions).toHaveBeenCalled();
    expect(draw.drawPlayerUI).toHaveBeenCalled();
  });
});
