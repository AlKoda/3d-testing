const elements = {
  joinOverlay: document.querySelector('#joinOverlay'),
  joinButton: document.querySelector('#joinButton'),
  nameInput: document.querySelector('#nameInput'),
  roomInput: document.querySelector('#roomInput'),
  roomLabel: document.querySelector('#roomLabel'),
  copyButton: document.querySelector('#copyButton'),
  connection: document.querySelector('.connection'),
  connectionText: document.querySelector('#connectionText'),
  blueName: document.querySelector('#blueName'),
  redName: document.querySelector('#redName'),
  blueScore: document.querySelector('#blueScore'),
  redScore: document.querySelector('#redScore'),
  round: document.querySelector('#round'),
  question: document.querySelector('#question'),
  answerForm: document.querySelector('#answerForm'),
  answerInput: document.querySelector('#answerInput'),
  answerButton: document.querySelector('#answerButton'),
  status: document.querySelector('#status'),
  pullLabel: document.querySelector('#pullLabel'),
  arena: document.querySelector('#arena'),
  rope: document.querySelector('#rope'),
  spectatorCount: document.querySelector('#spectatorCount'),
  rematchButton: document.querySelector('#rematchButton'),
  toast: document.querySelector('#toast')
};

let socket;
let side = -1;
let currentRoom = '';
let reconnectAttempts = 0;
let shouldReconnect = false;
let joinedName = '';
let lastState = null;
let toastTimer;

const urlRoom = new URLSearchParams(location.search).get('room');
if (urlRoom) elements.roomInput.value = urlRoom.toUpperCase();

function randomRoom() {
  return `PULL-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function websocketUrl() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}`;
}

function setConnection(online, text) {
  elements.connection.classList.toggle('online', online);
  elements.connectionText.textContent = text;
}

function toast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 2200);
}

function connect() {
  setConnection(false, 'CONNECTING');
  socket = new WebSocket(websocketUrl());
  socket.addEventListener('open', () => {
    reconnectAttempts = 0;
    setConnection(true, 'LIVE');
    socket.send(JSON.stringify({ type: 'join', name: joinedName, room: currentRoom }));
  });
  socket.addEventListener('message', event => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    handleMessage(message);
  });
  socket.addEventListener('close', () => {
    setConnection(false, 'RECONNECTING');
    disableAnswer();
    if (shouldReconnect && reconnectAttempts < 8) {
      const delay = Math.min(8000, 500 * 2 ** reconnectAttempts++);
      setTimeout(connect, delay);
    } else if (shouldReconnect) {
      setStatus('Connection lost. Refresh to try again.', 'bad');
    }
  });
  socket.addEventListener('error', () => socket.close());
}

function handleMessage(message) {
  if (message.type === 'joined') {
    side = message.side;
    currentRoom = message.room;
    elements.roomLabel.textContent = currentRoom;
    const url = new URL(location.href);
    url.searchParams.set('room', currentRoom);
    history.replaceState({}, '', url);
    elements.joinOverlay.classList.add('hidden');
    toast(side < 0 ? 'Room full — spectating' : `You joined ${side ? 'Crimson' : 'Cobalt'} Crew`);
  }

  if (message.type === 'state') renderState(message);
  if (message.type === 'notice') toast(message.message);
  if (message.type === 'answer' && !message.correct) {
    setStatus('Not quite! Your rival still has a chance.', 'bad');
    elements.answerInput.classList.add('shake');
  }
  if (message.type === 'miss' && message.side !== side) setStatus(`${message.name} missed — solve it now!`, 'good');
  if (message.type === 'point') animatePoint(message);
  if (message.type === 'winner') showWinner(message);
}

function renderState(state) {
  lastState = state;
  elements.blueName.textContent = state.players[0]?.name || 'WAITING…';
  elements.redName.textContent = state.players[1]?.name || 'WAITING…';
  elements.blueScore.textContent = state.score[0];
  elements.redScore.textContent = state.score[1];
  elements.round.textContent = state.round;
  elements.spectatorCount.textContent = `${state.spectators} WATCHING`;
  const pullPercent = ((state.score[1] - state.score[0]) / state.winScore) * 42;
  elements.rope.style.transform = `translateX(${pullPercent}%)`;

  if (state.phase === 'playing') {
    elements.question.textContent = state.question;
    if (side >= 0) {
      elements.answerInput.disabled = false;
      elements.answerButton.disabled = false;
      elements.answerInput.value = '';
      elements.answerInput.focus();
      setStatus('Answer correctly before your rival!');
    } else {
      setStatus('You are watching this match.');
    }
    elements.pullLabel.textContent = 'THE ROPE IS LIVE!';
  } else if (state.phase === 'waiting') {
    elements.question.textContent = '? + ?';
    elements.pullLabel.textContent = 'WAITING FOR A RIVAL…';
    setStatus(side < 0 ? 'Watching the arena.' : 'Share the room link with a friend to begin.');
    disableAnswer();
  } else if (state.phase === 'between') {
    elements.question.textContent = 'GET READY';
    disableAnswer();
  } else if (state.phase === 'finished') {
    disableAnswer();
    if (side >= 0) elements.rematchButton.hidden = false;
  }
}

function disableAnswer() {
  elements.answerInput.disabled = true;
  elements.answerButton.disabled = true;
}

function setStatus(text, type = '') {
  elements.status.textContent = text;
  elements.status.className = `status ${type}`;
}

function animatePoint(message) {
  elements.arena.classList.remove('pull-blue', 'pull-red');
  void elements.arena.offsetWidth;
  elements.arena.classList.add(message.side ? 'pull-red' : 'pull-blue');
  const seconds = (message.responseTime / 1000).toFixed(2);
  elements.pullLabel.textContent = `${message.name.toUpperCase()} PULLS!`;
  setStatus(`${message.name} solved it in ${seconds}s`, message.side === side ? 'good' : 'bad');
  disableAnswer();
  setTimeout(() => elements.arena.classList.remove('pull-blue', 'pull-red'), 650);
}

function showWinner(message) {
  elements.question.textContent = message.side === side ? 'YOU WIN!' : `${message.name.toUpperCase()} WINS!`;
  elements.pullLabel.textContent = `${message.name.toUpperCase()} TAKES THE MATCH!`;
  setStatus(message.side === side ? 'Champion of the arena! 🏆' : 'Great battle — demand a rematch!');
  elements.rematchButton.hidden = side < 0;
}

elements.joinButton.addEventListener('click', () => {
  joinedName = elements.nameInput.value.trim() || 'Player';
  currentRoom = elements.roomInput.value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '') || randomRoom();
  shouldReconnect = true;
  elements.joinButton.disabled = true;
  elements.joinButton.textContent = 'CONNECTING…';
  connect();
});

elements.answerForm.addEventListener('submit', event => {
  event.preventDefault();
  if (!socket || socket.readyState !== WebSocket.OPEN || elements.answerInput.value === '') return;
  socket.send(JSON.stringify({ type: 'answer', answer: elements.answerInput.value }));
  disableAnswer();
});

elements.copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    toast('Room link copied — send it to a friend!');
  } catch {
    toast(`Room code: ${currentRoom}`);
  }
});

elements.rematchButton.addEventListener('click', () => {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'restart' }));
  elements.rematchButton.hidden = true;
});
