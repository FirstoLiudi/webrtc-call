const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// Store active offers
const activeOffers = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Handle new offer
    socket.on('offer', ({ name, offer }) => {
        console.log(`New offer from ${name} (${socket.id})`);
        activeOffers.set(socket.id, { name, offer });
        io.emit('offers-update', Array.from(activeOffers.entries()));
    });

    // Handle answer
    socket.on('answer', ({ targetId, answer }) => {
        console.log(`Answer from ${socket.id} to ${targetId}`);
        io.to(targetId).emit('answer', { answer, from: socket.id });
    });

    // Handle ICE candidates
    socket.on('ice-candidate', ({ targetId, candidate }) => {
        console.log(`ICE candidate from ${socket.id} to ${targetId}`);
        io.to(targetId).emit('ice-candidate', { candidate, from: socket.id });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        activeOffers.delete(socket.id);
        io.emit('offers-update', Array.from(activeOffers.entries()));
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 