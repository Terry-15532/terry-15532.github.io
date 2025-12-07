import React, { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { GamePhase, GameState, Player, Message, MissionResult } from '../types';
import { generateMissionFlavorText } from '../services/geminiService';
import Avatar from './Avatar';
import { Share2, Users, Shield, ShieldAlert, History, User, Play, RefreshCw, Copy, Check, X, QrCode } from 'lucide-react';

interface RoomProps {
  playerName: string;
  avatarSeed: string; // This is the color hex
  isHost: boolean;
  roomId?: string; // If joining
  onLeave: () => void;
}

const INITIAL_STATE: GameState = {
  phase: GamePhase.LOBBY,
  players: [],
  currentLeaderId: '',
  currentTeam: [],
  votesReceived: 0,
  missionHistory: [],
  roomId: '',
};

const Room: React.FC<RoomProps> = ({ playerName, avatarSeed, isHost, roomId: targetRoomId, onLeave }) => {
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [myPeerId, setMyPeerId] = useState<string>('');
  const [flavorText, setFlavorText] = useState<string>('');
  const [hasVoted, setHasVoted] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  // Refs for PeerJS management
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map()); // Host stores all clients. Clients store host.
  const hostConnRef = useRef<DataConnection | null>(null); // For clients to talk to host
  
  // Vote storage (Host only)
  const votesBuffer = useRef<('BLACK' | 'RED')[]>([]);

  // --- Utility Functions ---

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const broadcast = useCallback((msg: Message) => {
    if (!isHost) return;
    connectionsRef.current.forEach(conn => {
      if (conn.open) conn.send(msg);
    });
  }, [isHost]);

  const sendToHost = useCallback((msg: Message) => {
    if (isHost) {
      // If I am host, process locally
      handleMessage(msg, myPeerId);
    } else {
      if (hostConnRef.current?.open) {
        hostConnRef.current.send(msg);
      }
    }
  }, [isHost, myPeerId]); // Added handleMessage to deps via wrapper or ignoring circular dep for now

  // --- Message Handling ---

  const handleMessage = useCallback((msg: Message, senderId: string) => {
    // HOST LOGIC
    if (isHost) {
      switch (msg.type) {
        case 'JOIN':
          setGameState(prev => {
            if (prev.players.find(p => p.id === senderId)) return prev;
            const newPlayer: Player = {
              id: senderId,
              name: msg.payload.name,
              avatarSeed: msg.payload.avatarSeed,
              isHost: false,
              isConnected: true,
            };
            const newPlayers = [...prev.players, newPlayer];
            // If first player joining and no leader, make host leader
            const newLeader = prev.currentLeaderId || prev.players.find(p => p.isHost)?.id || senderId;
            
            const newState = { ...prev, players: newPlayers, currentLeaderId: newLeader };
            broadcast({ type: 'SYNC_STATE', payload: newState });
            return newState;
          });
          break;
        case 'UPDATE_TEAM':
           // Only allow if sender is leader (or host override)
           setGameState(prev => {
             if (senderId !== prev.currentLeaderId && senderId !== myPeerId) return prev;
             const newState = { ...prev, currentTeam: msg.payload };
             broadcast({ type: 'SYNC_STATE', payload: newState });
             return newState;
           });
           break;
        case 'START_VOTE':
            // Only leader can start
             setGameState(prev => {
                if (senderId !== prev.currentLeaderId && senderId !== myPeerId) return prev;
                // Generate flavor text via API
                const teamNames = prev.players.filter(p => prev.currentTeam.includes(p.id)).map(p => p.name);
                
                // We'll update state optimistically, then fetch flavor text
                const nextState = {
                   ...prev, 
                   phase: GamePhase.VOTING,
                   votesReceived: 0
                };
                
                // Clear votes buffer
                votesBuffer.current = [];

                // Async fetch flavor text then broadcast
                generateMissionFlavorText(prev.missionHistory.length + 1, teamNames).then(text => {
                   broadcast({ type: 'START_VOTE', payload: { team: prev.currentTeam, flavorText: text } });
                   // Also update local host state
                   setFlavorText(text);
                });

                broadcast({ type: 'SYNC_STATE', payload: nextState });
                return nextState;
             });
            break;
        case 'SUBMIT_VOTE':
            // Record vote
            if (gameState.phase !== GamePhase.VOTING) return;
            // Check if sender is in the team
            if (!gameState.currentTeam.includes(senderId)) return;
            // Check if already voted (basic check, refined by checking buffer length vs team size mainly)
            
            votesBuffer.current.push(msg.payload.vote);
            
            setGameState(prev => {
               const newCount = votesBuffer.current.length;
               const newState = { ...prev, votesReceived: newCount };
               
               // Check completion
               if (newCount >= prev.currentTeam.length) {
                 // All votes in
                 const blackVotes = votesBuffer.current.filter(v => v === 'BLACK').length;
                 const redVotes = votesBuffer.current.filter(v => v === 'RED').length;
                 
                 const result: MissionResult = {
                    roundNumber: prev.missionHistory.length + 1,
                    team: prev.currentTeam,
                    votes: { black: blackVotes, red: redVotes },
                    timestamp: Date.now(),
                    flavorText: flavorText // Use current flavor text
                 };
                 
                 const finalState = {
                    ...newState,
                    phase: GamePhase.RESULT_REVEAL,
                    missionHistory: [result, ...prev.missionHistory], // Prepend for display
                 };
                 broadcast({ type: 'SYNC_STATE', payload: finalState });
                 return finalState;
               }

               broadcast({ type: 'SYNC_STATE', payload: newState });
               return newState;
            });
            break;
        case 'RESET_ROUND':
            setGameState(prev => {
              // Rotate leader
              const currentIndex = prev.players.findIndex(p => p.id === prev.currentLeaderId);
              const nextIndex = (currentIndex + 1) % prev.players.length;
              const nextLeader = prev.players[nextIndex].id;

              const newState = {
                ...prev,
                phase: GamePhase.TEAM_SELECTION,
                currentTeam: [],
                votesReceived: 0,
                currentLeaderId: nextLeader
              };
              broadcast({ type: 'SYNC_STATE', payload: newState });
              return newState;
            });
            break;
      }
    } else {
      // CLIENT LOGIC
      switch (msg.type) {
        case 'SYNC_STATE':
          setGameState(msg.payload);
          break;
        case 'START_VOTE':
          setFlavorText(msg.payload.flavorText);
          setHasVoted(false); // Reset local vote state
          break;
      }
    }
  }, [isHost, myPeerId, broadcast, gameState, flavorText]);

  const onDataRef = useRef<(data: any, id: string) => void>((data, id) => {});
  useEffect(() => {
      onDataRef.current = (data, id) => handleMessage(data as Message, id);
  }, [handleMessage]);

  const stateRef = useRef(gameState);
  useEffect(() => { stateRef.current = gameState; }, [gameState]);

  // --- Initialization ---

  useEffect(() => {
    // 1. Initialize Peer
    const peer = new Peer(undefined, {
       debug: 2
    });
    peerRef.current = peer;

    peer.on('open', (id) => {
      setMyPeerId(id);
      
      if (isHost) {
        // I am Host
        setGameState(prev => ({
           ...prev,
           roomId: id,
           players: [{ id, name: playerName, avatarSeed, isHost: true, isConnected: true }],
           currentLeaderId: id
        }));
        // Auto-show QR code for host on creation
        setShowQrModal(true);
      } else {
        // I am Client, connect to Host
        if (!targetRoomId) return;
        const conn = peer.connect(targetRoomId);
        hostConnRef.current = conn;
        
        conn.on('open', () => {
          conn.send({ type: 'JOIN', payload: { name: playerName, avatarSeed } });
          showNotification("Connected to room!");
        });
        
        conn.on('data', (data: any) => {
           onDataRef.current(data, targetRoomId);
        });

        conn.on('close', () => {
           showNotification("Disconnected from host");
        });
        
        conn.on('error', (err) => {
            console.error("Connection error", err);
            showNotification("Connection error");
        });
      }
    });

    peer.on('connection', (conn) => {
       // Host receiving connection
       if (!isHost) { conn.close(); return; }
       
       conn.on('open', () => {
         connectionsRef.current.set(conn.peer, conn);
         // Send current state immediately
         conn.send({ type: 'SYNC_STATE', payload: stateRef.current });
       });

       conn.on('data', (data: any) => {
         onDataRef.current(data, conn.peer);
       });
       
       conn.on('close', () => {
         connectionsRef.current.delete(conn.peer);
         setGameState(prev => {
            const updatedPlayers = prev.players.map(p => p.id === conn.peer ? { ...p, isConnected: false } : p);
            const newState = { ...prev, players: updatedPlayers };
            return newState;
         });
       });
    });

    return () => {
      peer.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once


  // --- Actions ---

  const togglePlayerSelection = (playerId: string) => {
    if (gameState.phase !== GamePhase.TEAM_SELECTION) return;
    if (gameState.currentLeaderId !== myPeerId) return;

    const newTeam = gameState.currentTeam.includes(playerId)
      ? gameState.currentTeam.filter(id => id !== playerId)
      : [...gameState.currentTeam, playerId];
    
    // Optimistic update locally? No, send to host (or self)
    if (isHost) {
        // Direct update
        const newState = { ...gameState, currentTeam: newTeam };
        setGameState(newState);
        broadcast({ type: 'SYNC_STATE', payload: newState });
    } else {
        sendToHost({ type: 'UPDATE_TEAM', payload: newTeam });
    }
  };

  const startMission = () => {
      if (gameState.currentTeam.length === 0) return;
      if (isHost) {
          handleMessage({ type: 'START_VOTE', payload: { team: gameState.currentTeam, flavorText: '' } }, myPeerId);
      } else {
          sendToHost({ type: 'START_VOTE', payload: { team: gameState.currentTeam, flavorText: '' } });
      }
  };

  const submitVote = (vote: 'BLACK' | 'RED') => {
      sendToHost({ type: 'SUBMIT_VOTE', payload: { vote } });
      setHasVoted(true);
  };

  const nextRound = () => {
      if (!isHost) return;
      handleMessage({ type: 'RESET_ROUND', payload: null }, myPeerId);
  };

  // --- Render Helpers ---

  const isLeader = gameState.currentLeaderId === myPeerId;
  const amInTeam = gameState.currentTeam.includes(myPeerId);
  const showVoteControls = gameState.phase === GamePhase.VOTING && amInTeam && !hasVoted;

  const getJoinUrl = () => {
    // Explicitly use the provided GitHub Pages URL as the base
    const baseUrl = 'https://terry-15532.github.io/AvalonVoter/index.html';
    const url = new URL(baseUrl);
    url.searchParams.set('room', gameState.roomId);
    return url.toString();
  };

  const copyJoinLink = () => {
     navigator.clipboard.writeText(getJoinUrl());
     showNotification("Join Link Copied!");
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-gray-900 text-gray-100 overflow-hidden shadow-2xl relative">
      {/* Header */}
      <header className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center z-10 shadow-md">
         <div className="flex items-center gap-3">
             <button onClick={() => setShowQrModal(true)} className="bg-indigo-600 p-2 rounded-lg hover:bg-indigo-500 transition">
                <QrCode size={20} className="text-white" />
             </button>
             <div>
                 <h1 className="font-bold text-lg leading-tight">Avalon Voter</h1>
                 <p className="text-xs text-gray-400 flex items-center gap-1">
                    ID: {gameState.roomId ? <span className="font-mono text-blue-400 font-bold">{gameState.roomId.slice(0,6)}</span> : '...'}
                 </p>
             </div>
         </div>
         <div className="flex gap-2">
            <button onClick={copyJoinLink} className="p-2 hover:bg-gray-700 rounded-full transition text-gray-400 hover:text-white" title="Copy Link">
                <Copy size={18} />
            </button>
            <button onClick={onLeave} className="p-2 hover:bg-red-900/50 rounded-full text-red-400 transition" title="Leave">
                <X size={20} />
            </button>
         </div>
      </header>

      {/* Notification Toast */}
      {notification && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-sm z-50 animate-bounce">
            {notification}
        </div>
      )}

      {/* QR Code Modal Overlay */}
      {showQrModal && gameState.roomId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white text-gray-900 rounded-2xl p-6 max-w-sm w-full flex flex-col items-center shadow-2xl animate-scale-in relative">
                <button onClick={() => setShowQrModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-black">
                    <X size={24} />
                </button>
                <h3 className="text-xl font-bold mb-2">Join Room</h3>
                <p className="text-sm text-gray-500 mb-6 text-center">Scan to join automatically</p>
                
                <div className="bg-white p-2 rounded-xl border-2 border-gray-200 shadow-inner mb-6">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(getJoinUrl())}`} 
                      alt="Room QR" 
                      className="w-48 h-48 sm:w-64 sm:h-64 object-contain"
                    />
                </div>

                <div className="w-full bg-gray-100 p-3 rounded-lg flex justify-between items-center">
                    <span className="font-mono font-bold text-lg truncate px-2">{gameState.roomId}</span>
                    <button onClick={copyJoinLink} className="p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-500">
                        <Copy size={18} />
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
        
        {/* Phase Indicator */}
        <div className="text-center py-2">
            {gameState.phase === GamePhase.TEAM_SELECTION && (
                 <div className="inline-block bg-indigo-900/50 text-indigo-200 px-4 py-1 rounded-full text-sm border border-indigo-500/30">
                    Phase: Team Selection
                 </div>
            )}
            {gameState.phase === GamePhase.VOTING && (
                 <div className="inline-block bg-yellow-900/50 text-yellow-200 px-4 py-1 rounded-full text-sm border border-yellow-500/30 animate-pulse">
                    Phase: Voting in Progress
                 </div>
            )}
             {gameState.phase === GamePhase.RESULT_REVEAL && (
                 <div className="inline-block bg-green-900/50 text-green-200 px-4 py-1 rounded-full text-sm border border-green-500/30">
                    Phase: Mission Results
                 </div>
            )}
        </div>

        {/* Action Area / Mission Status */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
             <div className="flex justify-between items-start mb-4">
                 <h2 className="text-xl font-bold text-white flex items-center gap-2">
                     <Shield className="text-indigo-400" size={24} />
                     Mission {gameState.missionHistory.length + 1}
                 </h2>
                 {gameState.phase === GamePhase.TEAM_SELECTION && (
                     <div className="text-sm text-gray-400">
                        Leader: <span className="text-white font-semibold">{gameState.players.find(p => p.id === gameState.currentLeaderId)?.name || 'Unknown'}</span>
                     </div>
                 )}
             </div>
             
             {/* Flavor Text */}
             {(gameState.phase === GamePhase.VOTING || gameState.phase === GamePhase.RESULT_REVEAL) && flavorText && (
                 <div className="mb-4 text-sm italic text-gray-400 border-l-2 border-indigo-500 pl-3">
                     "{flavorText}"
                 </div>
             )}

             {/* Dynamic Content based on Phase */}
             {gameState.phase === GamePhase.TEAM_SELECTION && (
                 <div className="text-center py-6">
                     {isLeader ? (
                         <p className="text-indigo-300">Select agents for the mission, then confirm.</p>
                     ) : (
                         <p className="text-gray-500">Waiting for leader to select a team...</p>
                     )}
                 </div>
             )}

             {gameState.phase === GamePhase.VOTING && (
                 <div className="text-center py-6">
                     <div className="text-4xl font-mono font-bold text-white mb-2">
                         {gameState.votesReceived} / {gameState.currentTeam.length}
                     </div>
                     <p className="text-gray-400 text-sm uppercase tracking-widest">Votes Cast</p>
                 </div>
             )}

             {gameState.phase === GamePhase.RESULT_REVEAL && gameState.missionHistory.length > 0 && (
                 <div className="flex justify-center gap-8 py-4">
                      <div className="text-center">
                          <div className="w-16 h-16 rounded-full bg-gray-950 border-4 border-gray-700 flex items-center justify-center text-2xl font-bold text-white mb-2 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                             {gameState.missionHistory[0].votes.black}
                          </div>
                          <span className="text-xs text-gray-400 uppercase">Black</span>
                      </div>
                      <div className="text-center">
                          <div className="w-16 h-16 rounded-full bg-red-900/20 border-4 border-red-600 flex items-center justify-center text-2xl font-bold text-red-500 mb-2 shadow-[0_0_15px_rgba(220,38,38,0.3)]">
                             {gameState.missionHistory[0].votes.red}
                          </div>
                          <span className="text-xs text-red-400 uppercase">Red</span>
                      </div>
                 </div>
             )}
             
             {/* Primary Action Button (Host/Leader only usually) */}
             <div className="mt-4 flex justify-center">
                 {gameState.phase === GamePhase.TEAM_SELECTION && isLeader && (
                     <button 
                        onClick={startMission}
                        disabled={gameState.currentTeam.length === 0}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-bold transition flex items-center gap-2 shadow-lg"
                     >
                        <Play size={18} fill="currentColor" /> Start Mission
                     </button>
                 )}
                 {gameState.phase === GamePhase.RESULT_REVEAL && isHost && (
                      <button 
                        onClick={nextRound}
                        className="bg-gray-700 hover:bg-gray-600 text-white px-8 py-3 rounded-lg font-bold transition flex items-center gap-2"
                      >
                        <RefreshCw size={18} /> Next Round
                      </button>
                 )}
             </div>
        </div>

        {/* Players List */}
        <div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">Agents</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {gameState.players.map(player => {
                    const isSelected = gameState.currentTeam.includes(player.id);
                    const isTheLeader = gameState.currentLeaderId === player.id;
                    const canToggle = gameState.phase === GamePhase.TEAM_SELECTION && isLeader;

                    return (
                        <div 
                           key={player.id}
                           onClick={() => canToggle && togglePlayerSelection(player.id)}
                           className={`
                             relative flex items-center gap-3 p-3 rounded-lg border transition cursor-default
                             ${isSelected 
                                ? 'bg-indigo-900/30 border-indigo-500 ring-1 ring-indigo-500/50' 
                                : 'bg-gray-800 border-gray-700'
                             }
                             ${canToggle ? 'cursor-pointer hover:bg-gray-750' : ''}
                           `}
                        >
                            <Avatar seed={player.avatarSeed} size={36} />
                            <div className="overflow-hidden">
                                <p className="font-semibold text-sm truncate text-white">{player.name}</p>
                                <p className="text-[10px] text-gray-500 truncate flex items-center gap-1">
                                    {isTheLeader && <span className="text-yellow-500">★ Leader</span>}
                                    {player.isHost && !isTheLeader && <span>Host</span>}
                                </p>
                            </div>
                            {isSelected && (
                                <div className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_8px_#6366f1]"></div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>

        {/* History Log */}
        {gameState.missionHistory.length > 0 && (
            <div className="pt-4">
                 <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
                    <History size={14} /> Mission Logs
                 </h3>
                 <div className="space-y-3">
                     {gameState.missionHistory.map((mission, idx) => (
                         <div key={idx} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                             <div className="flex justify-between items-center mb-2">
                                 <span className="text-sm font-bold text-gray-300">Mission {mission.roundNumber}</span>
                                 <div className="flex gap-3 text-sm font-mono">
                                     <span className="text-white font-bold">{mission.votes.black} B</span>
                                     <span className="text-red-500 font-bold">{mission.votes.red} R</span>
                                 </div>
                             </div>
                             <div className="flex flex-wrap gap-1 mb-2">
                                 {mission.team.map(id => {
                                     const p = gameState.players.find(pl => pl.id === id);
                                     return (
                                         <span key={id} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                                             {p ? p.name : 'Unknown'}
                                         </span>
                                     );
                                 })}
                             </div>
                             {mission.flavorText && (
                                 <p className="text-xs text-gray-500 italic">"{mission.flavorText}"</p>
                             )}
                         </div>
                     ))}
                 </div>
            </div>
        )}

      </main>

      {/* Voting Overlay (Sticky/Modal) */}
      {showVoteControls && (
          <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-gray-900/95 to-transparent backdrop-blur-sm z-40 flex flex-col items-center animate-slide-up">
              <h3 className="text-lg font-bold text-white mb-4 text-center">Cast Your Vote</h3>
              <div className="flex gap-4 w-full max-w-sm">
                  <button 
                     onClick={() => submitVote('BLACK')}
                     className="flex-1 bg-gray-200 hover:bg-white text-black font-bold py-4 rounded-xl shadow-lg border-2 border-gray-400 transform transition active:scale-95 flex flex-col items-center gap-1"
                  >
                      <Shield size={24} />
                      BLACK
                  </button>
                  <button 
                     onClick={() => submitVote('RED')}
                     className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl shadow-lg border-2 border-red-800 transform transition active:scale-95 flex flex-col items-center gap-1"
                  >
                      <ShieldAlert size={24} />
                      RED
                  </button>
              </div>
              <p className="text-xs text-gray-400 mt-4 flex items-center gap-1">
                  <Shield size={12} /> This vote is anonymous.
              </p>
          </div>
      )}
    </div>
  );
};

export default Room;