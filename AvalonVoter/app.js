/**
 * Avalon Voter - Main Application
 * Pure JavaScript implementation
 */

// ============================================
// CONSTANTS
// ============================================
const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#78716c'
];

const GamePhase = {
  LOBBY: 'LOBBY',
  TEAM_SELECTION: 'TEAM_SELECTION',
  TEAM_VOTE: 'TEAM_VOTE',
  MISSION_VOTING: 'MISSION_VOTING',
  RESULT_REVEAL: 'RESULT_REVEAL'
};

const FLAVOR_TEMPLATES = [
  "The team infiltrates the target zone under cover of darkness.",
  "Agents move through the neon-lit streets, their objectives classified.",
  "The operation commences as digital ghosts slip past security.",
  "Under electromagnetic interference, the squad advances silently.",
  "The rendezvous point glows faintly in the midnight fog.",
  "Encrypted channels crackle as the mission enters its critical phase."
];

// ============================================
// APPLICATION STATE
// ============================================
const App = {
  // Lobby state
  mode: 'MENU', // MENU, CREATE, JOIN
  playerName: '',
  avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)],
  targetRoomId: '',

  // Game state
  isHost: false,
  myPeerId: '',
  gameState: {
    phase: GamePhase.LOBBY,
    players: [],
    currentTeam: [],
    votesReceived: 0,
    missionHistory: [],
    roomId: ''
  },
  flavorText: '',
  hasVoted: false,
  votesBuffer: [], // Host only - for mission votes
  teamVotesBuffer: [], // Host only - for team approval votes {playerId, playerName, vote}
  connectionCheckInterval: null, // Interval for checking connections

  // Peer manager reference
  peerManager: null
};

// ============================================
// DOM ELEMENTS
// ============================================
const DOM = {
  // Views
  lobbyView: null,
  roomView: null,

  // Lobby elements
  identitySection: null,
  avatarPreview: null,
  playerNameInput: null,
  colorPicker: null,
  menuMode: null,
  createMode: null,
  joinMode: null,
  btnCreate: null,
  btnJoin: null,
  btnCreateBack: null,
  btnCreateStart: null,
  btnJoinBack: null,
  btnJoinConnect: null,
  roomIdInput: null,
  roomIdInputSection: null,
  roomIdDisplay: null,
  roomIdPreview: null,

  // Room elements
  displayRoomId: null,
  notification: null,
  phaseBadge: null,
  missionNumber: null,
  leaderDisplay: null,
  leaderName: null,
  flavorText: null,
  phaseContent: null,
  actionButtonContainer: null,
  playersGrid: null,
  historySection: null,
  historyList: null,
  votingOverlay: null,

  // Modal
  qrModal: null,
  qrImage: null,
  modalRoomId: null,

  // Buttons
  btnQr: null,
  btnCopy: null,
  btnLeave: null,
  btnCloseQr: null,
  btnModalCopy: null,
  btnVoteApprove: null,
  btnVoteDisapprove: null
};

// ============================================
// INITIALIZATION
// ============================================
function initApp() {
  cacheDOM();
  bindEvents();
  initColorPicker();
  updateAvatarPreview();
  checkUrlForRoom();
}

function cacheDOM() {
  // Views
  DOM.lobbyView = document.getElementById('lobby-view');
  DOM.roomView = document.getElementById('room-view');

  // Lobby
  DOM.identitySection = document.getElementById('identity-section');
  DOM.avatarPreview = document.getElementById('avatar-preview');
  DOM.playerNameInput = document.getElementById('player-name');
  DOM.colorPicker = document.getElementById('color-picker');
  DOM.menuMode = document.getElementById('menu-mode');
  DOM.createMode = document.getElementById('create-mode');
  DOM.joinMode = document.getElementById('join-mode');
  DOM.btnCreate = document.getElementById('btn-create');
  DOM.btnJoin = document.getElementById('btn-join');
  DOM.btnCreateBack = document.getElementById('btn-create-back');
  DOM.btnCreateStart = document.getElementById('btn-create-start');
  DOM.btnJoinBack = document.getElementById('btn-join-back');
  DOM.btnJoinConnect = document.getElementById('btn-join-connect');
  DOM.roomIdInput = document.getElementById('room-id-input');
  DOM.roomIdInputSection = document.getElementById('room-id-input-section');
  DOM.roomIdDisplay = document.getElementById('room-id-display');
  DOM.roomIdPreview = document.getElementById('room-id-preview');

  // Room
  DOM.displayRoomId = document.getElementById('display-room-id');
  DOM.notification = document.getElementById('notification');
  DOM.phaseBadge = document.getElementById('phase-badge');
  DOM.missionNumber = document.getElementById('mission-number');
  DOM.leaderDisplay = document.getElementById('leader-display');
  DOM.leaderName = document.getElementById('leader-name');
  DOM.flavorText = document.getElementById('flavor-text');
  DOM.phaseContent = document.getElementById('phase-content');
  DOM.actionButtonContainer = document.getElementById('action-button-container');
  DOM.playersGrid = document.getElementById('players-grid');
  DOM.historySection = document.getElementById('history-section');
  DOM.historyList = document.getElementById('history-list');
  DOM.votingOverlay = document.getElementById('voting-overlay');

  // Modal
  DOM.qrModal = document.getElementById('qr-modal');
  DOM.qrImage = document.getElementById('qr-image');
  DOM.modalRoomId = document.getElementById('modal-room-id');

  // Buttons
  DOM.btnQr = document.getElementById('btn-qr');
  DOM.btnCopy = document.getElementById('btn-copy');
  DOM.btnLeave = document.getElementById('btn-leave');
  DOM.btnCloseQr = document.getElementById('btn-close-qr');
  DOM.btnModalCopy = document.getElementById('btn-modal-copy');
  DOM.btnVoteApprove = document.getElementById('btn-vote-approve');
  DOM.btnVoteDisapprove = document.getElementById('btn-vote-disapprove');
}

