/**
 * Performance monitoring and metrics for multiplayer components
 */
export class PerformanceMonitor {
    constructor(options = {}) {
        this.enableLogging = options.enableLogging !== false;
        this.enableMetrics = options.enableMetrics !== false;
        this.sampleRate = options.timerSamplingRate || options.sampleRate || 1.0; // Support both names
        
        this.metrics = {
            operations: new Map(),
            responseTimeHistogram: new Map(),
            errorRates: new Map(),
            throughput: new Map(),
            activeConnections: 0,
            totalConnections: 0,
            peakConnections: 0,
            systemMetrics: {
                memoryUsage: [],
                cpuUsage: [],
                lastUpdated: Date.now()
            }
        };
        
        this.timers = new Map();
        this.startTime = Date.now();
        
        // Start system monitoring
        if (this.enableMetrics) {
            this.startSystemMonitoring();
        }
    }

    startTimer(operationId, metadata = {}) {
        if (Math.random() > this.sampleRate) return null;
        
        const timerId = `${operationId}-${Date.now()}-${Math.random()}`;
        this.timers.set(timerId, {
            startTime: performance.now(),
            operation: operationId,
            metadata
        });
        
        return timerId;
    }

    endTimer(timerId, result = 'success') {
        if (!timerId || !this.timers.has(timerId)) return null;
        
        const timer = this.timers.get(timerId);
        const duration = performance.now() - timer.startTime;
        
        this.timers.delete(timerId);
        
        this.recordOperation(timer.operation, duration, result, timer.metadata);
        
        return duration;
    }

    recordOperation(operation, duration, result = 'success', metadata = {}) {
        if (!this.enableMetrics) return;
        
        // Update operation metrics
        if (!this.metrics.operations.has(operation)) {
            this.metrics.operations.set(operation, {
                count: 0,
                totalDuration: 0,
                averageDuration: 0,
                minDuration: Infinity,
                maxDuration: 0,
                successCount: 0,
                errorCount: 0,
                lastExecuted: null
            });
        }
        
        const opMetrics = this.metrics.operations.get(operation);
        opMetrics.count++;
        opMetrics.totalDuration += duration;
        opMetrics.averageDuration = opMetrics.totalDuration / opMetrics.count;
        opMetrics.minDuration = Math.min(opMetrics.minDuration, duration);
        opMetrics.maxDuration = Math.max(opMetrics.maxDuration, duration);
        opMetrics.lastExecuted = Date.now();
        
        if (result === 'success') {
            opMetrics.successCount++;
        } else {
            opMetrics.errorCount++;
        }
        
        // Update response time histogram
        this.updateHistogram(operation, duration);
        
        // Update error rates
        this.updateErrorRate(operation, result === 'error');
        
        // Update throughput
        this.updateThroughput(operation);
        
        if (this.enableLogging && duration > 1000) { // Log slow operations
            console.warn(`[Performance] Slow operation detected: ${operation} took ${duration.toFixed(2)}ms`);
        }
    }

    updateHistogram(operation, duration) {
        if (!this.metrics.responseTimeHistogram.has(operation)) {
            this.metrics.responseTimeHistogram.set(operation, {
                buckets: {
                    '0-10ms': 0,
                    '10-50ms': 0,
                    '50-100ms': 0,
                    '100-500ms': 0,
                    '500-1000ms': 0,
                    '1000ms+': 0
                },
                percentiles: { p50: 0, p90: 0, p95: 0, p99: 0 },
                samples: []
            });
        }
        
        const histogram = this.metrics.responseTimeHistogram.get(operation);
        
        // Update buckets
        if (duration <= 10) histogram.buckets['0-10ms']++;
        else if (duration <= 50) histogram.buckets['10-50ms']++;
        else if (duration <= 100) histogram.buckets['50-100ms']++;
        else if (duration <= 500) histogram.buckets['100-500ms']++;
        else if (duration <= 1000) histogram.buckets['500-1000ms']++;
        else histogram.buckets['1000ms+']++;
        
        // Update samples for percentile calculation
        histogram.samples.push(duration);
        
        // Keep only last 1000 samples
        if (histogram.samples.length > 1000) {
            histogram.samples.shift();
        }
        
        // Calculate percentiles
        this.calculatePercentiles(histogram);
    }

    calculatePercentiles(histogram) {
        const sorted = [...histogram.samples].sort((a, b) => a - b);
        const len = sorted.length;
        
        if (len === 0) return;
        
        histogram.percentiles.p50 = this.getPercentile(sorted, 0.5);
        histogram.percentiles.p90 = this.getPercentile(sorted, 0.9);
        histogram.percentiles.p95 = this.getPercentile(sorted, 0.95);
        histogram.percentiles.p99 = this.getPercentile(sorted, 0.99);
    }

    getPercentile(sortedArray, percentile) {
        const index = Math.ceil(sortedArray.length * percentile) - 1;
        return sortedArray[Math.max(0, index)] || 0;
    }

