/**
 * PeerManager - Handles all PeerJS P2P connections
 * Pure JavaScript implementation
 */

class PeerManager {
  constructor(options) {
    this.isHost = options.isHost;
    this.targetRoomId = options.targetRoomId;
    this.playerName = options.playerName;
    this.avatarSeed = options.avatarSeed;

    // Callbacks
    this.onOpen = options.onOpen || (() => {});
    this.onMessage = options.onMessage || (() => {});
    this.onPlayerJoined = options.onPlayerJoined || (() => {});
    this.onPlayerLeft = options.onPlayerLeft || (() => {});
    this.onError = options.onError || (() => {});
    this.onDisconnect = options.onDisconnect || (() => {});

    // Connection state
    this.peer = null;
    this.connections = new Map(); // For host: peerId -> connection
    this.hostConnection = null;   // For client: connection to host
    this.myPeerId = '';

    this.init();
  }

  init() {
    // Create a new peer with random ID
    this.peer = new Peer();

    this.peer.on('open', (id) => {
      console.log('[PeerManager] Peer opened with ID:', id);
      this.myPeerId = id;

      if (this.isHost) {
        // Host is ready
        this.onOpen(id);
      } else {
        // Client needs to connect to host
        this.connectToHost(this.targetRoomId);
      }
    });

    this.peer.on('connection', (conn) => {
      console.log('[PeerManager] Incoming connection from:', conn.peer);
      this.handleIncomingConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.error('[PeerManager] Peer error:', err);
      this.onError(err);
    });

    this.peer.on('disconnected', () => {
      console.log('[PeerManager] Peer disconnected');
      this.onDisconnect();
    });
  }

  /**
   * Connect to a host (client only)
   */
  connectToHost(hostId) {
    console.log('[PeerManager] Connecting to host:', hostId);

    const conn = this.peer.connect(hostId, {
      reliable: true,
      metadata: {
        name: this.playerName,
        avatarSeed: this.avatarSeed
      }
    });

    this.hostConnection = conn;

    conn.on('open', () => {
      console.log('[PeerManager] Connected to host');
      this.onOpen(this.myPeerId);

      // Send join message
      conn.send({
        type: 'JOIN',
        payload: {
          name: this.playerName,
          avatarSeed: this.avatarSeed
        }
      });
    });

    conn.on('data', (data) => {
      console.log('[PeerManager] Received data from host:', data);
      this.onMessage(data, hostId);
    });

    conn.on('close', () => {
      console.log('[PeerManager] Connection to host closed');
      this.onDisconnect();
    });

    conn.on('error', (err) => {
      console.error('[PeerManager] Connection error:', err);
      this.onError(err);
    });
  }

  /**
   * Handle incoming connection (host only)
   */
  handleIncomingConnection(conn) {
    const peerId = conn.peer;

    conn.on('open', () => {
      console.log('[PeerManager] Connection opened from:', peerId);
      this.connections.set(peerId, conn);

      // Notify about new player via metadata
      if (conn.metadata) {
        this.onPlayerJoined({
          id: peerId,
          name: conn.metadata.name,
          avatarSeed: conn.metadata.avatarSeed
        });
      }
    });

    conn.on('data', (data) => {
      console.log('[PeerManager] Received data from:', peerId, data);
      this.onMessage(data, peerId);
    });

    conn.on('close', () => {
      console.log('[PeerManager] Connection closed from:', peerId);
      this.connections.delete(peerId);
      this.onPlayerLeft(peerId);
    });

    conn.on('error', (err) => {
      console.error('[PeerManager] Connection error from:', peerId, err);
    });
  }

  /**
   * Send message to a specific peer (host only)
   */
  sendTo(peerId, message) {
    const conn = this.connections.get(peerId);
    if (conn && conn.open) {
      conn.send(message);
    } else {
      console.warn('[PeerManager] Cannot send to', peerId, '- connection not found or closed');
    }
  }

  /**
   * Broadcast message to all connected peers (host only)
   */
  broadcast(message) {
    this.connections.forEach((conn, peerId) => {
      if (conn.open) {
        conn.send(message);
      }
    });
  }

  /**
   * Send message to host (client only)
   */
  sendToHost(message) {
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(message);
    } else {
      console.warn('[PeerManager] Cannot send to host - connection not open');
    }
  }

  /**
   * Get list of connected peer IDs (only those with open connections)
   */
  getConnectedPeers() {
    const connected = [];
    this.connections.forEach((conn, peerId) => {
      if (conn.open) {
        connected.push(peerId);
      }
    });
    return connected;
  }

  /**
   * Check if a specific peer is connected
   */
  isConnected(peerId) {
    const conn = this.connections.get(peerId);
    return conn && conn.open;
  }

  /**
   * Disconnect a specific peer (host only)
   */
  disconnectPeer(peerId) {
    const conn = this.connections.get(peerId);
    if (conn) {
      if (conn.open) {
        conn.close();
      }
      this.connections.delete(peerId);
    }
  }

  /**
   * Clean up and destroy all connections
   */
  destroy() {
    console.log('[PeerManager] Destroying...');

    // Close all connections
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.close();
      }
    });
    this.connections.clear();

    // Close host connection (if client)
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.close();
    }

    // Destroy peer
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}