function bindEvents() {
  // Lobby navigation
  DOM.btnCreate.addEventListener('click', () => setLobbyMode('CREATE'));
  DOM.btnJoin.addEventListener('click', () => setLobbyMode('JOIN'));
  DOM.btnCreateBack.addEventListener('click', () => setLobbyMode('MENU'));
  DOM.btnJoinBack.addEventListener('click', () => setLobbyMode('MENU'));

  // Input handlers
  DOM.playerNameInput.addEventListener('input', handleNameInput);
  DOM.roomIdInput.addEventListener('input', handleRoomIdInput);

  // Action buttons
  DOM.btnCreateStart.addEventListener('click', handleCreateRoom);
  DOM.btnJoinConnect.addEventListener('click', handleJoinRoom);

  // Room buttons
  DOM.btnQr.addEventListener('click', showQrModal);
  DOM.btnCopy.addEventListener('click', copyJoinLink);
  DOM.btnLeave.addEventListener('click', handleLeaveRoom);
  DOM.btnCloseQr.addEventListener('click', hideQrModal);
  DOM.btnModalCopy.addEventListener('click', copyJoinLink);

  // Modal backdrop
  DOM.qrModal.querySelector('.modal-backdrop').addEventListener('click', hideQrModal);

  // Voting
  DOM.btnVoteApprove.addEventListener('click', () => submitVote('APPROVE'));
  DOM.btnVoteDisapprove.addEventListener('click', () => submitVote('DISAPPROVE'));
}

function initColorPicker() {
  DOM.colorPicker.innerHTML = '';
  COLORS.forEach(color => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'color-btn' + (color === App.avatarColor ? ' selected' : '');
    btn.style.backgroundColor = color;
    btn.addEventListener('click', () => selectColor(color));
    DOM.colorPicker.appendChild(btn);
  });
}

function checkUrlForRoom() {
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam) {
    App.targetRoomId = roomParam;
    setLobbyMode('JOIN');
  }
}

// ============================================
// LOBBY FUNCTIONS
// ============================================
function setLobbyMode(mode) {
  App.mode = mode;

  // Hide all modes
  DOM.menuMode.classList.add('hidden');
  DOM.createMode.classList.add('hidden');
  DOM.joinMode.classList.add('hidden');
  DOM.identitySection.classList.add('hidden');

  // Show appropriate mode
  switch (mode) {
    case 'MENU':
      DOM.menuMode.classList.remove('hidden');
      break;
    case 'CREATE':
      DOM.createMode.classList.remove('hidden');
      DOM.identitySection.classList.remove('hidden');
      DOM.playerNameInput.focus();
      break;
    case 'JOIN':
      DOM.joinMode.classList.remove('hidden');
      DOM.identitySection.classList.remove('hidden');
      updateJoinModeUI();
      DOM.playerNameInput.focus();
      break;
  }

  updateButtonStates();
}

function updateJoinModeUI() {
  if (App.targetRoomId) {
    DOM.roomIdInputSection.classList.add('hidden');
    DOM.roomIdDisplay.classList.remove('hidden');
    DOM.roomIdPreview.textContent = App.targetRoomId.slice(0, 8) + '...';
  } else {
    DOM.roomIdInputSection.classList.remove('hidden');
    DOM.roomIdDisplay.classList.add('hidden');
  }
}

function selectColor(color) {
  App.avatarColor = color;
  
  // Update selected state
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.style.backgroundColor === color);
  });
  
  updateAvatarPreview();
}

function updateAvatarPreview() {
  DOM.avatarPreview.style.background = `linear-gradient(145deg, ${App.avatarColor}, ${App.avatarColor}aa)`;
}

function handleNameInput(e) {
  App.playerName = e.target.value.trim();
  updateButtonStates();
}

function handleRoomIdInput(e) {
  App.targetRoomId = e.target.value.trim();
  updateButtonStates();
}

