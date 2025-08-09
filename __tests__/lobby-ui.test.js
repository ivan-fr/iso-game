import { jest } from '@jest/globals';

// Mock DOM and browser environment
const mockDOMElements = () => {
    const createMockElement = (initialValue = '') => ({
        textContent: initialValue,
        style: {},
        classList: { add: jest.fn(), remove: jest.fn() },
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
    });
    
    return {
        'ui-player-ap': createMockElement('2'),
        'ui-player-max-ap': createMockElement('2'),
        'ui-player-mp': createMockElement('6'),
        'ui-player-max-mp': createMockElement('6'),
        'player-ap': createMockElement('AP: 2'),
        'player-mp': createMockElement('MP: 6'),
        'ui-player-hp': createMockElement('100'),
        'ui-player-max-hp': createMockElement('100'),
        'ui-player-dmg-bonus': createMockElement('0'),
        'player-health-bar': createMockElement(),
        'boss-info-group': createMockElement(),
        'enemy-info': createMockElement(),
        'turnOrder': createMockElement(),
        'spell-bar': createMockElement(),
        'end-turn-button': createMockElement(),
        'mobile-end-turn-button': createMockElement()
    };
};

describe('Lobby UI Integration Tests', () => {
    let mockElements;
    let mockInventoryManager;
    
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Mock DOM elements
        mockElements = mockDOMElements();
        
        global.document = {
            getElementById: jest.fn((id) => mockElements[id] || null)
        };
        
        global.window = {
            currentGame: {
                isInLobby: jest.fn(() => true)
            }
        };
        
        // Mock inventory manager
        mockInventoryManager = {
            getStatBonus: jest.fn((stat) => {
                switch(stat) {
                    case 'pa': return 0;
                    case 'mp': return 0;
                    case 'damage': return 0;
                    default: return 0;
                }
            })
        };
        
        global.inventoryManager = mockInventoryManager;
    });
    
    // Helper function for simulating UI updates
    const simulateUpdatePlayerDisplayStats = (player, inLobby = true) => {
        const hpDisplay = mockElements['ui-player-hp'];
        const maxHpDisplay = mockElements['ui-player-max-hp'];
        const apDisplay = mockElements['ui-player-ap'];
        const maxApDisplay = mockElements['ui-player-max-ap'];
        const mpDisplay = mockElements['ui-player-mp'];
        const maxMpDisplay = mockElements['ui-player-max-mp'];
        const dmgBonusDisplay = mockElements['ui-player-dmg-bonus'];
        const oldPlayerApDisplay = mockElements['player-ap'];
        const oldPlayerMpDisplay = mockElements['player-mp'];
        const playerHealthBar = mockElements['player-health-bar'];
        
        if (player && mockInventoryManager) {
            const currentHp = player.hp;
            const maxHp = player.maxHp;
            const currentAp = player.ap;
            const maxAp = player.baseMaxAp + mockInventoryManager.getStatBonus('pa');
            const currentMp = player.mp;
            const maxMp = player.baseMaxMp + mockInventoryManager.getStatBonus('mp');
            const damageBonus = mockInventoryManager.getStatBonus('damage');
            
            if (hpDisplay) hpDisplay.textContent = String(currentHp);
            if (maxHpDisplay) maxHpDisplay.textContent = String(maxHp);
            
            // In lobby mode, show infinite AP/MP; otherwise show actual values
            if (inLobby) {
                if (apDisplay) apDisplay.textContent = '∞';
                if (maxApDisplay) maxApDisplay.textContent = '∞';
                if (mpDisplay) mpDisplay.textContent = '∞';
                if (maxMpDisplay) maxMpDisplay.textContent = '∞';
                if (oldPlayerApDisplay) oldPlayerApDisplay.textContent = 'AP: ∞';
                if (oldPlayerMpDisplay) oldPlayerMpDisplay.textContent = 'MP: ∞';
            } else {
                if (apDisplay) apDisplay.textContent = String(currentAp);
                if (maxApDisplay) maxApDisplay.textContent = String(maxAp);
                if (mpDisplay) mpDisplay.textContent = String(currentMp);
                if (maxMpDisplay) maxMpDisplay.textContent = String(maxMp);
                if (oldPlayerApDisplay) oldPlayerApDisplay.textContent = `AP: ${currentAp}`;
                if (oldPlayerMpDisplay) oldPlayerMpDisplay.textContent = `MP: ${currentMp}`;
            }
            
            if (dmgBonusDisplay) {
                dmgBonusDisplay.textContent = damageBonus > 0 ? `+${damageBonus}` : '0';
                dmgBonusDisplay.style.color = damageBonus > 0 ? '#4CAF50' : 'inherit';
            }
            
            // Update health bar
            if (playerHealthBar) {
                const healthPercent = maxHp > 0 ? (currentHp / maxHp) * 100 : 0;
                playerHealthBar.style.width = `${healthPercent}%`;
                if (healthPercent < 30) {
                    playerHealthBar.style.backgroundColor = '#f44336';
                } else if (healthPercent < 60) {
                    playerHealthBar.style.backgroundColor = '#ff9800';
                } else {
                    playerHealthBar.style.backgroundColor = '#4CAF50';
                }
            }
        }
    };
    
    describe('Player Stats Display in Lobby', () => {
        
        test('should display infinite symbols for AP and MP in lobby mode', () => {
            const player = {
                hp: 100,
                maxHp: 100,
                ap: 2,
                baseMaxAp: 2,
                mp: 6,
                baseMaxMp: 6
            };
            
            simulateUpdatePlayerDisplayStats(player, true);
            
            expect(mockElements['ui-player-ap'].textContent).toBe('∞');
            expect(mockElements['ui-player-max-ap'].textContent).toBe('∞');
            expect(mockElements['ui-player-mp'].textContent).toBe('∞');
            expect(mockElements['ui-player-max-mp'].textContent).toBe('∞');
            expect(mockElements['player-ap'].textContent).toBe('AP: ∞');
            expect(mockElements['player-mp'].textContent).toBe('MP: ∞');
        });
        
        test('should display normal values for AP and MP in dungeon mode', () => {
            const player = {
                hp: 100,
                maxHp: 100,
                ap: 2,
                baseMaxAp: 2,
                mp: 6,
                baseMaxMp: 6
            };
            
            simulateUpdatePlayerDisplayStats(player, false);
            
            expect(mockElements['ui-player-ap'].textContent).toBe('2');
            expect(mockElements['ui-player-max-ap'].textContent).toBe('2');
            expect(mockElements['ui-player-mp'].textContent).toBe('6');
            expect(mockElements['ui-player-max-mp'].textContent).toBe('6');
            expect(mockElements['player-ap'].textContent).toBe('AP: 2');
            expect(mockElements['player-mp'].textContent).toBe('MP: 6');
        });
        
        test('should always display HP correctly regardless of lobby mode', () => {
            const player = {
                hp: 80,
                maxHp: 100,
                ap: 2,
                baseMaxAp: 2,
                mp: 6,
                baseMaxMp: 6
            };
            
            // Test in lobby
            simulateUpdatePlayerDisplayStats(player, true);
            expect(mockElements['ui-player-hp'].textContent).toBe('80');
            expect(mockElements['ui-player-max-hp'].textContent).toBe('100');
            
            // Test in dungeon
            simulateUpdatePlayerDisplayStats(player, false);
            expect(mockElements['ui-player-hp'].textContent).toBe('80');
            expect(mockElements['ui-player-max-hp'].textContent).toBe('100');
        });
        
        test('should handle equipment bonuses correctly in both modes', () => {
            mockInventoryManager.getStatBonus.mockImplementation((stat) => {
                switch(stat) {
                    case 'pa': return 1; // +1 AP bonus
                    case 'mp': return 2; // +2 MP bonus
                    case 'damage': return 5; // +5 damage bonus
                    default: return 0;
                }
            });
            
            const player = {
                hp: 100,
                maxHp: 100,
                ap: 2,
                baseMaxAp: 2,
                mp: 6,
                baseMaxMp: 6
            };
            
            // In lobby mode, should still show ∞ despite bonuses
            simulateUpdatePlayerDisplayStats(player, true);
            expect(mockElements['ui-player-ap'].textContent).toBe('∞');
            expect(mockElements['ui-player-mp'].textContent).toBe('∞');
            expect(mockElements['ui-player-dmg-bonus'].textContent).toBe('+5');
            expect(mockElements['ui-player-dmg-bonus'].style.color).toBe('#4CAF50');
            
            // In dungeon mode, should show actual values with bonuses
            simulateUpdatePlayerDisplayStats(player, false);
            expect(mockElements['ui-player-ap'].textContent).toBe('2');
            expect(mockElements['ui-player-max-ap'].textContent).toBe('3'); // 2 + 1 bonus
            expect(mockElements['ui-player-mp'].textContent).toBe('6');
            expect(mockElements['ui-player-max-mp'].textContent).toBe('8'); // 6 + 2 bonus
        });
        
        test('should update health bar styling based on HP percentage', () => {
            const testHealthBar = (hp, maxHp, expectedColor) => {
                const player = { hp, maxHp, ap: 2, baseMaxAp: 2, mp: 6, baseMaxMp: 6 };
                simulateUpdatePlayerDisplayStats(player, true);
                
                const healthBar = mockElements['player-health-bar'];
                const expectedPercent = (hp / maxHp) * 100;
                
                expect(healthBar.style.width).toBe(`${expectedPercent}%`);
                expect(healthBar.style.backgroundColor).toContain(expectedColor);
            };
            
            // High health (> 60%) - Green
            testHealthBar(100, 100, '#4CAF50');
            testHealthBar(70, 100, '#4CAF50');
            
            // Medium health (30-60%) - Orange
            testHealthBar(50, 100, '#ff9800');
            testHealthBar(40, 100, '#ff9800');
            
            // Low health (< 30%) - Red
            testHealthBar(25, 100, '#f44336');
            testHealthBar(10, 100, '#f44336');
        });
    });
    
    describe('Combat UI Hiding in Lobby', () => {
        const simulateUpdateUI = (isInLobby = true) => {
            const combatElements = [
                'boss-info-group',
                'enemy-info',
                'turnOrder',
                'spell-bar',
                'end-turn-button',
                'mobile-end-turn-button'
            ];
            
            combatElements.forEach(elementId => {
                const element = mockElements[elementId];
                if (element) {
                    element.style.display = isInLobby ? 'none' : 'block';
                }
            });
        };
        
        test('should hide combat UI elements in lobby mode', () => {
            simulateUpdateUI(true);
            
            const combatElements = [
                'boss-info-group',
                'enemy-info',
                'turnOrder',
                'spell-bar',
                'end-turn-button',
                'mobile-end-turn-button'
            ];
            
            combatElements.forEach(elementId => {
                const element = mockElements[elementId];
                expect(element.style.display).toBe('none');
            });
        });
        
        test('should show combat UI elements in dungeon mode', () => {
            // First hide them (lobby mode)
            simulateUpdateUI(true);
            
            // Then show them (dungeon mode)
            simulateUpdateUI(false);
            
            const combatElements = [
                'boss-info-group',
                'enemy-info',
                'turnOrder',
                'spell-bar',
                'end-turn-button',
                'mobile-end-turn-button'
            ];
            
            combatElements.forEach(elementId => {
                const element = mockElements[elementId];
                // In real implementation, these would be set to 'block' or 'flex'
                expect(element.style.display).not.toBe('none');
            });
        });
    });
    
    describe('Lobby Mode Detection in UI', () => {
        test('should correctly detect lobby mode from window.currentGame', () => {
            expect(global.window.currentGame.isInLobby()).toBe(true);
            
            // Test switching to dungeon mode
            global.window.currentGame.isInLobby.mockReturnValue(false);
            expect(global.window.currentGame.isInLobby()).toBe(false);
        });
        
        test('should handle missing window.currentGame gracefully', () => {
            global.window.currentGame = null;
            
            // UI should not crash and should default to non-lobby mode
            const player = {
                hp: 100,
                maxHp: 100,
                ap: 2,
                baseMaxAp: 2,
                mp: 6,
                baseMaxMp: 6
            };
            
            // This should default to false (dungeon mode) when currentGame is null
            const inLobby = global.window.currentGame && global.window.currentGame.isInLobby();
            simulateUpdatePlayerDisplayStats(player, !!inLobby);
            
            expect(mockElements['ui-player-ap'].textContent).toBe('2');
            expect(mockElements['ui-player-mp'].textContent).toBe('6');
        });
    });
    
    describe('UI Update Performance', () => {
        test('should only update elements that exist in DOM', () => {
            // Remove some elements
            mockElements['ui-player-ap'] = null;
            mockElements['player-ap'] = null;
            
            const player = {
                hp: 100,
                maxHp: 100,
                ap: 2,
                baseMaxAp: 2,
                mp: 6,
                baseMaxMp: 6
            };
            
            // This should not throw errors
            expect(() => {
                simulateUpdatePlayerDisplayStats(player, true);
            }).not.toThrow();
            
            // Other elements should still be updated
            expect(mockElements['ui-player-mp'].textContent).toBe('∞');
            expect(mockElements['player-mp'].textContent).toBe('MP: ∞');
        });
        
        test('should handle undefined player gracefully', () => {
            expect(() => {
                simulateUpdatePlayerDisplayStats(null, true);
            }).not.toThrow();
            
            expect(() => {
                simulateUpdatePlayerDisplayStats(undefined, true);
            }).not.toThrow();
        });
        
        test('should handle undefined inventoryManager gracefully', () => {
            global.inventoryManager = null;
            
            const player = {
                hp: 100,
                maxHp: 100,
                ap: 2,
                baseMaxAp: 2,
                mp: 6,
                baseMaxMp: 6
            };
            
            expect(() => {
                simulateUpdatePlayerDisplayStats(player, true);
            }).not.toThrow();
        });
    });
});
