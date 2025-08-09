import { 
    SPELLS, 
    setSelectedSpell, 
    getSelectedSpellIndex, 
    getSelectedSpell 
} from '../spells.js';

describe('Spells Module Tests', () => {
    
    describe('SPELLS Constant', () => {
        test('should be frozen (immutable)', () => {
            expect(Object.isFrozen(SPELLS)).toBe(true);
        });

        test('should contain expected number of spells', () => {
            expect(SPELLS.length).toBe(7);
        });

        test('each spell should have required properties', () => {
            SPELLS.forEach(spell => {
                expect(spell).toHaveProperty('name');
                expect(spell).toHaveProperty('color');
                expect(spell).toHaveProperty('damage');
                expect(spell).toHaveProperty('range');
                expect(spell).toHaveProperty('aoe');
                expect(spell).toHaveProperty('push');
                expect(spell).toHaveProperty('cost');
                expect(typeof spell.name).toBe('string');
                expect(typeof spell.color).toBe('string');
                expect(typeof spell.damage).toBe('function');
                expect(typeof spell.range).toBe('number');
                expect(typeof spell.aoe).toBe('boolean');
                expect(typeof spell.cost).toBe('number');
            });
        });

        test('player spells should have keys 1-3', () => {
            const playerSpells = SPELLS.filter(spell => !spell.bossOnly && !spell.npcOnly);
            expect(playerSpells.length).toBe(3);
            expect(playerSpells[0].key).toBe('1');
            expect(playerSpells[1].key).toBe('2');
            expect(playerSpells[2].key).toBe('3');
        });

        test('boss spells should be marked as bossOnly', () => {
            const bossSpells = SPELLS.filter(spell => spell.bossOnly);
            expect(bossSpells.length).toBe(2);
            bossSpells.forEach(spell => {
                expect(spell.key).toBeNull();
                expect(spell.bossOnly).toBe(true);
            });
        });

        test('NPC spells should be marked as npcOnly', () => {
            const npcSpells = SPELLS.filter(spell => spell.npcOnly);
            expect(npcSpells.length).toBe(2);
            npcSpells.forEach(spell => {
                expect(spell.key).toBeNull();
                expect(spell.npcOnly).toBe(true);
            });
        });
    });

    describe('Individual Spell Properties', () => {
        test('Mono-cible spell should have correct properties', () => {
            const monoSpell = SPELLS.find(s => s.name === 'Mono-cible');
            expect(monoSpell).toBeDefined();
            expect(monoSpell.key).toBe('1');
            expect(monoSpell.color).toBe('#f1c40f');
            expect(monoSpell.range).toBe(7);
            expect(monoSpell.aoe).toBe(false);
            expect(monoSpell.push).toBe(false);
            expect(monoSpell.cost).toBe(1);
            
            // Test damage range
            for (let i = 0; i < 10; i++) {
                const damage = monoSpell.damage();
                expect(damage).toBeGreaterThanOrEqual(22);
                expect(damage).toBeLessThanOrEqual(28);
            }
        });

        test('Zone croix spell should have correct properties', () => {
            const zoneSpell = SPELLS.find(s => s.name === 'Zone croix');
            expect(zoneSpell).toBeDefined();
            expect(zoneSpell.key).toBe('2');
            expect(zoneSpell.color).toBe('#e67e22');
            expect(zoneSpell.range).toBe(7);
            expect(zoneSpell.aoe).toBe(true);
            expect(zoneSpell.push).toBe(false);
            expect(zoneSpell.cost).toBe(1);
            
            // Test damage range
            for (let i = 0; i < 10; i++) {
                const damage = zoneSpell.damage();
                expect(damage).toBeGreaterThanOrEqual(10);
                expect(damage).toBeLessThanOrEqual(15);
            }
        });

        test('Poussée spell should have correct properties', () => {
            const pushSpell = SPELLS.find(s => s.name === 'Poussée');
            expect(pushSpell).toBeDefined();
            expect(pushSpell.key).toBe('3');
            expect(pushSpell.color).toBe('#00b894');
            expect(pushSpell.range).toBe(7);
            expect(pushSpell.aoe).toBe(false);
            expect(pushSpell.push).toBe(2);
            expect(pushSpell.cost).toBe(1);
            
            // Test damage range
            for (let i = 0; i < 10; i++) {
                const damage = pushSpell.damage();
                expect(damage).toBeGreaterThanOrEqual(8);
                expect(damage).toBeLessThanOrEqual(12);
            }
        });

        test('Boss melee spell should have correct properties', () => {
            const bossSpell = SPELLS.find(s => s.name === 'Coup de Masse (CAC)');
            expect(bossSpell).toBeDefined();
            expect(bossSpell.key).toBeNull();
            expect(bossSpell.bossOnly).toBe(true);
            expect(bossSpell.range).toBe(1);
            expect(bossSpell.aoe).toBe(false);
            expect(bossSpell.push).toBe(false);
            expect(bossSpell.cost).toBe(1);
            
            // Test damage range
            for (let i = 0; i < 10; i++) {
                const damage = bossSpell.damage();
                expect(damage).toBeGreaterThanOrEqual(30);
                expect(damage).toBeLessThanOrEqual(36);
            }
        });

        test('Boss ranged spell should have correct properties', () => {
            const bossRanged = SPELLS.find(s => s.name === 'Boule de Feu');
            expect(bossRanged).toBeDefined();
            expect(bossRanged.key).toBeNull();
            expect(bossRanged.bossOnly).toBe(true);
            expect(bossRanged.range).toBe(5);
            expect(bossRanged.aoe).toBe(false);
            expect(bossRanged.push).toBe(false);
            expect(bossRanged.cost).toBe(1);
            
            // Test damage range
            for (let i = 0; i < 10; i++) {
                const damage = bossRanged.damage();
                expect(damage).toBeGreaterThanOrEqual(13);
                expect(damage).toBeLessThanOrEqual(17);
            }
        });

        test('Bave spell should have correct properties', () => {
            const baveSpell = SPELLS.find(s => s.name === 'Bave');
            expect(baveSpell).toBeDefined();
            expect(baveSpell.key).toBeNull();
            expect(baveSpell.npcOnly).toBe(true);
            expect(baveSpell.range).toBe(3);
            expect(baveSpell.aoe).toBe(false);
            expect(baveSpell.push).toBe(false);
            expect(baveSpell.cost).toBe(1);
            
            // Test damage range
            for (let i = 0; i < 10; i++) {
                const damage = baveSpell.damage();
                expect(damage).toBeGreaterThanOrEqual(6);
                expect(damage).toBeLessThanOrEqual(8);
            }
        });

        test('Crachat Gênant spell should have correct properties', () => {
            const crachatSpell = SPELLS.find(s => s.name === 'Crachat Gênant');
            expect(crachatSpell).toBeDefined();
            expect(crachatSpell.key).toBeNull();
            expect(crachatSpell.npcOnly).toBe(true);
            expect(crachatSpell.range).toBe(4);
            expect(crachatSpell.aoe).toBe(false);
            expect(crachatSpell.push).toBe(false);
            expect(crachatSpell.cost).toBe(1);
            expect(crachatSpell.effect).toBe('removeMP');
            expect(crachatSpell.effectValue).toBe(2);
            expect(crachatSpell.useLimit).toBe(1);
            
            // This spell does no damage
            expect(crachatSpell.damage()).toBe(0);
        });
    });

    describe('Spell Selection Management', () => {
        beforeEach(() => {
            // Reset to default selection
            setSelectedSpell(0);
        });

        test('should start with first spell selected', () => {
            expect(getSelectedSpellIndex()).toBe(0);
            expect(getSelectedSpell()).toBe(SPELLS[0]);
        });

        test('setSelectedSpell should change selected spell', () => {
            setSelectedSpell(2);
            expect(getSelectedSpellIndex()).toBe(2);
            expect(getSelectedSpell()).toBe(SPELLS[2]);
        });

        test('setSelectedSpell should not change for invalid indices', () => {
            const originalIndex = getSelectedSpellIndex();
            setSelectedSpell(-1);
            expect(getSelectedSpellIndex()).toBe(originalIndex);
            
            setSelectedSpell(SPELLS.length);
            expect(getSelectedSpellIndex()).toBe(originalIndex);
        });

        test('getSelectedSpell should return current spell object', () => {
            setSelectedSpell(1);
            const selectedSpell = getSelectedSpell();
            expect(selectedSpell).toBe(SPELLS[1]);
            expect(selectedSpell.name).toBe('Zone croix');
        });
    });

    describe('Damage Function Behavior', () => {
        test('damage functions should return integers', () => {
            SPELLS.forEach(spell => {
                for (let i = 0; i < 5; i++) {
                    const damage = spell.damage();
                    expect(Number.isInteger(damage)).toBe(true);
                }
            });
        });

        test('damage functions should be within expected ranges', () => {
            const ranges = {
                'Mono-cible': [22, 28],
                'Zone croix': [10, 15],
                'Poussée': [8, 12],
                'Coup de Masse (CAC)': [30, 36],
                'Boule de Feu': [13, 17],
                'Bave': [6, 8],
                'Crachat Gênant': [0, 0]
            };

            SPELLS.forEach(spell => {
                const [min, max] = ranges[spell.name];
                for (let i = 0; i < 20; i++) {
                    const damage = spell.damage();
                    expect(damage).toBeGreaterThanOrEqual(min);
                    expect(damage).toBeLessThanOrEqual(max);
                }
            });
        });
    });

    describe('Color Validation', () => {
        test('all spells should have valid hex colors', () => {
            const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
            SPELLS.forEach(spell => {
                expect(spell.color).toMatch(hexColorRegex);
            });
        });
    });
});