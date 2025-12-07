import React, { useState, useEffect } from 'react';
import Avatar from './Avatar';
import { ArrowRight, UserPlus, Fingerprint, Palette } from 'lucide-react';

interface LobbyProps {
  onJoin: (name: string, avatarSeed: string, roomId?: string) => void;
  onCreate: (name: string, avatarSeed: string) => void;
}

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', 
  '#84cc16', '#22c55e', '#10b981', '#14b8a6', 
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', 
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', 
  '#f43f5e', '#78716c'
];

const Lobby: React.FC<LobbyProps> = ({ onJoin, onCreate }) => {
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  // Default to first color
  const [avatarColor, setAvatarColor] = useState(COLORS[Math.floor(Math.random() * COLORS.length)]);
  const [mode, setMode] = useState<'MENU' | 'JOIN' | 'CREATE'>('MENU');

  useEffect(() => {
    // Check for room ID in URL
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setRoomId(roomParam);
      setMode('JOIN');
    }
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name, avatarColor);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !roomId.trim()) return;
    onJoin(name, avatarColor, roomId);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-gray-900 to-gray-950">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-700">
        
        {/* Header */}
        <div className="bg-gray-900 p-8 text-center border-b border-gray-700">
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500 mb-2">
            Avalon Voter
          </h1>
          <p className="text-gray-400 text-sm">Anonymous Peer-to-Peer Deduction</p>
        </div>

        {/* Identity Section (Name + Color) */}
        {(mode === 'JOIN' || mode === 'CREATE') && (
            <div className="flex flex-col items-center p-6 bg-gray-800/50 border-b border-gray-700/50">
                <label className="text-xs text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <Palette size={14} /> Identity
                </label>
                
                <div className="flex flex-col items-center gap-4 w-full">
                  {/* Selected Avatar Preview */}
                  <Avatar seed={avatarColor} size={80} className="ring-4 ring-gray-700 shadow-xl" />
                  
                  {/* Name Input */}
                  <input 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="Enter Agent Name" 
                    className="bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white text-center focus:outline-none focus:border-indigo-500 w-full max-w-xs placeholder-gray-600 font-medium"
                    autoFocus
                  />

                  {/* Color Picker */}
                  <div className="mt-2">
                    <p className="text-[10px] text-gray-500 uppercase text-center mb-2">Select Color</p>
                    <div className="flex flex-wrap justify-center gap-2 max-w-[280px]">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setAvatarColor(c)}
                          className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${avatarColor === c ? 'ring-2 ring-white scale-110' : 'ring-1 ring-white/10'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
            </div>
        )}

        {/* Action Content */}
        <div className="p-6">
          {mode === 'MENU' && (
            <div className="space-y-4">
               <button 
                  onClick={() => setMode('CREATE')}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition transform hover:scale-[1.02] shadow-lg shadow-indigo-900/20"
                >
                  <UserPlus size={20} /> Create New Room
               </button>
               <button 
                  onClick={() => setMode('JOIN')}
                  className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition transform hover:scale-[1.02]"
                >
                  <Fingerprint size={20} /> Join Existing Room
               </button>
            </div>
          )}

          {mode === 'CREATE' && (
            <form onSubmit={handleCreate} className="space-y-6">
               <div className="bg-blue-900/20 p-4 rounded-lg text-xs text-blue-200 border border-blue-500/20 text-center">
                  You will be the Host. A Room QR Code will be generated for others to join.
               </div>
               <div className="flex gap-3">
                  <button type="button" onClick={() => setMode('MENU')} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg font-medium transition">
                      Back
                  </button>
                  <button type="submit" disabled={!name} className="flex-[2] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-bold transition flex items-center justify-center gap-2">
                      Start <ArrowRight size={16} />
                  </button>
               </div>
            </form>
          )}

          {mode === 'JOIN' && (
            <form onSubmit={handleJoin} className="space-y-6">
               {!roomId && (
                 <div>
                     <label className="block text-xs text-gray-500 uppercase tracking-wide mb-2">Room ID</label>
                     <input 
                       type="text" 
                       value={roomId} 
                       onChange={(e) => setRoomId(e.target.value)} 
                       placeholder="paste-room-id-here" 
                       className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 font-mono text-sm"
                     />
                 </div>
               )}
               {roomId && (
                 <div className="bg-green-900/20 text-green-400 p-3 rounded text-center text-xs font-mono border border-green-500/20">
                    Joining Room: {roomId.slice(0, 8)}...
                 </div>
               )}
               
               <div className="flex gap-3">
                  <button type="button" onClick={() => setMode('MENU')} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg font-medium transition">
                      Back
                  </button>
                  <button type="submit" disabled={!name || !roomId} className="flex-[2] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-bold transition flex items-center justify-center gap-2">
                      Connect <ArrowRight size={16} />
                  </button>
               </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};

export default Lobby;