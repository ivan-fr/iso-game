/**
 * Tests for performance monitoring
 */
import { jest } from '@jest/globals';
import { PerformanceMonitor, AlertManager } from '../utils/performance-monitoring.js';

// Mock performance.now for consistent testing
global.performance = {
    now: jest.fn(() => Date.now())
};

describe('Performance Monitoring', () => {
    describe('PerformanceMonitor', () => {
        let monitor;

        beforeEach(() => {
            monitor = new PerformanceMonitor({
                enableLogging: false,
                enableMetrics: true,
                sampleRate: 1.0
            });
        });

        afterEach(() => {
            monitor.stop();
        });

        test('should start and end timer correctly', () => {
            const timerId = monitor.startTimer('test-operation');
            
            expect(timerId).toBeDefined();
            expect(monitor.timers.has(timerId)).toBe(true);
            
            // Advance time
            performance.now.mockReturnValue(performance.now() + 100);
            
            const duration = monitor.endTimer(timerId);
            
            expect(duration).toBeGreaterThanOrEqual(90);
            expect(duration).toBeLessThanOrEqual(120);
            expect(monitor.timers.has(timerId)).toBe(false);
        });

        test('should record operation metrics', () => {
            monitor.recordOperation('test-op', 150, 'success');
            monitor.recordOperation('test-op', 200, 'success');
            monitor.recordOperation('test-op', 100, 'error');
            
            const metrics = monitor.getMetrics();
            const opMetrics = metrics.operations['test-op'];
            
            expect(opMetrics.count).toBe(3);
            expect(opMetrics.successCount).toBe(2);
            expect(opMetrics.errorCount).toBe(1);
            expect(opMetrics.averageDuration).toBe(150); // (150 + 200 + 100) / 3
            expect(opMetrics.minDuration).toBe(100);
            expect(opMetrics.maxDuration).toBe(200);
        });

        test('should update response time histogram', () => {
            monitor.recordOperation('test-op', 5, 'success');    // 0-10ms bucket
            monitor.recordOperation('test-op', 25, 'success');   // 10-50ms bucket
            monitor.recordOperation('test-op', 75, 'success');   // 50-100ms bucket
            monitor.recordOperation('test-op', 250, 'success');  // 100-500ms bucket
            monitor.recordOperation('test-op', 750, 'success');  // 500-1000ms bucket
            monitor.recordOperation('test-op', 1500, 'success'); // 1000ms+ bucket
            
            const metrics = monitor.getMetrics();
            const histogram = metrics.histograms['test-op'];
            
            expect(histogram.buckets['0-10ms']).toBe(1);
            expect(histogram.buckets['10-50ms']).toBe(1);
            expect(histogram.buckets['50-100ms']).toBe(1);
            expect(histogram.buckets['100-500ms']).toBe(1);
            expect(histogram.buckets['500-1000ms']).toBe(1);
            expect(histogram.buckets['1000ms+']).toBe(1);
        });

        test('should calculate percentiles correctly', () => {
            // Add many samples for better percentile calculation
            const samples = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
            
            samples.forEach(duration => {
                monitor.recordOperation('percentile-test', duration, 'success');
            });
            
            const metrics = monitor.getMetrics();
            const histogram = metrics.histograms['percentile-test'];
            
            expect(histogram.percentiles.p50).toBe(50); // 50th percentile
            expect(histogram.percentiles.p90).toBe(90); // 90th percentile
        });

        test('should track error rates with sliding window', () => {
            // Add mix of successes and errors
            for (let i = 0; i < 10; i++) {
                monitor.recordOperation('error-test', 100, i < 7 ? 'success' : 'error');
            }
            
            const metrics = monitor.getMetrics();
            const errorRate = metrics.errorRates['error-test'];
            
            expect(errorRate.total).toBe(10);
            expect(errorRate.errors).toBe(3);
            expect(errorRate.rate).toBe(0.3); // 3/10 = 30% error rate
        });

        test('should track throughput', () => {
            const now = Date.now();
            
            // Mock Date.now to simulate operations over time
            jest.spyOn(Date, 'now')
                .mockReturnValueOnce(now)
                .mockReturnValueOnce(now + 10000)  // 10 seconds later
                .mockReturnValueOnce(now + 20000)  // 20 seconds later
                .mockReturnValueOnce(now + 30000); // 30 seconds later
            
            monitor.recordOperation('throughput-test', 100, 'success');
            monitor.recordOperation('throughput-test', 100, 'success');
            monitor.recordOperation('throughput-test', 100, 'success');
            
            const metrics = monitor.getMetrics();
            const throughput = metrics.throughput['throughput-test'];
            
            expect(throughput).toBeDefined();
            expect(throughput.current).toBeGreaterThan(0);
            
            Date.now.mockRestore();
        });

        test('should track connection metrics', () => {
            monitor.recordConnection('connect');
            monitor.recordConnection('connect');
            monitor.recordConnection('connect');
            monitor.recordConnection('disconnect');
            
            const metrics = monitor.getMetrics();
            
            expect(metrics.connections.active).toBe(2);
            expect(metrics.connections.total).toBe(3);
            expect(metrics.connections.peak).toBe(3);
        });

        test('should calculate health score', () => {
            // Add some good metrics
            monitor.recordOperation('good-op', 50, 'success');
            monitor.recordOperation('good-op', 60, 'success');
            
            let health = monitor.getHealthScore();
            expect(health.score).toBe(100);
            expect(health.status).toBe('healthy');
            
            // Add some bad metrics
            for (let i = 0; i < 10; i++) {
                monitor.recordOperation('bad-op', 2000, 'error'); // Slow and errors
            }
            
            health = monitor.getHealthScore();
            expect(health.score).toBeLessThan(100);
            expect(health.issues.length).toBeGreaterThan(0);
        });

        it('should handle timer sampling', () => {
            // Mock Math.random to control sampling
            const originalRandom = Math.random;
            Math.random = () => 0.9; // Above sampling rate of 0.1
            
            const lowSampleMonitor = new PerformanceMonitor({ 
                timerSamplingRate: 0.1 
            });
            
            const timerId = lowSampleMonitor.startTimer('test');
            expect(timerId).toBeNull();
            
            // Restore original Math.random
            Math.random = originalRandom;
        });

        test('should reset metrics correctly', () => {
            monitor.recordOperation('test', 100, 'success');
            monitor.recordConnection('connect');
            
            let metrics = monitor.getMetrics();
            expect(Object.keys(metrics.operations)).toHaveLength(1);
            expect(metrics.connections.total).toBe(1);
            
            monitor.reset();
            
            metrics = monitor.getMetrics();
            expect(Object.keys(metrics.operations)).toHaveLength(0);
            expect(metrics.connections.total).toBe(0);
        });
    });

    describe('AlertManager', () => {
        let alertManager;
        let mockCallback;

        beforeEach(() => {
            mockCallback = jest.fn();
            alertManager = new AlertManager({
                errorRateThreshold: 0.1, // 10%
                responseTimeThreshold: 500,
                memoryThreshold: 0.8,
                cooldownPeriod: 1000 // 1 second for testing
            });
            
            alertManager.addAlertCallback(mockCallback);
        });

        test('should trigger alert for high error rate', () => {
            const metrics = {
                operations: {
                    'test-op': {
                        errorRate: 0.15, // 15% > 10% threshold
                        averageDuration: 100
                    }
                },
                connections: { active: 10 },
                system: { memory: { heapUtilization: 0.5 } }
            };
            
            const alerts = alertManager.checkMetrics(metrics);
            
            expect(alerts).toHaveLength(1);
            expect(alerts[0].type).toBe('high_error_rate');
            expect(mockCallback).toHaveBeenCalledWith(alerts[0]);
        });

        test('should trigger alert for slow response time', () => {
            const metrics = {
                operations: {
                    'slow-op': {
                        errorRate: 0.05,
                        averageDuration: 1000 // 1000ms > 500ms threshold
                    }
                },
                connections: { active: 10 },
                system: { memory: { heapUtilization: 0.5 } }
            };
            
            const alerts = alertManager.checkMetrics(metrics);
            
            expect(alerts).toHaveLength(1);
            expect(alerts[0].type).toBe('slow_response');
        });

        test('should trigger alert for high memory usage', () => {
            const metrics = {
                operations: {},
                connections: { active: 10 },
                system: {
                    memory: {
                        heapUtilization: 0.9 // 90% > 80% threshold
                    }
                }
            };
            
            const alerts = alertManager.checkMetrics(metrics);
            
            expect(alerts).toHaveLength(1);
            expect(alerts[0].type).toBe('high_memory_usage');
        });

        test('should trigger alert for high connection count', () => {
            const metrics = {
                operations: {},
                connections: { active: 1500 }, // > 1000 threshold
                system: { memory: { heapUtilization: 0.5 } }
            };
            
            alertManager.thresholds.connectionCount = 1000;
            const alerts = alertManager.checkMetrics(metrics);
            
            expect(alerts).toHaveLength(1);
            expect(alerts[0].type).toBe('high_connection_count');
        });

        test('should respect cooldown period', async () => {
            const metrics = {
                operations: {
                    'test-op': {
                        errorRate: 0.15,
                        averageDuration: 100
                    }
                },
                connections: { active: 10 },
                system: { memory: { heapUtilization: 0.5 } }
            };
            
            // First alert should fire
            alertManager.checkMetrics(metrics);
            expect(mockCallback).toHaveBeenCalledTimes(1);
            
            // Second alert immediately should not fire (cooldown)
            alertManager.checkMetrics(metrics);
            expect(mockCallback).toHaveBeenCalledTimes(1);
            
            // Wait for cooldown to expire
            await new Promise(resolve => setTimeout(resolve, 1100));
            
            // Third alert should fire after cooldown
            alertManager.checkMetrics(metrics);
            expect(mockCallback).toHaveBeenCalledTimes(2);
        });

        test('should handle multiple alert callbacks', () => {
            const secondCallback = jest.fn();
            alertManager.addAlertCallback(secondCallback);
            
            const metrics = {
                operations: {
                    'test-op': { errorRate: 0.15, averageDuration: 100 }
                },
                connections: { active: 10 },
                system: { memory: { heapUtilization: 0.5 } }
            };
            
            alertManager.checkMetrics(metrics);
            
            expect(mockCallback).toHaveBeenCalled();
            expect(secondCallback).toHaveBeenCalled();
        });

        test('should remove alert callbacks', () => {
            alertManager.removeAlertCallback(mockCallback);
            
            const metrics = {
                operations: {
                    'test-op': { errorRate: 0.15, averageDuration: 100 }
                },
                connections: { active: 10 },
                system: { memory: { heapUtilization: 0.5 } }
            };
            
            alertManager.checkMetrics(metrics);
            
            expect(mockCallback).not.toHaveBeenCalled();
        });

        test('should handle callback errors gracefully', () => {
            const errorCallback = jest.fn(() => {
                throw new Error('Callback error');
            });
            
            alertManager.addAlertCallback(errorCallback);
            
            const metrics = {
                operations: {
                    'test-op': { errorRate: 0.15, averageDuration: 100 }
                },
                connections: { active: 10 },
                system: { memory: { heapUtilization: 0.5 } }
            };
            
            // Should not throw despite callback error
            expect(() => alertManager.checkMetrics(metrics)).not.toThrow();
            expect(errorCallback).toHaveBeenCalled();
        });

        test('should track multiple alerts correctly', () => {
            const metrics = {
                operations: {
                    'op1': { errorRate: 0.15, averageDuration: 600 }, // Both alerts
                    'op2': { errorRate: 0.05, averageDuration: 700 }  // Only slow response
                },
                connections: { active: 1500 }, // Connection alert
                system: { memory: { heapUtilization: 0.9 } } // Memory alert
            };
            
            alertManager.thresholds.connectionCount = 1000;
            const alerts = alertManager.checkMetrics(metrics);
            
            expect(alerts).toHaveLength(5); // 2 + 1 + 1 + 1 = 5 alerts
            
            const alertTypes = alerts.map(a => a.type);
            expect(alertTypes).toContain('high_error_rate');
            expect(alertTypes).toContain('slow_response');
            expect(alertTypes).toContain('high_connection_count');
            expect(alertTypes).toContain('high_memory_usage');
        });
    });
});