    updateErrorRate(operation, isError) {
        if (!this.metrics.errorRates.has(operation)) {
            this.metrics.errorRates.set(operation, {
                total: 0,
                errors: 0,
                rate: 0,
                window: [],
                windowSize: 100 // Last 100 operations
            });
        }
        
        const errorRate = this.metrics.errorRates.get(operation);
        errorRate.total++;
        
        if (isError) {
            errorRate.errors++;
        }
        
        errorRate.window.push(isError ? 1 : 0);
        
        if (errorRate.window.length > errorRate.windowSize) {
            errorRate.window.shift();
        }
        
        // Calculate sliding window error rate
        const windowErrors = errorRate.window.reduce((sum, val) => sum + val, 0);
        errorRate.rate = windowErrors / errorRate.window.length;
    }

    updateThroughput(operation) {
        if (!this.metrics.throughput.has(operation)) {
            this.metrics.throughput.set(operation, {
                timestamps: [],
                current: 0, // ops/sec
                peak: 0,
                average: 0
            });
        }
        
        const throughput = this.metrics.throughput.get(operation);
        const now = Date.now();
        
        throughput.timestamps.push(now);
        
        // Keep only timestamps from last minute
        const oneMinuteAgo = now - 60000;
        throughput.timestamps = throughput.timestamps.filter(ts => ts > oneMinuteAgo);
        
        // Calculate current throughput (ops per second)
        throughput.current = throughput.timestamps.length / 60;
        throughput.peak = Math.max(throughput.peak, throughput.current);
        
        // Calculate average throughput since start
        const totalTime = (now - this.startTime) / 1000; // seconds
        const totalOps = this.metrics.operations.get(operation)?.count || 0;
        throughput.average = totalOps / totalTime;
    }

    recordConnection(type = 'connect') {
        if (type === 'connect') {
            this.metrics.activeConnections++;
            this.metrics.totalConnections++;
            this.metrics.peakConnections = Math.max(
                this.metrics.peakConnections, 
                this.metrics.activeConnections
            );
        } else if (type === 'disconnect') {
            this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);
        }
    }

    startSystemMonitoring() {
        const interval = setInterval(() => {
            this.recordSystemMetrics();
        }, 30000); // Every 30 seconds
        
        // Clean up interval when needed
        this.systemInterval = interval;
    }

    recordSystemMetrics() {
        const memory = process.memoryUsage();
        const now = Date.now();
        
        this.metrics.systemMetrics.memoryUsage.push({
            timestamp: now,
            heapUsed: memory.heapUsed,
            heapTotal: memory.heapTotal,
            external: memory.external,
            rss: memory.rss
        });
        
        // Keep only last 100 samples (50 minutes of data)
        if (this.metrics.systemMetrics.memoryUsage.length > 100) {
            this.metrics.systemMetrics.memoryUsage.shift();
        }
        
        this.metrics.systemMetrics.lastUpdated = now;
    }

    getMetrics() {
        const operations = {};
        for (const [op, metrics] of this.metrics.operations) {
            operations[op] = {
                ...metrics,
                errorRate: metrics.count > 0 ? metrics.errorCount / metrics.count : 0,
                successRate: metrics.count > 0 ? metrics.successCount / metrics.count : 0
            };
        }
        
        const histograms = {};
        for (const [op, histogram] of this.metrics.responseTimeHistogram) {
            histograms[op] = histogram;
        }
        
        const errorRates = {};
        for (const [op, rate] of this.metrics.errorRates) {
            errorRates[op] = rate;
        }
        
        const throughput = {};
        for (const [op, tp] of this.metrics.throughput) {
            throughput[op] = tp;
        }
        
        return {
            operations,
            histograms,
            errorRates,
            throughput,
            connections: {
                active: this.metrics.activeConnections,
                total: this.metrics.totalConnections,
                peak: this.metrics.peakConnections
            },
            system: this.getSystemMetrics(),
            uptime: Date.now() - this.startTime
        };
    }

    getSystemMetrics() {
        const recent = this.metrics.systemMetrics.memoryUsage.slice(-10); // Last 10 samples
        
        if (recent.length === 0) return null;
        
        const avgMemory = recent.reduce((acc, sample) => ({
            heapUsed: acc.heapUsed + sample.heapUsed,
            heapTotal: acc.heapTotal + sample.heapTotal,
            external: acc.external + sample.external,
            rss: acc.rss + sample.rss
        }), { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 });
        
        const len = recent.length;
        return {
            memory: {
                heapUsed: Math.round(avgMemory.heapUsed / len),
                heapTotal: Math.round(avgMemory.heapTotal / len),
                external: Math.round(avgMemory.external / len),
                rss: Math.round(avgMemory.rss / len),
                heapUtilization: avgMemory.heapUsed / avgMemory.heapTotal
            },
            lastUpdated: this.metrics.systemMetrics.lastUpdated
        };
    }

    getHealthScore() {
        const metrics = this.getMetrics();
        let score = 100;
        let issues = [];
        
        // Check operation performance
        for (const [op, opMetrics] of Object.entries(metrics.operations)) {
            if (opMetrics.errorRate > 0.05) { // > 5% error rate
                score -= 20;
                issues.push(`High error rate for ${op}: ${(opMetrics.errorRate * 100).toFixed(1)}%`);
            }
            
            if (opMetrics.averageDuration > 1000) { // > 1 second average
                score -= 15;
                issues.push(`Slow average response time for ${op}: ${opMetrics.averageDuration.toFixed(0)}ms`);
            }
        }
        
        // Check system metrics
        const system = metrics.system;
        if (system && system.memory.heapUtilization > 0.9) { // > 90% heap usage
            score -= 25;
            issues.push(`High memory usage: ${(system.memory.heapUtilization * 100).toFixed(1)}%`);
        }
        
        // Check connection metrics
        if (metrics.connections.active > 1000) { // High connection count
            score -= 10;
            issues.push(`High connection count: ${metrics.connections.active}`);
        }
        
        return {
            score: Math.max(0, score),
            status: score >= 80 ? 'healthy' : score >= 60 ? 'warning' : 'critical',
            issues
        };
    }

    reset() {
        this.metrics.operations.clear();
        this.metrics.responseTimeHistogram.clear();
        this.metrics.errorRates.clear();
        this.metrics.throughput.clear();
        this.metrics.activeConnections = 0;
        this.metrics.totalConnections = 0;
        this.metrics.peakConnections = 0;
        this.metrics.systemMetrics.memoryUsage = [];
        this.timers.clear();
        this.startTime = Date.now();
    }

    stop() {
        if (this.systemInterval) {
            clearInterval(this.systemInterval);
            this.systemInterval = null;
        }
    }
}