function updateButtonStates() {
  const hasName = App.playerName.length > 0;
  const hasRoomId = App.targetRoomId.length > 0;

  DOM.btnCreateStart.disabled = !hasName;
  DOM.btnJoinConnect.disabled = !hasName || !hasRoomId;
}

// ============================================
// ROOM CREATION/JOINING
// ============================================
function handleCreateRoom() {
  App.isHost = true;
  initPeerConnection();
}

function handleJoinRoom() {
  App.isHost = false;
  initPeerConnection();
}

function initPeerConnection() {
  App.peerManager = new PeerManager({
    isHost: App.isHost,
    targetRoomId: App.targetRoomId,
    playerName: App.playerName,
    avatarSeed: App.avatarColor,
    onOpen: handlePeerOpen,
    onMessage: handleMessage,
    onPlayerJoined: handlePlayerJoined,
    onPlayerLeft: handlePlayerLeft,
    onError: handlePeerError,
    onDisconnect: handleDisconnect
  });
}

function handlePeerOpen(peerId) {
  App.myPeerId = peerId;

  if (App.isHost) {
    // Initialize host game state
    App.gameState = {
      phase: GamePhase.TEAM_SELECTION,
      players: [{
        id: peerId,
        name: App.playerName,
        avatarSeed: App.avatarColor,
        isHost: true,
        isConnected: true
      }],
      currentTeam: [],
      votesReceived: 0,
      missionHistory: [],
      roomId: peerId
    };

    showRoomView();
    showQrModal();
    startConnectionCheck();
  } else {
    showNotification('Connecting to room...');
  }
}

function handlePlayerJoined(player) {
  if (App.isHost) {
    // Add player to game state
    if (!App.gameState.players.find(p => p.id === player.id)) {
      App.gameState.players.push({
        ...player,
        isHost: false,
        isConnected: true
      });
      broadcastState();
    }
  }
  renderPlayers();
}

function handlePlayerLeft(peerId) {
  if (App.isHost) {
    // Remove the player completely instead of marking as disconnected
    removePlayer(peerId);
  }
  renderPlayers();
}

function handlePeerError(error) {
  console.error('Peer error:', error);
  showNotification('Connection error');
}

function handleDisconnect() {
  showNotification('Disconnected from room');
}

// Remove a player from the game (host only)
function removePlayer(playerId) {
  if (!App.isHost) return;
  
  const playerIndex = App.gameState.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return;
  
  const player = App.gameState.players[playerIndex];
  
  // Notify the player they're being kicked
  App.peerManager.sendTo(playerId, { type: 'KICKED' });
  
  // Disconnect the peer connection
  App.peerManager.disconnectPeer(playerId);
  
  // Remove from players array
  App.gameState.players.splice(playerIndex, 1);
  
  // Remove from current team if selected
  const teamIndex = App.gameState.currentTeam.indexOf(playerId);
  if (teamIndex > -1) {
    App.gameState.currentTeam.splice(teamIndex, 1);
  }
  
  showNotification(`${player.name} was removed`);
  broadcastState();
  renderRoom();
}

// Start connection checking interval (host only)
function startConnectionCheck() {
  if (!App.isHost || App.connectionCheckInterval) return;
  
  App.connectionCheckInterval = setInterval(() => {
    if (!App.peerManager) return;
    
    const connectedPeerIds = App.peerManager.getConnectedPeers();
    
    // Check each non-host player
    App.gameState.players.forEach(player => {
      if (player.isHost) return; // Skip host
      
      const isConnected = connectedPeerIds.includes(player.id);
      
      if (!isConnected && player.isConnected) {
        // Player just disconnected - remove them
        console.log('[ConnectionCheck] Player disconnected:', player.name);
        removePlayer(player.id);
      }
    });
  }, 1000);
}

// Stop connection checking interval
function stopConnectionCheck() {
  if (App.connectionCheckInterval) {
    clearInterval(App.connectionCheckInterval);
    App.connectionCheckInterval = null;
  }
}

// ============================================
// MESSAGE HANDLING
// ============================================
function handleMessage(msg, senderId) {
  if (App.isHost) {
    handleHostMessage(msg, senderId);
  } else {
    handleClientMessage(msg, senderId);
  }
}

