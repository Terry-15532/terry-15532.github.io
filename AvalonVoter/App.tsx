import React, { useState } from 'react';
import Lobby from './components/Lobby';
import Room from './components/Room';

function App() {
  const [inGame, setInGame] = useState(false);
  const [config, setConfig] = useState<{ name: string; avatarSeed: string; roomId?: string; isHost: boolean } | null>(null);

  const handleCreate = (name: string, avatarSeed: string) => {
    setConfig({ name, avatarSeed, isHost: true });
    setInGame(true);
  };

  const handleJoin = (name: string, avatarSeed: string, roomId?: string) => {
    setConfig({ name, avatarSeed, roomId, isHost: false });
    setInGame(true);
  };

  const handleLeave = () => {
    setInGame(false);
    setConfig(null);
  };

  if (inGame && config) {
    return (
      <Room 
        playerName={config.name}
        avatarSeed={config.avatarSeed}
        isHost={config.isHost}
        roomId={config.roomId}
        onLeave={handleLeave}
      />
    );
  }

  return <Lobby onCreate={handleCreate} onJoin={handleJoin} />;
}

export default App;