export class AlertManager {
    constructor(options = {}) {
        this.thresholds = {
            errorRate: options.errorRateThreshold || 0.05, // 5%
            responseTime: options.responseTimeThreshold || 1000, // 1 second
            memoryUsage: options.memoryThreshold || 0.9, // 90%
            connectionCount: options.connectionThreshold || 1000,
            ...options.thresholds
        };
        
        this.callbacks = new Set();
        this.lastAlerts = new Map();
        this.cooldownPeriod = options.cooldownPeriod || 300000; // 5 minutes
    }

    addAlertCallback(callback) {
        this.callbacks.add(callback);
    }

    removeAlertCallback(callback) {
        this.callbacks.delete(callback);
    }

    checkMetrics(metrics) {
        const alerts = [];
        
        // Check operation metrics
        for (const [operation, opMetrics] of Object.entries(metrics.operations)) {
            if (opMetrics.errorRate > this.thresholds.errorRate) {
                alerts.push({
                    type: 'high_error_rate',
                    operation,
                    value: opMetrics.errorRate,
                    threshold: this.thresholds.errorRate,
                    message: `High error rate for ${operation}: ${(opMetrics.errorRate * 100).toFixed(1)}%`
                });
            }
            
            if (opMetrics.averageDuration > this.thresholds.responseTime) {
                alerts.push({
                    type: 'slow_response',
                    operation,
                    value: opMetrics.averageDuration,
                    threshold: this.thresholds.responseTime,
                    message: `Slow response time for ${operation}: ${opMetrics.averageDuration.toFixed(0)}ms`
                });
            }
        }
        
        // Check system metrics
        if (metrics.system && metrics.system.memory.heapUtilization > this.thresholds.memoryUsage) {
            alerts.push({
                type: 'high_memory_usage',
                value: metrics.system.memory.heapUtilization,
                threshold: this.thresholds.memoryUsage,
                message: `High memory usage: ${(metrics.system.memory.heapUtilization * 100).toFixed(1)}%`
            });
        }
        
        // Check connection count
        if (metrics.connections.active > this.thresholds.connectionCount) {
            alerts.push({
                type: 'high_connection_count',
                value: metrics.connections.active,
                threshold: this.thresholds.connectionCount,
                message: `High connection count: ${metrics.connections.active}`
            });
        }
        
        // Fire alerts (with cooldown)
        for (const alert of alerts) {
            this.fireAlert(alert);
        }
        
        return alerts;
    }

    fireAlert(alert) {
        const alertKey = `${alert.type}-${alert.operation || 'system'}`;
        const now = Date.now();
        const lastAlert = this.lastAlerts.get(alertKey);
        
        // Check cooldown
        if (lastAlert && (now - lastAlert) < this.cooldownPeriod) {
            return;
        }
        
        this.lastAlerts.set(alertKey, now);
        
        // Notify all callbacks
        for (const callback of this.callbacks) {
            try {
                callback(alert);
            } catch (error) {
                console.error('Error in alert callback:', error);
            }
        }
    }
}

// Global performance monitor instance
export const globalPerformanceMonitor = new PerformanceMonitor({
    enableLogging: true,
    enableMetrics: true,
    sampleRate: 0.1 // 10% sampling to reduce overhead
});

// Global alert manager
export const globalAlertManager = new AlertManager({
    errorRateThreshold: 0.05,
    responseTimeThreshold: 1000,
    memoryThreshold: 0.85
});

// Set up automatic alert checking
globalAlertManager.addAlertCallback((alert) => {
    console.warn(`[ALERT] ${alert.message}`);
});

// Check alerts every minute
setInterval(() => {
    const metrics = globalPerformanceMonitor.getMetrics();
    globalAlertManager.checkMetrics(metrics);
}, 60000);
