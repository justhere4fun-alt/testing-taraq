import React from 'react';
import { Player, GamePhase } from '../types';
import { HeartIcon, SkullIcon } from './Icons';

interface PlayerCardProps {
  player: Player;
  isCurrentTurn: boolean;
  gamePhase: GamePhase;
  diceValue: number | null;
  isSplitMode: boolean;
  splitPendingValue: number; // How much is currently assigned to this player in split mode
  remainingSplitPoints: number; // Global points left to assign
  canInteract: boolean; // New prop to control if buttons are clickable
  onAction: (targetId: string, action: 'ADD' | 'REMOVE') => void;
  onSplitAdjust: (targetId: string, delta: number) => void;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ 
  player, 
  isCurrentTurn, 
  gamePhase, 
  diceValue, 
  isSplitMode,
  splitPendingValue,
  remainingSplitPoints,
  canInteract,
  onAction,
  onSplitAdjust
}) => {
  
  const isDead = player.isDead;
  const showStandardActions = gamePhase === GamePhase.DECIDE && !isDead && !isSplitMode;
  const showSplitActions = gamePhase === GamePhase.DECIDE && !isDead && isSplitMode;

  // Dynamic styles based on status
  let cardBorder = "border-slate-700";
  let cardBg = "bg-slate-800/50";
  let shadow = "shadow-none";

  if (isCurrentTurn) {
    cardBorder = "border-yellow-500";
    cardBg = "bg-slate-800";
    shadow = "shadow-[0_0_15px_rgba(234,179,8,0.3)]";
  }
  if (isDead) {
    cardBorder = "border-red-900/50";
    cardBg = "bg-red-950/20";
  }

  return (
    <div className={`
      relative flex flex-col items-center p-6 rounded-xl border-2 transition-all duration-300
      ${cardBorder} ${cardBg} ${shadow}
      ${isDead ? 'opacity-80 grayscale-[0.5]' : 'opacity-100'}
    `}>
      {/* Turn Indicator Badge */}
      {isCurrentTurn && (
        <div className="absolute -top-3 px-3 py-1 bg-yellow-500 text-black text-xs font-bold uppercase tracking-wider rounded-full shadow-lg z-10">
          Current Turn
        </div>
      )}

      {/* Host Badge */}
      {player.isHost && !isDead && (
         <div className="absolute top-2 right-2 px-2 py-0.5 bg-indigo-900/80 text-indigo-200 text-[10px] font-bold uppercase rounded border border-indigo-700/50">
           HOST
         </div>
      )}

      {/* Avatar / Icon */}
      <div className={`
        w-24 h-24 rounded-full flex items-center justify-center mb-4 shadow-xl overflow-hidden relative border-4
        ${isDead ? 'border-red-900/50 bg-slate-900' : 'border-slate-700 bg-slate-800'}
      `}>
        {player.avatarUrl ? (
            <>
                <img 
                    src={player.avatarUrl} 
                    alt={player.name} 
                    className={`w-full h-full object-cover transition-all duration-500 ${isDead ? 'grayscale blur-[2px]' : ''}`} 
                />
                {isDead && (
                     <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                         <SkullIcon className="w-10 h-10 text-red-500 drop-shadow-lg" />
                     </div>
                )}
            </>
        ) : (
            <div className={`w-full h-full flex items-center justify-center text-3xl font-bold ${isDead ? 'text-red-700' : 'text-white bg-indigo-600'}`}>
                 {isDead ? <SkullIcon className="w-10 h-10" /> : player.name.charAt(0).toUpperCase()}
            </div>
        )}
      </div>

      {/* Name */}
      <h3 className="text-lg font-bold text-slate-100 mb-1 truncate max-w-full">
        {player.name}
      </h3>

      {/* Status */}
      <div className="flex items-center space-x-2 mb-4">
        {isDead ? (
          <span className="text-red-500 font-bold text-sm">ELIMINATED</span>
        ) : (
          <>
            <HeartIcon className={`w-5 h-5 ${player.hearts < 0 ? 'text-red-400' : 'text-pink-500'}`} filled />
            <span className={`text-2xl font-mono font-bold ${player.hearts < 0 ? 'text-red-400' : 'text-white'}`}>
              {player.hearts}
            </span>
            {splitPendingValue !== 0 && (
                <span className={`text-sm font-bold ${splitPendingValue > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ({splitPendingValue > 0 ? '+' : ''}{splitPendingValue})
                </span>
            )}
            <span className="text-slate-500 text-xs ml-1">Lives</span>
          </>
        )}
      </div>

      {/* Death Warning */}
      {!isDead && player.hearts <= -3 && (
         <div className="text-xs text-orange-400 mb-2 animate-pulse">
            Near Death!
         </div>
      )}

      {/* Action Buttons (Standard Mode) */}
      {showStandardActions && diceValue !== null && (
        <div className={`grid grid-cols-2 gap-2 w-full mt-auto pt-2 border-t border-slate-700/50 ${!canInteract ? 'opacity-50 pointer-events-none' : ''}`}>
           <button
             onClick={() => onAction(player.id, 'ADD')}
             className="flex flex-col items-center justify-center py-2 px-1 bg-emerald-900/40 hover:bg-emerald-700 text-emerald-400 hover:text-white rounded-lg transition-colors border border-emerald-800/50"
           >
             <span className="text-xs font-bold uppercase mb-0.5">Heal</span>
             <span className="text-lg font-bold leading-none">+{diceValue}</span>
           </button>
           
           <button
             onClick={() => onAction(player.id, 'REMOVE')}
             className="flex flex-col items-center justify-center py-2 px-1 bg-rose-900/40 hover:bg-rose-700 text-rose-400 hover:text-white rounded-lg transition-colors border border-rose-800/50"
           >
             <span className="text-xs font-bold uppercase mb-0.5">Harm</span>
             <span className="text-lg font-bold leading-none">-{diceValue}</span>
           </button>
        </div>
      )}

      {/* Action Buttons (Split Mode) */}
      {showSplitActions && (
          <div className={`w-full mt-auto pt-2 border-t border-slate-700/50 ${!canInteract ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between bg-slate-900 rounded-lg p-1">
                  {/* Harm Button (-1) */}
                  <button 
                    onClick={() => onSplitAdjust(player.id, -1)}
                    className={`
                        w-10 h-10 rounded flex items-center justify-center font-bold transition-colors
                        ${remainingSplitPoints === 0 && splitPendingValue >= 0 
                            ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                            : 'bg-rose-900/50 text-rose-400 hover:bg-rose-700 hover:text-white'}
                    `}
                  >
                      -1
                  </button>

                  {/* Current Pending Value Display */}
                  <div className="font-mono font-bold w-12 text-center">
                      {splitPendingValue}
                  </div>

                  {/* Heal Button (+1) */}
                  <button 
                    onClick={() => onSplitAdjust(player.id, 1)}
                    disabled={remainingSplitPoints === 0 && splitPendingValue <= 0}
                    className={`
                        w-10 h-10 rounded flex items-center justify-center font-bold transition-colors
                        ${remainingSplitPoints === 0 && splitPendingValue <= 0 
                            ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                            : 'bg-emerald-900/50 text-emerald-400 hover:bg-emerald-700 hover:text-white'}
                    `}
                  >
                      +1
                  </button>
              </div>
              <div className="text-[10px] text-center text-slate-500 mt-1 uppercase tracking-wider">
                  Adjust Hearts
              </div>
          </div>
      )}
    </div>
  );
};

export default PlayerCard;