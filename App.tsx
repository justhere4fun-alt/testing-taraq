import React, { useState, useEffect, useRef } from 'react';
import { Player, GamePhase, LogEntry } from './types';
import PlayerCard from './components/PlayerCard';
import Dice from './components/Dice';
import { UserPlusIcon, CrownIcon, SkullIcon } from './components/Icons';
import { generateGameCommentary, generateWinnerToast, generateAvatar } from './services/gemini';

const DEATH_THRESHOLD = -5;

function App() {
  // --- State ---
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [phase, setPhase] = useState<GamePhase>(GamePhase.SETUP);
  const [diceValue, setDiceValue] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [winner, setWinner] = useState<Player | null>(null);
  const [aiCommentary, setAiCommentary] = useState<string>("");
  const [turnCount, setTurnCount] = useState(0);

  const logEndRef = useRef<HTMLDivElement>(null);

  // --- Effects ---
  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // --- Helpers ---
  const addLog = (text: string, type: LogEntry['type'] = 'neutral') => {
    setLogs(prev => [...prev, { id: Math.random().toString(36).substring(7), text, type }]);
  };

  const getActivePlayers = () => players.filter(p => !p.isDead);

  // --- Handlers ---

  const handleAddPlayer = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newPlayerName.trim()) return;
    
    const newId = Math.random().toString(36).substring(7);
    const newPlayer: Player = {
      id: newId,
      name: newPlayerName.trim(),
      hearts: 0,
      isDead: false,
      avatarSeed: Math.floor(Math.random() * 1000)
    };
    
    setPlayers(prev => [...prev, newPlayer]);
    setNewPlayerName('');

    // Generate Avatar Asynchronously
    generateAvatar(newPlayer.name).then(url => {
      if (url) {
        setPlayers(currentPlayers => 
          currentPlayers.map(p => p.id === newId ? { ...p, avatarUrl: url } : p)
        );
      }
    });
  };

  const handleStartGame = () => {
    if (players.length < 2) return;
    setPhase(GamePhase.ROLL);
    addLog("The game of Taraq begins. Everyone starts with 0 hearts.", "neutral");
    addLog("First player to drop to -5 hearts is eliminated.", "neutral");
  };

  const handleRollDice = () => {
    setIsRolling(true);
    setAiCommentary(""); // Clear old commentary
    
    // Simulate roll time
    setTimeout(() => {
      const roll = Math.floor(Math.random() * 6) + 1;
      setDiceValue(roll);
      setIsRolling(false);
      setPhase(GamePhase.DECIDE);
      addLog(`${players[currentPlayerIndex].name} rolled a ${roll}.`, "neutral");
    }, 1000);
  };

  const handleAction = async (targetId: string, action: 'ADD' | 'REMOVE') => {
    if (diceValue === null) return;

    const activePlayers = getActivePlayers();
    const actor = players[currentPlayerIndex];
    const amount = diceValue;
    
    // Optimistic UI Update
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
    
    // Logging
    const actionText = action === 'ADD' ? 'gave' : 'removed';
    const prep = action === 'ADD' ? 'to' : 'from';
    const targetText = actor.id === targetId ? 'themselves' : victimName;
    
    addLog(`${actor.name} ${actionText} ${amount} hearts ${prep} ${targetText}.`, action === 'ADD' ? 'positive' : 'negative');

    if (victimDied) {
      addLog(`${victimName} has fallen! (Hearts: ${victimRemaining})`, 'death');
    }

    // Trigger AI Commentary (Non-blocking)
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

    // Check Win Condition
    const livingPlayers = updatedPlayers.filter(p => !p.isDead);
    if (livingPlayers.length === 1) {
        setWinner(livingPlayers[0]);
        setPhase(GamePhase.GAME_OVER);
        generateWinnerToast(livingPlayers[0].name, turnCount).then(toast => setAiCommentary(toast));
    } else {
        nextTurn(updatedPlayers);
    }
  };

  const nextTurn = (currentPlayersState: Player[]) => {
    // Find next living player index
    let nextIndex = (currentPlayerIndex + 1) % currentPlayersState.length;
    
    // Loop until we find a living player (safety valve < 100 to prevent infinite if logic bugs)
    let loops = 0;
    while (currentPlayersState[nextIndex].isDead && loops < 100) {
      nextIndex = (nextIndex + 1) % currentPlayersState.length;
      loops++;
    }

    setCurrentPlayerIndex(nextIndex);
    setPhase(GamePhase.ROLL);
    setDiceValue(null);
    setTurnCount(prev => prev + 1);
  };

  const resetGame = () => {
    setPlayers([]);
    setWinner(null);
    setLogs([]);
    setPhase(GamePhase.SETUP);
    setCurrentPlayerIndex(0);
    setDiceValue(null);
    setAiCommentary("");
    setTurnCount(0);
  };

  // --- Render Helpers ---
  
  if (phase === GamePhase.SETUP) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-4 text-white">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
             <h1 className="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500 mb-2 tracking-tighter">
              TARAQ
            </h1>
            <p className="text-slate-400 text-lg">Survival of the fittest. <br/>Start with 0. Die at -5.</p>
          </div>
          
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 shadow-xl backdrop-blur-sm">
            <form onSubmit={handleAddPlayer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Add Player</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    placeholder="Enter name..."
                    className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  />
                  <button 
                    type="submit"
                    disabled={!newPlayerName.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 rounded-lg transition-colors flex items-center justify-center"
                  >
                    <UserPlusIcon className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </form>

            <div className="mt-6">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Roster ({players.length})</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {players.length === 0 && (
                  <p className="text-slate-600 text-center py-4 italic">No players added yet.</p>
                )}
                {players.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-slate-900/50 px-4 py-3 rounded-lg border border-slate-700/50">
                    <div className="flex items-center gap-3">
                         {p.avatarUrl ? (
                           <img src={p.avatarUrl} alt={p.name} className="w-8 h-8 rounded-full object-cover border border-slate-600" />
                         ) : (
                           <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
                              {p.name.charAt(0).toUpperCase()}
                           </div>
                         )}
                        <span className="font-medium">{p.name}</span>
                    </div>
                    <button 
                      onClick={() => setPlayers(players.filter(pl => pl.id !== p.id))}
                      className="text-slate-500 hover:text-red-400 transition-colors"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleStartGame}
              disabled={players.length < 2}
              className="w-full mt-8 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              START GAME
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 flex flex-col">
      
      {/* Top Bar */}
      <header className="bg-slate-900/80 border-b border-slate-800 p-4 flex items-center justify-between backdrop-blur-md sticky top-0 z-20">
        <h1 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500">TARAQ</h1>
        <div className="flex items-center gap-4 text-sm">
          <div className="hidden sm:block text-slate-400">
            Active Players: <span className="text-white font-mono">{getActivePlayers().length}/{players.length}</span>
          </div>
          <button onClick={resetGame} className="text-slate-500 hover:text-white transition-colors">
             Quit Game
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

                  <button 
                    onClick={resetGame}
                    className="bg-white text-slate-900 px-8 py-3 rounded-full font-bold hover:bg-slate-200 transition-colors"
                  >
                    Play Again
                  </button>
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
                                <span className="font-bold text-white">{players[currentPlayerIndex].name}</span>'s turn to roll.
                              </>
                           ) : (
                              <>
                                <span className="font-bold text-white">{players[currentPlayerIndex].name}</span> must choose a fate for <span className="text-indigo-400 font-mono text-4xl mx-2">{diceValue}</span> hearts.
                              </>
                           )}
                        </h2>

                        {/* Dice Control */}
                        <div className="relative group cursor-pointer" onClick={phase === GamePhase.ROLL ? handleRollDice : undefined}>
                            <Dice 
                              value={diceValue} 
                              rolling={isRolling} 
                            />
                            {phase === GamePhase.ROLL && !isRolling && (
                                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                    Click to Roll
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
                                onAction={handleAction}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* Right: Game Log (Sidebar on desktop, bottom on mobile) */}
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