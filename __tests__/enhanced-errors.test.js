/**
 * Tests for enhanced error handling
 */
import { jest } from '@jest/globals';
import {
    MultiplayerError,
    ERROR_CODES,
    ErrorHandler,
    CircuitBreaker,
    RetryManager,
    ValidationManager
} from '../utils/enhanced-errors.js';

describe('Enhanced Error Handling', () => {
    describe('MultiplayerError', () => {
        test('should create error with code and context', () => {
            const error = new MultiplayerError(
                'Test error',
                ERROR_CODES.CONNECTION_FAILED,
                { playerId: 'player-1' }
            );
            
            expect(error.message).toBe('Test error');
            expect(error.code).toBe(ERROR_CODES.CONNECTION_FAILED);
            expect(error.context.playerId).toBe('player-1');
            expect(error.timestamp).toBeDefined();
            expect(error.name).toBe('MultiplayerError');
        });

        test('should extend Error properly', () => {
            const error = new MultiplayerError('Test', ERROR_CODES.VALIDATION_ERROR);
            
            expect(error instanceof Error).toBe(true);
            expect(error instanceof MultiplayerError).toBe(true);
        });
    });

    describe('ErrorHandler', () => {
        let errorHandler;
        let mockCallback;

        beforeEach(() => {
            mockCallback = jest.fn();
            errorHandler = new ErrorHandler({
                enableLogging: false, // Disable logging for tests
                enableMetrics: true,
                onError: mockCallback
            });
        });

        test('should handle MultiplayerError', () => {
            const originalError = new MultiplayerError(
                'Test error',
                ERROR_CODES.LOBBY_NOT_FOUND,
                { lobbyId: 'test-lobby' }
            );
            
            const handledError = errorHandler.handle(originalError, { additional: 'context' });
            
            expect(handledError).toBeInstanceOf(MultiplayerError);
            expect(handledError.code).toBe(ERROR_CODES.LOBBY_NOT_FOUND);
            expect(handledError.context.lobbyId).toBe('test-lobby');
            expect(handledError.context.additional).toBe('context');
            expect(mockCallback).toHaveBeenCalledWith(handledError);
        });

        test('should convert regular Error to MultiplayerError', () => {
            const regularError = new Error('Regular error message');
            
            const handledError = errorHandler.handle(regularError);
            
            expect(handledError).toBeInstanceOf(MultiplayerError);
            expect(handledError.code).toBe(ERROR_CODES.CONNECTION_FAILED);
            expect(handledError.context.originalError).toBe('Error');
        });

        test('should detect error types from message', () => {
            const timeoutError = new Error('Connection timeout occurred');
            const redisError = new Error('Redis connection failed');
            const validationError = new Error('Data validation failed');
            
            const handledTimeout = errorHandler.handle(timeoutError);
            const handledRedis = errorHandler.handle(redisError);
            const handledValidation = errorHandler.handle(validationError);
            
            expect(handledTimeout.code).toBe(ERROR_CODES.TIMEOUT_ERROR);
            expect(handledRedis.code).toBe(ERROR_CODES.REDIS_ERROR);
            expect(handledValidation.code).toBe(ERROR_CODES.VALIDATION_ERROR);
        });

        test('should record metrics', () => {
            const error1 = new MultiplayerError('Error 1', ERROR_CODES.LOBBY_FULL);
            const error2 = new MultiplayerError('Error 2', ERROR_CODES.LOBBY_FULL);
            const error3 = new MultiplayerError('Error 3', ERROR_CODES.PLAYER_NOT_FOUND);
            
            errorHandler.handle(error1);
            errorHandler.handle(error2);
            errorHandler.handle(error3);
            
            const metrics = errorHandler.getMetrics();
            
            expect(metrics.errorCounts[ERROR_CODES.LOBBY_FULL]).toBe(2);
            expect(metrics.errorCounts[ERROR_CODES.PLAYER_NOT_FOUND]).toBe(1);
            expect(metrics.recentErrors).toHaveLength(3);
            expect(metrics.totalErrors).toBe(3);
        });

        test('should clear metrics', () => {
            const error = new MultiplayerError('Test', ERROR_CODES.INVALID_ACTION);
            errorHandler.handle(error);
            
            expect(errorHandler.getMetrics().totalErrors).toBe(1);
            
            errorHandler.clearMetrics();
            
            const clearedMetrics = errorHandler.getMetrics();
            expect(clearedMetrics.totalErrors).toBe(0);
            expect(Object.keys(clearedMetrics.errorCounts)).toHaveLength(0);
        });
    });

    describe('CircuitBreaker', () => {
        let circuitBreaker;
        let mockOperation;
        let mockFallback;

        beforeEach(() => {
            circuitBreaker = new CircuitBreaker({
                failureThreshold: 3,
                recoveryTimeout: 1000
            });
            mockOperation = jest.fn();
            mockFallback = jest.fn().mockReturnValue('fallback-result');
        });

        test('should execute operation when circuit is CLOSED', async () => {
            mockOperation.mockResolvedValue('success');
            
            const result = await circuitBreaker.execute(mockOperation);
            
            expect(result).toBe('success');
            expect(mockOperation).toHaveBeenCalled();
            expect(circuitBreaker.getState().state).toBe('CLOSED');
        });

        test('should open circuit after threshold failures', async () => {
            mockOperation.mockRejectedValue(new Error('Operation failed'));
            
            // Trigger failures to open circuit
            for (let i = 0; i < 3; i++) {
                try {
                    await circuitBreaker.execute(mockOperation);
                } catch (error) {
                    // Expected to fail
                }
            }
            
            expect(circuitBreaker.getState().state).toBe('OPEN');
        });

        test('should use fallback when circuit is OPEN', async () => {
            // Force circuit to OPEN state
            circuitBreaker.state = 'OPEN';
            circuitBreaker.lastFailureTime = Date.now();
            
            const result = await circuitBreaker.execute(mockOperation, mockFallback);
            
            expect(result).toBe('fallback-result');
            expect(mockOperation).not.toHaveBeenCalled();
            expect(mockFallback).toHaveBeenCalled();
        });

        test('should attempt recovery after timeout', async () => {
            // Force circuit to OPEN state with old failure time
            circuitBreaker.state = 'OPEN';
            circuitBreaker.lastFailureTime = Date.now() - 2000; // 2 seconds ago
            
            mockOperation.mockResolvedValue('recovery-success');
            
            const result = await circuitBreaker.execute(mockOperation);
            
            expect(result).toBe('recovery-success');
            expect(circuitBreaker.getState().state).toBe('CLOSED');
        });

        test('should throw error when circuit is OPEN and no fallback', async () => {
            circuitBreaker.state = 'OPEN';
            circuitBreaker.lastFailureTime = Date.now();
            
            await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Circuit breaker is OPEN');
        });
    });

    describe('RetryManager', () => {
        let retryManager;
        let mockOperation;

        beforeEach(() => {
            retryManager = new RetryManager({
                maxRetries: 2,
                baseDelay: 10, // Short delay for tests
                jitter: false // Disable jitter for predictable tests
            });
            mockOperation = jest.fn();
        });

        test('should succeed on first attempt', async () => {
            mockOperation.mockResolvedValue('success');
            
            const result = await retryManager.execute(mockOperation);
            
            expect(result).toBe('success');
            expect(mockOperation).toHaveBeenCalledTimes(1);
        });

        test('should retry on failure and eventually succeed', async () => {
            mockOperation
                .mockRejectedValueOnce(new Error('Fail 1'))
                .mockRejectedValueOnce(new Error('Fail 2'))
                .mockResolvedValue('success');
            
            const result = await retryManager.execute(mockOperation);
            
            expect(result).toBe('success');
            expect(mockOperation).toHaveBeenCalledTimes(3);
        });

        test('should throw enhanced error after max retries', async () => {
            mockOperation.mockRejectedValue(new Error('Always fails'));
            
            await expect(retryManager.execute(mockOperation)).rejects.toThrow(MultiplayerError);
            expect(mockOperation).toHaveBeenCalledTimes(3); // Original + 2 retries
        });

        test('should calculate exponential backoff delay', () => {
            const delay0 = retryManager._calculateDelay(0);
            const delay1 = retryManager._calculateDelay(1);
            const delay2 = retryManager._calculateDelay(2);
            
            expect(delay0).toBe(10); // baseDelay
            expect(delay1).toBe(20); // baseDelay * 2^1
            expect(delay2).toBe(40); // baseDelay * 2^2
        });

        test('should respect max delay', () => {
            const managerWithMaxDelay = new RetryManager({
                baseDelay: 1000,
                maxDelay: 5000,
                jitter: false
            });
            
            const delay = managerWithMaxDelay._calculateDelay(10); // Would be 1024000 without max
            expect(delay).toBe(5000);
        });
    });

    describe('ValidationManager', () => {
        describe('validateLobbyData', () => {
            test('should validate correct lobby data', () => {
                const validLobby = {
                    id: 'lobby-123',
                    name: 'Test Lobby',
                    maxPlayers: 4,
                    players: []
                };
                
                expect(() => ValidationManager.validateLobbyData(validLobby)).not.toThrow();
            });

            test('should throw error for missing lobby ID', () => {
                const invalidLobby = { name: 'Test Lobby' };
                
                expect(() => ValidationManager.validateLobbyData(invalidLobby)).toThrow(MultiplayerError);
            });

            test('should throw error for invalid max players', () => {
                const invalidLobby = {
                    id: 'lobby-123',
                    name: 'Test Lobby',
                    maxPlayers: 10 // Too high
                };
                
                expect(() => ValidationManager.validateLobbyData(invalidLobby)).toThrow(MultiplayerError);
            });

            test('should throw error for non-array players', () => {
                const invalidLobby = {
                    id: 'lobby-123',
                    name: 'Test Lobby',
                    players: 'not-an-array'
                };
                
                expect(() => ValidationManager.validateLobbyData(invalidLobby)).toThrow(MultiplayerError);
            });
        });

        describe('validatePlayerData', () => {
            test('should validate correct player data', () => {
                const validPlayer = {
                    id: 'player-123',
                    name: 'TestPlayer'
                };
                
                expect(() => ValidationManager.validatePlayerData(validPlayer)).not.toThrow();
            });

            test('should throw error for missing player ID', () => {
                const invalidPlayer = { name: 'TestPlayer' };
                
                expect(() => ValidationManager.validatePlayerData(invalidPlayer)).toThrow(MultiplayerError);
            });

            test('should throw error for long player name', () => {
                const invalidPlayer = {
                    id: 'player-123',
                    name: 'ThisNameIsTooLongAndExceedsTwentyCharacters'
                };
                
                expect(() => ValidationManager.validatePlayerData(invalidPlayer)).toThrow(MultiplayerError);
            });
        });

        describe('validateGameAction', () => {
            test('should validate correct move action', () => {
                const validAction = {
                    type: 'move',
                    path: [{ x: 1, y: 1 }, { x: 2, y: 2 }]
                };
                
                expect(() => ValidationManager.validateGameAction(validAction)).not.toThrow();
            });

            test('should validate correct attack action', () => {
                const validAction = {
                    type: 'attack',
                    attackerId: 'player-1',
                    targetId: 'enemy-1'
                };
                
                expect(() => ValidationManager.validateGameAction(validAction)).not.toThrow();
            });

            test('should throw error for missing action type', () => {
                const invalidAction = { data: 'some data' };
                
                expect(() => ValidationManager.validateGameAction(invalidAction)).toThrow(MultiplayerError);
            });

            test('should throw error for invalid action type', () => {
                const invalidAction = { type: 'invalid-action' };
                
                expect(() => ValidationManager.validateGameAction(invalidAction)).toThrow(MultiplayerError);
            });

            test('should throw error for move action without path', () => {
                const invalidAction = { type: 'move' };
                
                expect(() => ValidationManager.validateGameAction(invalidAction)).toThrow(MultiplayerError);
            });

            test('should throw error for attack action without required fields', () => {
                const invalidAction = { type: 'attack', attackerId: 'player-1' }; // Missing targetId
                
                expect(() => ValidationManager.validateGameAction(invalidAction)).toThrow(MultiplayerError);
            });
        });
    });
});
