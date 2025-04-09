from flask import Flask, send_from_directory, request
from flask_socketio import SocketIO, emit

app = Flask(__name__, static_folder='public/dist')
socketio = SocketIO(app, cors_allowed_origins="*")

# Store active offers
active_offers = {}

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

@socketio.on('connect')
def handle_connect():
    print(f'User connected: {request.sid}')

@socketio.on('offer')
def handle_offer(data):
    name = data.get('name')
    offer = data.get('offer')
    print(f'New offer from {name} ({request.sid})')
    active_offers[request.sid] = {'name': name, 'offer': offer}
    emit('offers-update', list(active_offers.items()), broadcast=True)

@socketio.on('answer')
def handle_answer(data):
    target_id = data.get('targetId')
    answer = data.get('answer')
    print(f'Answer from {request.sid} to {target_id}')
    emit('answer', {'answer': answer, 'from': request.sid}, room=target_id)

@socketio.on('ice-candidate')
def handle_ice_candidate(data):
    target_id = data.get('targetId')
    candidate = data.get('candidate')
    print(f'ICE candidate from {request.sid} to {target_id}')
    emit('ice-candidate', {'candidate': candidate, 'from': request.sid}, room=target_id)

@socketio.on('disconnect')
def handle_disconnect():
    print(f'User disconnected: {request.sid}')
    active_offers.pop(request.sid, None)
    emit('offers-update', list(active_offers.items()), broadcast=True)

if __name__ == '__main__':
    socketio.run(app, port=3000)
