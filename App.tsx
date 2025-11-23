import React, { useState, useEffect, useRef } from 'react';
import { Player, GamePhase, LogEntry, SplitAction, NetworkMode, GameState, NetworkMessage } from './types';
import PlayerCard from './components/PlayerCard';
import Dice from './components/Dice';
import { UserPlusIcon, CrownIcon, SkullIcon } from './components/Icons';
import { generateGameCommentary, generateWinnerToast, generateAvatar } from './services/gemini';

// Declare PeerJS globally (loaded via CDN)
declare const Peer: any;

const DEATH_THRESHOLD = -5;

function App() {
  // --- Network State ---
  const [networkMode, setNetworkMode] = useState<NetworkMode>('OFFLINE'); // Default to lobby/setup
  const [myPeerId, setMyPeerId] = useState<string>('');
  const [hostPeerId, setHostPeerId] = useState<string>('');
  const [myPlayerName, setMyPlayerName] = useState('');
  const [joinGameId, setJoinGameId] = useState('');
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | undefined>(undefined);
  const [peerInstance, setPeerInstance] = useState<any>(null);
  const [connections, setConnections] = useState<any[]>([]); // For Host
  const [hostConnection, setHostConnection] = useState<any>(null); // For Client
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // --- Game State (Synced) ---
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [phase, setPhase] = useState<GamePhase>(GamePhase.LOBBY);
  const [diceValue, setDiceValue] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [winner, setWinner] = useState<Player | null>(null);
  const [aiCommentary, setAiCommentary] = useState<string>("");
  const [turnCount, setTurnCount] = useState(0);
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splitActions, setSplitActions] = useState<SplitAction>({});

  // --- Local UI State ---
  const logEndRef = useRef<HTMLDivElement>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);

  // --- Effects ---
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Sync state to clients (Host Only)
  useEffect(() => {
    if (networkMode === 'HOST' && phase !== GamePhase.LOBBY) {
      broadcastState();
    }
  }, [players, currentPlayerIndex, phase, diceValue, isRolling, logs, winner, aiCommentary, isSplitMode, splitActions]);

  // --- Network Helpers ---

  const initPeer = (id: string | null = null) => {
    // Clean up old peer
    if (peerInstance) peerInstance.destroy();

    const peer = id ? new Peer(id) : new Peer();
    
    peer.on('open', (id: string) => {
      setMyPeerId(id);
      console.log('My peer ID is: ' + id);
      setConnectionError(null);
    });

    peer.on('error', (err: any) => {
      console.error('Peer error:', err);
      setIsGeneratingAvatar(false);

      let errorMessage = `Connection Error: ${err.type}`;
      
      if (err.type === 'peer-unavailable') {
        errorMessage = "Game ID not found. Please check the ID and try again.";
      } else if (err.type === 'unavailable-id') {
        errorMessage = "This ID is already taken or unavailable.";
      } else if (err.type === 'network') {
        errorMessage = "Network connection lost.";
      }

      setConnectionError(errorMessage);
      
      // If we are currently trying to join or host, reset to offline
      if (networkMode !== 'HOST') {
        setNetworkMode('OFFLINE');
      }
    });

    setPeerInstance(peer);
    return peer;
  };

  const startHost = async () => {
    if (!myPlayerName.trim()) return;
    setConnectionError(null);

    // Generate Avatar for Host first
    setIsGeneratingAvatar(true);
    const avatar = await generateAvatar(myPlayerName);
    setMyAvatarUrl(avatar || undefined);
    setIsGeneratingAvatar(false);

    const peer = initPeer();
    setNetworkMode('HOST');
    setPhase(GamePhase.SETUP);

    // Add Self as Player 1
    const hostPlayer: Player = {
      id: 'host-player',
      name: myPlayerName,
      hearts: 0,
      isDead: false,
      avatarSeed: Math.random(),
      avatarUrl: avatar || undefined,
      isHost: true,
      peerId: 'HOST' // Special marker
    };
    setPlayers([hostPlayer]);
    addLog(`Lobby created. Game ID: Waiting...`, 'neutral');

    peer.on('connection', (conn: any) => {
      conn.on('data', (data: NetworkMessage) => {
        handleHostData(data, conn);
      });
      conn.on('open', () => {
        // Just connected, waiting for JOIN message
        setConnections(prev => [...prev, conn]);
      });
      conn.on('close', () => {
        // Handle disconnect?
        setConnections(prev => prev.filter(c => c !== conn));
      });
    });
  };

  const joinGame = async () => {
    if (!myPlayerName.trim() || !joinGameId.trim()) return;
    setConnectionError(null);

    // Generate Avatar for Client
    setIsGeneratingAvatar(true);
    const avatar = await generateAvatar(myPlayerName);
    setMyAvatarUrl(avatar || undefined);
    setIsGeneratingAvatar(false);

    const peer = initPeer();
    setNetworkMode('CLIENT');
    setHostPeerId(joinGameId);

    // Wait for peer to be ready before connecting
    peer.on('open', (id: string) => {
        const conn = peer.connect(joinGameId);
        
        conn.on('open', () => {
          setHostConnection(conn);
          // Send Join Request
          conn.send({ 
            type: 'JOIN', 
            payload: { 
              name: myPlayerName, 
              avatarUrl: avatar, 
              peerId: id 
            } 
          } as NetworkMessage);
        });

        conn.on('data', (data: NetworkMessage) => {
          handleClientData(data);
        });
        
        conn.on('error', (err: any) => {
            console.error("Connection error", err);
            setNetworkMode('OFFLINE'); // Reset on failure
            setConnectionError("Could not connect to host. Check Game ID.");
        });
    });
  };

  const broadcastState = () => {
    const state: GameState = {
      players,
      currentPlayerIndex,
      phase,
      diceValue,
      isRolling,
      logs,
      turnCount,
      winner,
      aiCommentary,
      isSplitMode,
      splitActions
    };
    
    connections.forEach(conn => {
      if (conn.open) {
        conn.send({ type: 'SYNC_STATE', payload: state } as NetworkMessage);
      }
    });
  };

  const sendToHost = (msg: NetworkMessage) => {
    if (hostConnection && hostConnection.open) {
      hostConnection.send(msg);
    }
  };

  // --- Message Handlers ---

  const handleHostData = (data: NetworkMessage, conn: any) => {
    switch (data.type) {
      case 'JOIN':
        const newPlayer: Player = {
          id: data.payload.peerId, // Use Peer ID as Player ID for remote players
          name: data.payload.name,
          hearts: 0,
          isDead: false,
          avatarSeed: Math.random(),
          avatarUrl: data.payload.avatarUrl,
          peerId: data.payload.peerId
        };
        // Avoid duplicates
        setPlayers(prev => {
           if(prev.find(p => p.id === newPlayer.id)) return prev;
           return [...prev, newPlayer];
        });
        broadcastState(); // Force immediate sync
        break;
      
      case 'ACTION_ROLL':
        // Verify it's their turn
        if (players[currentPlayerIndex].id === conn.peer) {
            handleRollDice(); // Host executes logic
        }
        break;
      
      case 'ACTION_DECIDE':
        // Verify turn
        handleAction(data.payload.targetId, data.payload.action);
        break;

      case 'ACTION_SPLIT_ADJUST':
        handleSplitAdjust(data.payload.targetId, data.payload.delta);
        break;
      
      case 'ACTION_SPLIT_TOGGLE':
        setIsSplitMode(data.payload);
        setSplitActions({});
        break;
      
      case 'ACTION_SPLIT_COMMIT':
        handleCommitSplit();
        break;
    }
  };

  const handleClientData = (data: NetworkMessage) => {
    if (data.type === 'SYNC_STATE') {
      const state = data.payload;
      setPlayers(state.players);
      setCurrentPlayerIndex(state.currentPlayerIndex);
      setPhase(state.phase);
      setDiceValue(state.diceValue);
      setIsRolling(state.isRolling);
      setLogs(state.logs);
      setTurnCount(state.turnCount);
      setWinner(state.winner);
      setAiCommentary(state.aiCommentary);
      setIsSplitMode(state.isSplitMode);
      setSplitActions(state.splitActions);
    }
  };


  // --- Game Logic (Runs on Host) ---

  const addLog = (text: string, type: LogEntry['type'] = 'neutral') => {
    setLogs(prev => [...prev, { id: Math.random().toString(36).substring(7), text, type }]);
  };

  const getActivePlayers = () => players.filter(p => !p.isDead);

  const getRemainingSplitPoints = () => {
    if (!diceValue) return 0;
    const usedPoints = Object.values(splitActions).reduce((acc, val) => acc + Math.abs(val as number), 0);
    return diceValue - usedPoints;
  };

  const handleStartGame = () => {
    if (players.length < 2) return;
    setPhase(GamePhase.ROLL);
    addLog("The game of Taraq begins. Everyone starts with 0 hearts.", "neutral");
    addLog("First player to drop to -5 hearts is eliminated.", "neutral");
    if(networkMode === 'HOST') broadcastState();
  };

  // Wrapper for UI interactions
  const triggerRoll = () => {
    if (networkMode === 'HOST') {
        handleRollDice();
    } else {
        sendToHost({ type: 'ACTION_ROLL' });
    }
  };

  const triggerAction = (targetId: string, action: 'ADD' | 'REMOVE') => {
    if (networkMode === 'HOST') {
        handleAction(targetId, action);
    } else {
        sendToHost({ type: 'ACTION_DECIDE', payload: { targetId, action } });
    }
  };

  const triggerSplitAdjust = (targetId: string, delta: number) => {
      if (networkMode === 'HOST') {
          handleSplitAdjust(targetId, delta);
      } else {
          sendToHost({ type: 'ACTION_SPLIT_ADJUST', payload: { targetId, delta } });
      }
  };

  const triggerSplitToggle = (enable: boolean) => {
      if (networkMode === 'HOST') {
          setIsSplitMode(enable);
          if(!enable) setSplitActions({});
      } else {
          sendToHost({ type: 'ACTION_SPLIT_TOGGLE', payload: enable });
      }
  };

  const triggerSplitCommit = () => {
      if (networkMode === 'HOST') {
          handleCommitSplit();
      } else {
          sendToHost({ type: 'ACTION_SPLIT_COMMIT' });
      }
  };


  // --- Core Logic (Host Only) ---

  const handleRollDice = () => {
    setIsRolling(true);
    setAiCommentary(""); 
    setSplitActions({});
    setIsSplitMode(false);
    
    // Broadcast rolling state immediately
    if (networkMode === 'HOST') broadcastState();

    setTimeout(() => {
      const roll = Math.floor(Math.random() * 6) + 1;
      setDiceValue(roll);
      setIsRolling(false);
      setPhase(GamePhase.DECIDE);
      addLog(`${players[currentPlayerIndex].name} rolled a ${roll}.`, "neutral");
    }, 1000);
  };

  const handleAction = (targetId: string, action: 'ADD' | 'REMOVE') => {
    if (diceValue === null) return;

    const activePlayers = getActivePlayers();
    const actor = players[currentPlayerIndex];
    const amount = diceValue;
    
    let victimName = "";
    let victimDied = false;
    let victimRemaining = 0;

    const updatedPlayers = players.map(p => {
      if (p.id !== targetId) return p;

      victimName = p.name;
      const newHearts = action === 'ADD' ? p.hearts + amount : p.hearts - amount;
      const isDead = newHearts <= DEATH_THRESHOLD;
      
      victimRemaining = newHearts;
      if (isDead && !p.isDead) {
        victimDied = true;
      }

      return { ...p, hearts: newHearts, isDead };
    });

    setPlayers(updatedPlayers);
    
    const actionText = action === 'ADD' ? 'gave' : 'removed';
    const prep = action === 'ADD' ? 'to' : 'from';
    const targetText = actor.id === targetId ? 'themselves' : victimName;
    
    addLog(`${actor.name} ${actionText} ${amount} hearts ${prep} ${targetText}.`, action === 'ADD' ? 'positive' : 'negative');

    if (victimDied) {
      addLog(`${victimName} has fallen! (Hearts: ${victimRemaining})`, 'death');
    }

    generateGameCommentary(
      actor.name, 
      targetId === actor.id ? "themselves" : victimName, 
      action, 
      amount, 
      victimRemaining, 
      targetId === actor.id, 
      victimDied
    ).then(comment => {
        if(comment) setAiCommentary(comment);
    });

    checkWinCondition(updatedPlayers);
  };

  const handleSplitAdjust = (targetId: string, delta: number) => {
    if (diceValue === null) return;
    const maxPoints = diceValue;

    setSplitActions((prev) => {
        const currentVal = (prev[targetId] as number) || 0;
        const newVal = currentVal + delta;
        const otherUsage = Object.entries(prev)
            .filter(([id]) => id !== targetId)
            .reduce((sum: number, [, val]) => sum + Math.abs(val as number), 0);
        
        const totalIfApplied = otherUsage + Math.abs(newVal);

        if (totalIfApplied <= maxPoints) {
            if (newVal === 0) {
                const { [targetId]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [targetId]: newVal };
        }
        return prev;
    });
  };

  const handleCommitSplit = () => {
      if (diceValue === null) return;
      const actor = players[currentPlayerIndex];
      
      let deathCount = 0;
      let lastVictimName = "";
      let lastVictimRemaining = 0;

      const updatedPlayers = players.map(p => {
          const change = splitActions[p.id] || 0;
          if (change === 0) return p;

          const newHearts = p.hearts + change;
          const isDead = newHearts <= DEATH_THRESHOLD;
          
          if (isDead && !p.isDead) {
              deathCount++;
              lastVictimName = p.name;
              lastVictimRemaining = newHearts;
          }

          return { ...p, hearts: newHearts, isDead };
      });

      setPlayers(updatedPlayers);

      const changesDesc = Object.entries(splitActions).map(([id, val]) => {
          const pName = players.find(p => p.id === id)?.name || "Unknown";
          const v = val as number;
          return `${v > 0 ? '+' : ''}${v} to ${pName}`;
      }).join(", ");
      
      addLog(`${actor.name} split their ${diceValue} roll: ${changesDesc}.`, 'neutral');
      
      if (deathCount > 0) {
          if (deathCount === 1) {
              addLog(`${lastVictimName} has fallen! (Hearts: ${lastVictimRemaining})`, 'death');
          } else {
              addLog(`${deathCount} players have fallen in a single turn!`, 'death');
          }
      }

      const targetName = Object.keys(splitActions).length > 1 ? "multiple people" : "someone";
      generateGameCommentary(actor.name, targetName, 'ADD', diceValue, 0, false, deathCount > 0)
        .then(comment => { if(comment) setAiCommentary(comment); });

      checkWinCondition(updatedPlayers);
  };

  const checkWinCondition = (currentPlayersState: Player[]) => {
    const livingPlayers = currentPlayersState.filter(p => !p.isDead);
    if (livingPlayers.length === 1 && currentPlayersState.length > 1) {
        setWinner(livingPlayers[0]);
        setPhase(GamePhase.GAME_OVER);
        generateWinnerToast(livingPlayers[0].name, turnCount).then(toast => setAiCommentary(toast));
    } else {
        nextTurn(currentPlayersState);
    }
  };

  const nextTurn = (currentPlayersState: Player[]) => {
    let nextIndex = (currentPlayerIndex + 1) % currentPlayersState.length;
    let loops = 0;
    while (currentPlayersState[nextIndex].isDead && loops < 100) {
      nextIndex = (nextIndex + 1) % currentPlayersState.length;
      loops++;
    }
    setCurrentPlayerIndex(nextIndex);
    setPhase(GamePhase.ROLL);
    setDiceValue(null);
    setIsSplitMode(false);
    setSplitActions({});
    setTurnCount(prev => prev + 1);
  };

  const resetGame = () => {
     // If Host, can restart but keep players connected? 
     // For simplicity, just reset state variables but keep peers
     if (networkMode === 'HOST') {
         setPhase(GamePhase.SETUP);
         setWinner(null);
         setDiceValue(null);
         setLogs([]);
         setPlayers(players.map(p => ({ ...p, hearts: 0, isDead: false })));
         setTurnCount(0);
         setAiCommentary('');
         broadcastState();
     } else {
         // Client quitting? Reload page
         window.location.reload();
     }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(myPeerId);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };


  // --- Render ---

  // LOBBY PHASE
  if (phase === GamePhase.LOBBY) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-4 text-white">
          <div className="max-w-md w-full space-y-8 animate-[fadeIn_0.5s]">
            <div className="text-center">
                <h1 className="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500 mb-2 tracking-tighter">
                TARAQ
                </h1>
                <p className="text-slate-400 text-lg">Multiplayer Survival</p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 shadow-xl backdrop-blur-sm">
                
                {connectionError && (
                   <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-6 text-sm flex items-center gap-2 animate-[pulse_0.5s_ease-out]">
                       <span className="font-bold">Error:</span> {connectionError}
                   </div>
                )}

                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Your Name</label>
                    <input
                        type="text"
                        value={myPlayerName}
                        onChange={(e) => setMyPlayerName(e.target.value)}
                        placeholder="Enter your name..."
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                </div>

                {isGeneratingAvatar ? (
                    <div className="text-center py-8">
                        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-indigo-300">Generating Anime Avatar...</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <button
                            onClick={startHost}
                            disabled={!myPlayerName.trim()}
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02]"
                        >
                            CREATE GAME
                        </button>
                        
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700"></div></div>
                            <div className="relative flex justify-center text-sm"><span className="px-2 bg-slate-800 text-slate-500">OR</span></div>
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={joinGameId}
                                onChange={(e) => setJoinGameId(e.target.value)}
                                placeholder="Paste Game ID"
                                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <button
                                onClick={joinGame}
                                disabled={!myPlayerName.trim() || !joinGameId.trim()}
                                className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-bold px-6 rounded-lg transition-colors"
                            >
                                JOIN
                            </button>
                        </div>
                    </div>
                )}
            </div>
          </div>
        </div>
      );
  }

  // SETUP / WAITING ROOM PHASE
  if (phase === GamePhase.SETUP) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-4 text-white">
        <div className="max-w-2xl w-full">
           <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 shadow-xl backdrop-blur-sm">
              <div className="flex justify-between items-start mb-6">
                 <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Game Lobby</h2>
                    {networkMode === 'HOST' ? (
                         <div className="flex items-center gap-2 mt-2 bg-slate-900 p-2 rounded-lg border border-slate-700">
                             <span className="text-slate-400 text-sm">Game ID:</span>
                             <code className="text-indigo-400 font-mono font-bold select-all">{myPeerId || 'Generating...'}</code>
                             <button onClick={handleCopyId} className="text-slate-400 hover:text-white ml-2">
                                 {copyFeedback ? "Copied!" : "Copy"}
                             </button>
                         </div>
                    ) : (
                        <p className="text-slate-400 animate-pulse">Waiting for host to start...</p>
                    )}
                 </div>
                 <div className="text-right">
                     <div className="text-sm text-slate-500 uppercase tracking-wider">Players</div>
                     <div className="text-2xl font-bold">{players.length}</div>
                 </div>
              </div>

              {/* Player List */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8 max-h-80 overflow-y-auto custom-scrollbar p-2">
                 {players.map(p => (
                     <div key={p.id} className="bg-slate-900 p-4 rounded-xl border border-slate-700 flex flex-col items-center relative">
                         {p.isHost && <div className="absolute top-2 right-2 text-[10px] bg-indigo-900 text-indigo-200 px-1.5 rounded uppercase font-bold">Host</div>}
                         <img src={p.avatarUrl || `https://ui-avatars.com/api/?name=${p.name}`} className="w-16 h-16 rounded-full object-cover mb-2 bg-slate-800" alt={p.name} />
                         <span className="font-bold truncate w-full text-center">{p.name}</span>
                         {p.id === 'host-player' && networkMode === 'HOST' && <span className="text-xs text-indigo-400">(You)</span>}
                         {p.peerId === myPeerId && networkMode === 'CLIENT' && <span className="text-xs text-indigo-400">(You)</span>}
                     </div>
                 ))}
              </div>

              {networkMode === 'HOST' && (
                  <button
                    onClick={handleStartGame}
                    disabled={players.length < 2}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02]"
                  >
                    START GAME
                  </button>
              )}
           </div>
        </div>
      </div>
    );
  }

  // ACTIVE GAME UI
  const remainingSplitPoints = getRemainingSplitPoints();
  const activePlayers = getActivePlayers();
  
  // Determine if it's "My" turn to interact
  const currentPlayer = players[currentPlayerIndex];
  
  // Host controls Host Player. Client controls themselves.
  const canInteract = networkMode === 'HOST' 
    ? (currentPlayer.id === 'host-player') 
    : (currentPlayer.peerId === myPeerId);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 flex flex-col">
      
      {/* Top Bar */}
      <header className="bg-slate-900/80 border-b border-slate-800 p-4 flex items-center justify-between backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-4">
             <h1 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500">TARAQ</h1>
             {networkMode === 'HOST' && <div className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">ID: {myPeerId}</div>}
             {networkMode === 'CLIENT' && <div className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">Connected to Host</div>}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="hidden sm:block text-slate-400">
            Active: <span className="text-white font-mono">{activePlayers.length}/{players.length}</span>
          </div>
          <button onClick={resetGame} className="text-slate-500 hover:text-white transition-colors">
             {networkMode === 'HOST' ? 'Reset' : 'Leave'}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Left: Game Board */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar">
            
            {phase === GamePhase.GAME_OVER && winner && (
               <div className="flex flex-col items-center justify-center h-full animate-[fadeIn_1s_ease-out]">
                  <div className="bg-yellow-500/20 p-8 rounded-full mb-6 relative">
                     <CrownIcon className="w-24 h-24 text-yellow-400" />
                      {winner.avatarUrl && (
                          <img src={winner.avatarUrl} className="absolute inset-0 w-full h-full object-cover rounded-full opacity-50" alt="" />
                      )}
                  </div>
                  <h2 className="text-5xl font-bold text-white mb-2">{winner.name} Wins!</h2>
                  <p className="text-slate-400 mb-8">They survived the fate of Taraq.</p>
                  
                  {aiCommentary && (
                     <div className="bg-slate-800/80 border border-yellow-500/30 p-4 rounded-lg max-w-md text-center mb-8 italic text-yellow-200/80">
                        "{aiCommentary}"
                     </div>
                  )}

                  {networkMode === 'HOST' && (
                      <button 
                        onClick={resetGame}
                        className="bg-white text-slate-900 px-8 py-3 rounded-full font-bold hover:bg-slate-200 transition-colors"
                      >
                        Play Again
                      </button>
                  )}
               </div>
            )}

            {phase !== GamePhase.GAME_OVER && (
                <div className="max-w-6xl mx-auto">
                    {/* Action Center */}
                    <div className="flex flex-col items-center mb-12 min-h-[180px]">
                        
                        {/* Status Message */}
                        <h2 className="text-2xl md:text-3xl font-light mb-6 text-center">
                           {phase === GamePhase.ROLL ? (
                              <>
                                <span className="font-bold text-white">{currentPlayer.name}</span>'s turn to roll.
                              </>
                           ) : (
                              <>
                                <span className="font-bold text-white">{currentPlayer.name}</span> 
                                {isSplitMode 
                                    ? <span> is splitting <span className="text-indigo-400 font-mono font-bold">{remainingSplitPoints}</span> points.</span>
                                    : <span> must choose a fate for <span className="text-indigo-400 font-mono text-4xl mx-2">{diceValue}</span> hearts.</span>
                                }
                              </>
                           )}
                           {!canInteract && phase !== GamePhase.ROLL && <div className="text-sm text-slate-500 mt-2">(Waiting for them to decide...)</div>}
                        </h2>

                        {/* Dice Control & Split Toggle */}
                        <div className="flex flex-col items-center gap-6">
                            <div className={`relative group ${canInteract && phase === GamePhase.ROLL ? 'cursor-pointer' : 'cursor-default'}`} 
                                 onClick={canInteract && phase === GamePhase.ROLL ? triggerRoll : undefined}>
                                <Dice 
                                value={diceValue} 
                                rolling={isRolling} 
                                />
                                {canInteract && phase === GamePhase.ROLL && !isRolling && (
                                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                        Click to Roll
                                    </div>
                                )}
                            </div>

                            {/* Split Controls */}
                            {phase === GamePhase.DECIDE && diceValue && diceValue > 1 && canInteract && (
                                <div className="flex gap-4">
                                    {!isSplitMode && (
                                        <button 
                                            onClick={() => triggerSplitToggle(true)}
                                            className="text-xs uppercase tracking-widest px-4 py-2 rounded-full border border-slate-600 text-slate-400 hover:text-white hover:border-white transition-all"
                                        >
                                            Split Dice
                                        </button>
                                    )}
                                    {isSplitMode && (
                                        <div className="flex gap-2 animate-[fadeIn_0.3s]">
                                            <button 
                                                onClick={() => triggerSplitToggle(false)}
                                                className="text-xs uppercase font-bold px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                                            >
                                                Cancel Split
                                            </button>
                                            <button 
                                                onClick={triggerSplitCommit}
                                                disabled={remainingSplitPoints > 0}
                                                className={`text-xs uppercase font-bold px-6 py-2 rounded-lg transition-colors shadow-lg ${
                                                    remainingSplitPoints === 0 
                                                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white' 
                                                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                                }`}
                                            >
                                                {remainingSplitPoints > 0 ? `Use ${remainingSplitPoints} more` : 'Confirm Split'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* AI Commentary Toast */}
                        {aiCommentary && !isRolling && phase === GamePhase.ROLL && (
                             <div className="mt-6 max-w-lg text-center animate-[slideUp_0.5s_ease-out]">
                                <div className="inline-block bg-gradient-to-r from-indigo-900/80 to-purple-900/80 border border-indigo-500/30 backdrop-blur-md px-6 py-3 rounded-2xl text-indigo-100 italic text-sm shadow-lg">
                                    <span className="opacity-70 mr-2">📢</span>
                                    "{aiCommentary}"
                                </div>
                             </div>
                        )}
                    </div>

                    {/* Player Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                        {players.map((player) => (
                            <PlayerCard
                                key={player.id}
                                player={player}
                                isCurrentTurn={players[currentPlayerIndex].id === player.id}
                                gamePhase={phase}
                                diceValue={diceValue}
                                isSplitMode={isSplitMode}
                                splitPendingValue={splitActions[player.id] || 0}
                                remainingSplitPoints={remainingSplitPoints}
                                canInteract={canInteract}
                                onAction={triggerAction}
                                onSplitAdjust={triggerSplitAdjust}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* Right: Game Log */}
        <div className="w-full md:w-80 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col max-h-[30vh] md:max-h-full">
            <div className="p-4 border-b border-slate-800 font-bold text-slate-400 uppercase text-xs tracking-widest flex items-center justify-between">
                <span>Game Log</span>
                <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-500">Turn {turnCount}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar font-mono text-sm">
                {logs.length === 0 && <div className="text-slate-600 text-center italic mt-4">Game started...</div>}
                {logs.map((log) => (
                    <div key={log.id} className={`
                        p-3 rounded border-l-2 
                        ${log.type === 'death' ? 'bg-red-950/30 border-red-500 text-red-200' : ''}
                        ${log.type === 'positive' ? 'bg-emerald-950/30 border-emerald-500 text-emerald-200' : ''}
                        ${log.type === 'negative' ? 'bg-rose-950/30 border-rose-500 text-rose-200' : ''}
                        ${log.type === 'neutral' ? 'bg-slate-800/50 border-slate-600 text-slate-300' : ''}
                    `}>
                        {log.type === 'death' && <SkullIcon className="w-4 h-4 inline mr-2 mb-0.5" />}
                        {log.text}
                    </div>
                ))}
                <div ref={logEndRef} />
            </div>
        </div>

      </main>
    </div>
  );
}

export default App;