function handleHostMessage(msg, senderId) {
  switch (msg.type) {
    case 'JOIN':
      const newPlayer = {
        id: senderId,
        name: msg.payload.name,
        avatarSeed: msg.payload.avatarSeed,
        isHost: false,
        isConnected: true
      };
      
      if (!App.gameState.players.find(p => p.id === senderId)) {
        App.gameState.players.push(newPlayer);
      }
      
      // Send current state to new player
      App.peerManager.sendTo(senderId, {
        type: 'SYNC_STATE',
        payload: App.gameState
      });
      
      broadcastState();
      break;

    case 'UPDATE_TEAM':
      // Any player can update the team selection
      App.gameState.currentTeam = msg.payload;
      broadcastState();
      break;

    case 'REMOVE_PLAYER':
      // Only host can remove players
      if (App.isHost) {
        removePlayer(msg.payload.playerId);
      }
      break;

    case 'START_VOTE':
      // Allow any player to initiate team vote
      startTeamVoting();
      break;

    case 'SUBMIT_TEAM_VOTE':
      if (App.gameState.phase === GamePhase.TEAM_VOTE) {
        const voter = App.gameState.players.find(p => p.id === senderId);
        if (voter && !App.teamVotesBuffer.find(v => v.playerId === senderId)) {
          App.teamVotesBuffer.push({
            playerId: senderId,
            playerName: voter.name,
            vote: msg.payload.vote
          });
          App.gameState.votesReceived = App.teamVotesBuffer.length;
          
          // Check if all votes are in
          if (App.teamVotesBuffer.length >= App.gameState.players.length) {
            resolveTeamVote();
          } else {
            broadcastState();
          }
        }
      }
      break;

    case 'SUBMIT_VOTE':
      if (App.gameState.phase === GamePhase.MISSION_VOTING && 
          App.gameState.currentTeam.includes(senderId)) {
        App.votesBuffer.push(msg.payload.vote);
        App.gameState.votesReceived = App.votesBuffer.length;
        
        // Check if all votes are in
        if (App.votesBuffer.length >= App.gameState.currentTeam.length) {
          revealResults();
        } else {
          broadcastState();
        }
      }
      break;

    case 'RESET_ROUND':
      if (senderId === App.myPeerId) {
        nextRound();
      }
      break;

    case 'RESTART_GAME':
      // Only host can restart
      if (App.isHost) {
        restartGame();
      }
      break;
  }
  
  renderRoom();
}

function handleClientMessage(msg, senderId) {
  switch (msg.type) {
    case 'SYNC_STATE':
      App.gameState = msg.payload;
      
      // First sync - show room view
      if (DOM.lobbyView.classList.contains('active')) {
        showRoomView();
        showNotification('Connected to room!');
      }
      
      renderRoom();
      break;

    case 'START_TEAM_VOTE':
      App.hasVoted = false;
      renderRoom();
      break;

    case 'START_MISSION_VOTE':
      App.flavorText = msg.payload.flavorText;
      App.hasVoted = false;
      renderRoom();
      break;

    case 'KICKED':
      showNotification('You have been removed from the room');
      handleLeaveRoom();
      break;

    case 'GAME_RESTARTED':
      showNotification('Game has been restarted');
      break;
  }
}

// ============================================
// GAME ACTIONS
// ============================================
function togglePlayerSelection(playerId) {
  if (App.gameState.phase !== GamePhase.TEAM_SELECTION) return;

  const team = App.gameState.currentTeam;
  const index = team.indexOf(playerId);
  
  if (index > -1) {
    team.splice(index, 1);
  } else {
    team.push(playerId);
  }

  if (App.isHost) {
    broadcastState();
    renderRoom();
  } else {
    App.peerManager.sendToHost({
      type: 'UPDATE_TEAM',
      payload: team
    });
  }
}

function startMission() {
  if (App.gameState.currentTeam.length === 0) return;

  if (App.isHost) {
    startTeamVoting();
  } else {
    App.peerManager.sendToHost({
      type: 'START_VOTE',
      payload: {}
    });
  }
}

// Phase 1: Team Approval Vote (all players vote on the proposed team)
function startTeamVoting() {
  App.teamVotesBuffer = [];
  App.gameState.phase = GamePhase.TEAM_VOTE;
  App.gameState.votesReceived = 0;
  App.hasVoted = false;

  // Broadcast to clients
  App.peerManager.broadcast({
    type: 'START_TEAM_VOTE',
    payload: { team: App.gameState.currentTeam }
  });

  broadcastState();
  renderRoom();
}

function submitTeamVote(vote) {
  App.hasVoted = true;

  if (App.isHost) {
    // Process vote locally
    const me = App.gameState.players.find(p => p.id === App.myPeerId);
    App.teamVotesBuffer.push({
      playerId: App.myPeerId,
      playerName: me ? me.name : 'Host',
      vote: vote
    });
    App.gameState.votesReceived = App.teamVotesBuffer.length;
    
    if (App.teamVotesBuffer.length >= App.gameState.players.length) {
      resolveTeamVote();
    } else {
      broadcastState();
    }
  } else {
    App.peerManager.sendToHost({
      type: 'SUBMIT_TEAM_VOTE',
      payload: { vote }
    });
  }

  renderRoom();
}

function resolveTeamVote() {
  const agreeVotes = App.teamVotesBuffer.filter(v => v.vote === 'AGREE').length;
  const disagreeVotes = App.teamVotesBuffer.filter(v => v.vote === 'DISAGREE').length;
  const totalPlayers = App.gameState.players.length;
  
  // Team is rejected if >= half disagree
  const teamApproved = disagreeVotes < totalPlayers / 2;

  // Store team vote result
  App.gameState.lastTeamVote = {
    team: [...App.gameState.currentTeam],
    votes: [...App.teamVotesBuffer],
    approved: teamApproved,
    agreeCount: agreeVotes,
    disagreeCount: disagreeVotes
  };

  if (teamApproved) {
    // Team approved - proceed to mission voting
    startMissionVoting();
  } else {
    // Team rejected - record in history and go to next round
    recordRejectedTeam();
  }
}

