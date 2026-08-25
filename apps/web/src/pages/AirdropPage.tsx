import { Landing } from '../components/Landing';
import { Room } from '../components/Room';
import { useAirdrop } from '../hooks/useAirdrop';

function getInitialRoom(): string | undefined {
  const params = new URLSearchParams(window.location.search);
  return params.get('room') ?? undefined;
}

export function AirdropPage() {
  const airdrop = useAirdrop();
  const initialRoom = getInitialRoom();

  if (!airdrop.room) {
    return (
      <div className="shell">
        <Landing
          initialRoomId={initialRoom}
          connected={airdrop.connected}
          error={airdrop.error}
          onCreate={airdrop.createRoom}
          onJoin={airdrop.joinRoom}
        />
      </div>
    );
  }

  return (
    <div className="shell">
      <Room
        roomId={airdrop.room.roomId}
        name={airdrop.room.name}
        peerId={airdrop.room.peerId}
        peers={airdrop.peers}
        readyPeers={airdrop.readyPeers}
        items={airdrop.items}
        progress={airdrop.progress}
        error={airdrop.error}
        onLeave={airdrop.leaveRoom}
        onSendText={airdrop.sendText}
        onSendFiles={airdrop.sendFiles}
        onClearError={() => airdrop.setError(null)}
      />
    </div>
  );
}
