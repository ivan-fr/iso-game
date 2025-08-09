import { io as Client } from 'socket.io-client';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { jest } from '@jest/globals';

describe('Socket.IO Basic Functionality', () => {
    let io, serverSocket, clientSocket, httpServer, port;

    beforeAll((done) => {
        httpServer = createServer();
        io = new Server(httpServer);
        httpServer.listen(() => {
            port = httpServer.address().port;
            clientSocket = new Client(`http://localhost:${port}`);
            io.on('connection', (socket) => {
                serverSocket = socket;
            });
            clientSocket.on('connect', done);
        });
    });

    afterAll(() => {
        io.close();
        clientSocket.close();
        httpServer.close();
    });

    test('should communicate between client and server', (done) => {
        serverSocket.on('hello', (arg) => {
            expect(arg).toBe('world');
            done();
        });
        clientSocket.emit('hello', 'world');
    });

    test('should receive an event from the server', (done) => {
        clientSocket.on('an event', (payload) => {
            expect(payload).toBe('payload');
            done();
        });
        serverSocket.emit('an event', 'payload');
    });
});