function recordRejectedTeam() {
  const teamVote = App.gameState.lastTeamVote;
  
  const result = {
    roundNumber: App.gameState.missionHistory.length + 1,
    team: teamVote.team,
    teamVotes: teamVote.votes,
    teamApproved: false,
    votes: { approve: 0, disapprove: 0 },
    success: null, // null means team was rejected
    flavorText: 'Team proposal was rejected.',
    timestamp: Date.now()
  };

  App.gameState.missionHistory.unshift(result);
  App.gameState.phase = GamePhase.RESULT_REVEAL;

  broadcastState();
  renderRoom();
}

// Phase 2: Mission Voting (only team members vote approve/disapprove)
function startMissionVoting() {
  App.votesBuffer = [];
  App.gameState.phase = GamePhase.MISSION_VOTING;
  App.gameState.votesReceived = 0;
  App.hasVoted = false;

  // Generate flavor text
  const missionNum = App.gameState.missionHistory.length + 1;
  App.flavorText = `Mission ${missionNum}: ${FLAVOR_TEMPLATES[Math.floor(Math.random() * FLAVOR_TEMPLATES.length)]}`;

  // Broadcast to clients
  App.peerManager.broadcast({
    type: 'START_MISSION_VOTE',
    payload: { flavorText: App.flavorText }
  });

  broadcastState();
  renderRoom();
}

function submitVote(vote) {
  App.hasVoted = true;

  if (App.isHost) {
    // Process vote locally
    App.votesBuffer.push(vote);
    App.gameState.votesReceived = App.votesBuffer.length;
    
    if (App.votesBuffer.length >= App.gameState.currentTeam.length) {
      revealResults();
    } else {
      broadcastState();
    }
  } else {
    App.peerManager.sendToHost({
      type: 'SUBMIT_VOTE',
      payload: { vote }
    });
  }

  renderRoom();
}

function revealResults() {
  const disapproveVotes = App.votesBuffer.filter(v => v === 'DISAPPROVE').length;
  const approveVotes = App.votesBuffer.filter(v => v === 'APPROVE').length;
  const success = disapproveVotes === 0;
  const teamVote = App.gameState.lastTeamVote;

  const result = {
    roundNumber: App.gameState.missionHistory.length + 1,
    team: [...App.gameState.currentTeam],
    teamVotes: teamVote ? teamVote.votes : [],
    teamApproved: true,
    votes: { approve: approveVotes, disapprove: disapproveVotes },
    success: success,
    flavorText: App.flavorText,
    timestamp: Date.now()
  };

  App.gameState.missionHistory.unshift(result);
  App.gameState.phase = GamePhase.RESULT_REVEAL;

  broadcastState();
  renderRoom();
}

function nextRound() {
  App.gameState.phase = GamePhase.TEAM_SELECTION;
  App.gameState.currentTeam = [];
  App.gameState.votesReceived = 0;
  App.gameState.lastTeamVote = null;
  App.votesBuffer = [];
  App.teamVotesBuffer = [];
  App.hasVoted = false;
  App.flavorText = '';

  broadcastState();
  renderRoom();
}

function handleNextRound() {
  if (App.isHost) {
    nextRound();
  }
}

function restartGame() {
  if (!App.isHost) return;
  
  // Clear mission history
  App.gameState.missionHistory = [];
  App.gameState.phase = GamePhase.TEAM_SELECTION;
  App.gameState.currentTeam = [];
  App.gameState.votesReceived = 0;
  App.gameState.lastTeamVote = null;
  App.votesBuffer = [];
  App.teamVotesBuffer = [];
  App.hasVoted = false;
  App.flavorText = '';
  
  // Notify all players
  App.peerManager.broadcast({
    type: 'GAME_RESTARTED'
  });
  
  showNotification('Game restarted');
  broadcastState();
  renderRoom();
}

function handleRestartGame() {
  if (!App.isHost) return;
  
  if (confirm('Are you sure you want to restart the game? This will clear all mission history.')) {
    restartGame();
  }
}

function broadcastState() {
  if (App.isHost && App.peerManager) {
    App.peerManager.broadcast({
      type: 'SYNC_STATE',
      payload: App.gameState
    });
  }
}

// ============================================
// VIEW MANAGEMENT
// ============================================
function showRoomView() {
  DOM.lobbyView.classList.remove('active');
  DOM.roomView.classList.add('active');
  renderRoom();
}

function showLobbyView() {
  DOM.roomView.classList.remove('active');
  DOM.lobbyView.classList.add('active');
  setLobbyMode('MENU');
}

