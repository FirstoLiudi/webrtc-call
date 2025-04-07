// DOM elements
const nameInput = document.getElementById('name-input');
const startBtn = document.getElementById('start-btn');
const loginSection = document.getElementById('login-section');
const videoSection = document.getElementById('video-section');
const webcamVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const peersList = document.getElementById('peers');

// WebRTC configuration
const configuration = {
    iceServers: [
        {
            "urls": "turn:turn.speed.cloudflare.com:50000",
            "username": "f51d4d2ab6dd796c674a5f4c50eab41e38508bf7441bd03126aa8aee68e1be306667637ce7bf4f8bf81d9d287dbfab966fcb7f63a3d951fb30d5af2291f79347",
            "credential": "aba9b169546eb6dcc7bfb1cdf34544cf95b5161d602e3b5fa7c8342b2e9802fb"
        }
    ],
    iceCandidatePoolSize: 10,
};

// Global State
const socket = io();
const pc=new RTCPeerConnection(configuration);
let localStream;
let remoteStream;
let currentPeerId;
let iceCandidateBuffer = []; // Buffer to store ICE candidates when no peer is selected

// Start video call
startBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) {
        alert('Please enter your name');
        return;
    }

    try {
        loginSection.style.display = 'none';
        videoSection.style.display = 'block';
    
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        remoteStream = new MediaStream();
        
        // Add local stream
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
    
        // Handle remote stream
        pc.ontrack = event => {
            event.streams[0].getTracks().forEach((track) => {
                remoteStream.addTrack(track);
            });
        };

        webcamVideo.srcObject = localStream;
        remoteVideo.srcObject = remoteStream;
        
        // Handle ICE candidates
        pc.onicecandidate = event => {
            if (event.candidate) 
                if (!currentPeerId) {
                    iceCandidateBuffer.push(event.candidate.toJSON());
                    console.log('stored ice candidate in buffer:', iceCandidateBuffer);
                } else {
                    console.log('ice candidate:',`${currentPeerId}`, event.candidate);
                    socket.emit('ice-candidate', {
                        targetId: currentPeerId,
                        candidate: event.candidate.toJSON()
                    });
                }
        };
        
        const offerDescription = await pc.createOffer();
        await pc.setLocalDescription(offerDescription);

        const offer = {
          sdp: offerDescription.sdp,
          type: offerDescription.type,
        };
        
        socket.emit('offer', { name, offer });
    } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Error accessing camera and microphone');
    }
});

// Socket event handlers
socket.on('offers-update', (offers) => {
    peersList.innerHTML = '';
    offers.forEach(([peerId, data]) => {
        if (peerId !== socket.id) {
            const li = document.createElement('li');
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'peer-name';
            nameSpan.textContent = data.name;
            
            const callButton = document.createElement('button');
            callButton.className = 'call-btn';
            callButton.textContent = 'Call';
            callButton.addEventListener('click', () => {
                answerPeer(peerId, data.name, data.offer);
            });
            
            li.appendChild(nameSpan);
            li.appendChild(callButton);
            peersList.appendChild(li);
        }
    });
});

socket.on('answer', async ({ answer, from }) => {
    console.log('answer:', answer, from);
    currentPeerId = from;
    if (iceCandidateBuffer.length > 0) {
        iceCandidateBuffer.forEach(candidate => {
            socket.emit('ice-candidate', {
                targetId: currentPeerId,
                candidate: candidate
            });
        });
        iceCandidateBuffer = [];
    }
    try {
        console.log('answering:', answer);
        const answerDescription = new RTCSessionDescription(answer);
        await pc.setRemoteDescription(answerDescription);
        console.log('answered:', answer);
    } catch (error) {
        console.error('Error setting remote description:', error);
    }
});

socket.on('ice-candidate', ({ candidate, from }) => {
    console.log('new ice candidate:',`${from}`, candidate);
    pc.addIceCandidate(new RTCIceCandidate(candidate));
});

async function answerPeer(peerId, peerName, offer) {
    currentPeerId = peerId;
    
    try {
        console.log('answering peer:', peerId, peerName, offer);
        // Set the remote description (offer) first
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Create an answer to the peer's offer
        const answerDescription = await pc.createAnswer();
        await pc.setLocalDescription(answerDescription);

        const answer = {
            type: answerDescription.type,
            sdp: answerDescription.sdp,
        };

        console.log('answered peer:', peerId, peerName, answer);
        
        // Send the answer back to the peer
        socket.emit('answer', {
            targetId: peerId,
            answer: answer
        });
        
        console.log(`Answering call from ${peerName}`);
    } catch (error) {
        console.error('Error creating answer:', error);
    }
} 