function handleLeaveRoom() {
  if (App.peerManager) {
    App.peerManager.destroy();
    App.peerManager = null;
  }

  // Reset state
  stopConnectionCheck();
  App.gameState = {
    phase: GamePhase.LOBBY,
    players: [],
    currentTeam: [],
    votesReceived: 0,
    missionHistory: [],
    roomId: ''
  };
  App.myPeerId = '';
  App.hasVoted = false;
  App.votesBuffer = [];
  App.flavorText = '';
  App.connectionCheckInterval = null;

  // Clear URL params
  window.history.replaceState({}, document.title, window.location.pathname);

  showLobbyView();
}

// ============================================
// RENDERING
// ============================================
function renderRoom() {
  renderHeader();
  renderPhase();
  renderMissionCard();
  renderPlayers();
  renderHistory();
  renderVotingOverlay();
}

function renderHeader() {
  const roomId = App.gameState.roomId || App.myPeerId || '...';
  DOM.displayRoomId.textContent = roomId.slice(0, 6);
}

function renderPhase() {
  const phase = App.gameState.phase;
  const badge = DOM.phaseBadge;

  badge.className = 'phase-badge';

  switch (phase) {
    case GamePhase.TEAM_SELECTION:
      badge.textContent = 'Phase: Team Selection';
      badge.classList.add('phase-selection');
      break;
    case GamePhase.TEAM_VOTE:
      badge.textContent = 'Phase: Team Approval Vote';
      badge.classList.add('phase-voting');
      break;
    case GamePhase.MISSION_VOTING:
      badge.textContent = 'Phase: Mission Voting';
      badge.classList.add('phase-voting');
      break;
    case GamePhase.RESULT_REVEAL:
      badge.textContent = 'Phase: Mission Results';
      badge.classList.add('phase-result');
      break;
  }
}

function renderMissionCard() {
  const state = App.gameState;

  // Mission number
  DOM.missionNumber.textContent = state.missionHistory.length + 1;

  // Hide leader display (no leader concept)
  DOM.leaderDisplay.style.display = 'none';

  // Flavor text
  if ((state.phase === GamePhase.MISSION_VOTING || state.phase === GamePhase.RESULT_REVEAL) && App.flavorText) {
    DOM.flavorText.textContent = `"${App.flavorText}"`;
    DOM.flavorText.classList.remove('hidden');
  } else {
    DOM.flavorText.classList.add('hidden');
  }

  // Phase content
  renderPhaseContent(state);

  // Action button
  renderActionButton(state);
}

function renderPhaseContent(state) {
  const container = DOM.phaseContent;

  switch (state.phase) {
    case GamePhase.TEAM_SELECTION:
      container.innerHTML = `
        <p class="phase-message">
          Any player can select agents for the mission.
        </p>
      `;
      break;

    case GamePhase.TEAM_VOTE:
      container.innerHTML = `
        <p class="phase-message">All players vote to approve or reject this team.</p>
        <div class="vote-counter">
          <div class="vote-count">${state.votesReceived} / ${state.players.length}</div>
          <div class="vote-label">Votes Cast</div>
        </div>
      `;
      break;

    case GamePhase.MISSION_VOTING:
      container.innerHTML = `
        <div class="vote-counter">
          <div class="vote-count">${state.votesReceived} / ${state.currentTeam.length}</div>
          <div class="vote-label">Mission Votes Cast</div>
        </div>
      `;
      break;

    case GamePhase.RESULT_REVEAL:
      if (state.missionHistory.length > 0) {
        const result = state.missionHistory[0];
        let outcomeHtml = '';
        let teamVoteHtml = '';
        
        // Check if team was rejected
        if (result.success === null) {
          outcomeHtml = '<div class="mission-outcome mission-rejected">✕ TEAM REJECTED</div>';
        } else {
          outcomeHtml = result.success 
            ? '<div class="mission-outcome mission-success">✓ MISSION SUCCESS</div>'
            : '<div class="mission-outcome mission-failed">✕ MISSION FAILED</div>';
        }
        
        // Show team approval votes if available (anonymous - counts only)
        if (result.teamVotes && result.teamVotes.length > 0) {
          const agreeCount = result.teamVotes.filter(v => v.vote === 'AGREE').length;
          const disagreeCount = result.teamVotes.filter(v => v.vote === 'DISAGREE').length;
          
          teamVoteHtml = `
            <div class="team-vote-results">
              <div class="team-vote-section">
                <span class="team-vote-label agree-label">Agreed:</span>
                <span class="team-vote-count">${agreeCount}</span>
              </div>
              <div class="team-vote-section">
                <span class="team-vote-label disagree-label">Disagreed:</span>
                <span class="team-vote-count">${disagreeCount}</span>
              </div>
            </div>
          `;
        }
        
        // Only show mission votes if team was approved and mission happened
        let missionVotesHtml = '';
        if (result.success !== null) {
          const approveClass = result.votes.approve === 0 ? 'approve zero-votes' : 'approve';
          const disapproveClass = result.votes.disapprove === 0 ? 'disapprove zero-votes' : 'disapprove';
          missionVotesHtml = `
            <div class="result-display">
              <div class="result-item">
                <div class="result-circle result-approve ${result.votes.approve === 0 ? 'zero-votes' : ''}">${result.votes.approve}</div>
                <div class="result-label ${approveClass}">Approve</div>
              </div>
              <div class="result-item">
                <div class="result-circle result-disapprove ${result.votes.disapprove === 0 ? 'zero-votes' : ''}">${result.votes.disapprove}</div>
                <div class="result-label ${disapproveClass}">Disapprove</div>
              </div>
            </div>
          `;
        }
        
        container.innerHTML = `
          ${outcomeHtml}
          ${teamVoteHtml}
          ${missionVotesHtml}
        `;
      }
      break;
  }
}

function renderActionButton(state) {
  const container = DOM.actionButtonContainer;
  container.innerHTML = '';

  // Any player can start the team vote when team is selected
  if (state.phase === GamePhase.TEAM_SELECTION && state.currentTeam.length > 0) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.innerHTML = '<span class="icon-shield"></span> Start Team Vote';
    btn.addEventListener('click', startMission);
    container.appendChild(btn);
  }

  if (state.phase === GamePhase.RESULT_REVEAL && App.isHost) {
    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '12px';
    btnContainer.style.justifyContent = 'center';
    
    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-secondary';
    nextBtn.innerHTML = '↻ Next Round';
    nextBtn.addEventListener('click', handleNextRound);
    btnContainer.appendChild(nextBtn);
    
    const restartBtn = document.createElement('button');
    restartBtn.className = 'btn btn-danger';
    restartBtn.innerHTML = '⟳ Restart Game';
    restartBtn.addEventListener('click', handleRestartGame);
    btnContainer.appendChild(restartBtn);
    
    container.appendChild(btnContainer);
  }
}

function renderPlayers() {
  const container = DOM.playersGrid;
  const state = App.gameState;
  const canSelect = state.phase === GamePhase.TEAM_SELECTION; // Any player can select in team selection phase

  container.innerHTML = '';

  state.players.forEach(player => {
    const isSelected = state.currentTeam.includes(player.id);
    const canRemove = App.isHost && !player.isHost; // Host can remove non-host players

    const card = document.createElement('div');
    card.className = 'player-card';
    if (canSelect) card.classList.add('selectable');
    if (isSelected) card.classList.add('selected');

    card.innerHTML = `
      <div class="player-avatar" style="background: linear-gradient(145deg, ${player.avatarSeed}, ${player.avatarSeed}aa)"></div>
      <div class="player-info">
        <div class="player-name">${escapeHtml(player.name)}</div>
        <div class="player-role">
          ${player.isHost ? 'Host' : ''}
        </div>
      </div>
      ${isSelected ? '<div class="player-selected-dot"></div>' : ''}
      ${canRemove ? '<button class="btn-remove-player" title="Remove player">✕</button>' : ''}
    `;

    if (canSelect) {
      card.addEventListener('click', (e) => {
        // Don't toggle selection if clicking the remove button
        if (e.target.classList.contains('btn-remove-player')) return;
        togglePlayerSelection(player.id);
      });
    }
    
    // Add remove button handler
    if (canRemove) {
      const removeBtn = card.querySelector('.btn-remove-player');
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Remove ${player.name} from the room?`)) {
          removePlayer(player.id);
        }
      });
    }

    container.appendChild(card);
  });
}

function renderHistory() {
  const history = App.gameState.missionHistory;

  if (history.length === 0) {
    DOM.historySection.classList.add('hidden');
    return;
  }

  DOM.historySection.classList.remove('hidden');
  DOM.historyList.innerHTML = '';

  history.forEach(mission => {
    const item = document.createElement('div');
    item.className = 'history-item';
    
    // Color based on outcome
    if (mission.success === null) {
      item.classList.add('history-rejected');
    } else if (mission.success) {
      item.classList.add('history-success');
    } else {
      item.classList.add('history-failed');
    }

    const teamSize = mission.team.length;

    // Status badge based on outcome
    let statusBadge = '';
    if (mission.success === null) {
      statusBadge = '<span class="history-status status-rejected">✕ Rejected</span>';
    } else {
      statusBadge = mission.success 
        ? '<span class="history-status status-success">✓ Success</span>'
        : '<span class="history-status status-failed">✕ Failed</span>';
    }
    
    // Team vote info (anonymous - counts only)
    let teamVoteHtml = '';
    if (mission.teamVotes && mission.teamVotes.length > 0) {
      const agreeCount = mission.teamVotes.filter(v => v.vote === 'AGREE').length;
      const disagreeCount = mission.teamVotes.filter(v => v.vote === 'DISAGREE').length;
      teamVoteHtml = `
        <div class="history-team-votes">
          <span class="history-agree">${agreeCount} Agreed</span>
          <span class="history-disagree">${disagreeCount} Disagreed</span>
        </div>
      `;
    }
    
    // Mission votes (only if team was approved)
    let missionVotesHtml = '';
    if (mission.success !== null) {
      const approveClass = mission.votes.approve === 0 ? 'history-approve zero-votes' : 'history-approve';
      const disapproveClass = mission.votes.disapprove === 0 ? 'history-disapprove zero-votes' : 'history-disapprove';
      missionVotesHtml = `
        <div class="history-votes">
          <span class="${approveClass}">${mission.votes.approve} Approve</span>
          <span class="${disapproveClass}">${mission.votes.disapprove} Disapprove</span>
        </div>
      `;
    }

    item.innerHTML = `
      <div class="history-header">
        <span class="history-round">Mission ${mission.roundNumber}</span>
        ${statusBadge}
      </div>
      ${teamVoteHtml}
      ${missionVotesHtml}
      <div class="history-team">
        <span class="history-team-size">Team Size: ${teamSize}</span>
      </div>
      ${mission.flavorText ? `<div class="history-flavor">"${escapeHtml(mission.flavorText)}"</div>` : ''}
    `;

    DOM.historyList.appendChild(item);
  });
}

function renderVotingOverlay() {
  const state = App.gameState;
  const amInTeam = state.currentTeam.includes(App.myPeerId);
  
  // Team vote - all players vote
  const showTeamVote = state.phase === GamePhase.TEAM_VOTE && !App.hasVoted;
  // Mission vote - only team members vote
  const showMissionVote = state.phase === GamePhase.MISSION_VOTING && amInTeam && !App.hasVoted;

  if (showTeamVote) {
    DOM.votingOverlay.classList.remove('hidden');
    // Update overlay content for team voting
    DOM.votingOverlay.innerHTML = `
      <h3 class="voting-title">Vote on Team Proposal</h3>
      <p class="voting-subtitle">Do you approve this team for the mission?</p>
      <div class="voting-buttons">
        <button id="btn-team-agree" class="btn btn-vote btn-vote-approve">
          <span class="icon-shield"></span>
          Agree
        </button>
        <button id="btn-team-disagree" class="btn btn-vote btn-vote-disapprove">
          <span class="icon-shield-alert"></span>
          Disagree
        </button>
      </div>
      <p class="voting-note">
        <span class="icon-shield-small"></span> Your vote will be revealed after voting.
      </p>
    `;
    // Bind events
    document.getElementById('btn-team-agree').addEventListener('click', () => submitTeamVote('AGREE'));
    document.getElementById('btn-team-disagree').addEventListener('click', () => submitTeamVote('DISAGREE'));
  } else if (showMissionVote) {
    DOM.votingOverlay.classList.remove('hidden');
    // Update overlay content for mission voting
    DOM.votingOverlay.innerHTML = `
      <h3 class="voting-title">Cast Your Mission Vote</h3>
      <div class="voting-buttons">
        <button id="btn-vote-approve-dyn" class="btn btn-vote btn-vote-approve">
          <span class="icon-shield"></span>
          Approve
        </button>
        <button id="btn-vote-disapprove-dyn" class="btn btn-vote btn-vote-disapprove">
          <span class="icon-shield-alert"></span>
          Disapprove
        </button>
      </div>
      <p class="voting-note">
        <span class="icon-shield-small"></span> This vote is anonymous.
      </p>
    `;
    // Bind events
    document.getElementById('btn-vote-approve-dyn').addEventListener('click', () => submitVote('APPROVE'));
    document.getElementById('btn-vote-disapprove-dyn').addEventListener('click', () => submitVote('DISAPPROVE'));
  } else {
    DOM.votingOverlay.classList.add('hidden');
  }
}

// ============================================
// MODAL & NOTIFICATIONS
// ============================================
function showQrModal() {
  const roomId = App.gameState.roomId || App.myPeerId;
  if (!roomId) return;

  const joinUrl = getJoinUrl();
  DOM.qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(joinUrl)}`;
  DOM.modalRoomId.textContent = roomId;
  DOM.qrModal.classList.remove('hidden');
}

function hideQrModal() {
  DOM.qrModal.classList.add('hidden');
}

function getJoinUrl() {
  const roomId = App.gameState.roomId || App.myPeerId;
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?room=${roomId}`;
}

function copyJoinLink() {
  const url = getJoinUrl();
  navigator.clipboard.writeText(url).then(() => {
    showNotification('Join link copied!');
  }).catch(() => {
    showNotification('Failed to copy');
  });
}

function showNotification(message) {
  DOM.notification.textContent = message;
  DOM.notification.classList.remove('hidden');

  setTimeout(() => {
    DOM.notification.classList.add('hidden');
  }, 3000);
}

// ============================================
// UTILITIES
// ============================================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// START APPLICATION
// ============================================
document.addEventListener('DOMContentLoaded', initApp);
