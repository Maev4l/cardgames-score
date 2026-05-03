import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Trash2, Users, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Format date helper
const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
};

// Belote game card - 2 teams with scores
const BeloteGameCard = ({ game, isFinished, onDelete }) => {
  const scoreA = game.teams?.a.score || 0;
  const scoreB = game.teams?.b.score || 0;
  const winner = scoreA >= game.targetScore ? 'A' : scoreB >= game.targetScore ? 'B' : null;

  return (
    <>
      {/* Header */}
      <div className="mb-3 pb-3 border-b border-charcoal/10 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-ruby" />
          <span className="text-charcoal/60">Belote</span>
          <span className="text-charcoal/40">• Target: {game.targetScore}</span>
        </div>
        <div className="flex items-center gap-2">
          {isFinished && <Trophy className="size-4 text-gold" />}
          <span className="text-charcoal/40">{formatDate(game.createdAt)}</span>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(game);
              }}
              className="text-charcoal/30 hover:text-ruby hover:bg-ruby/10 -mr-2"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Scores */}
      <div className="flex items-center justify-between">
        {/* Team A */}
        <div className="text-center flex-1">
          <div className={cn(
            'text-sm mb-1',
            winner === 'A' ? 'text-gold font-medium' : 'text-charcoal/60'
          )}>
            {game.teams?.a.name || 'Team A'}
          </div>
          <div className={cn(
            'font-display text-3xl',
            winner === 'A' ? 'text-gold' : 'text-charcoal'
          )}>
            {scoreA}
          </div>
        </div>

        {/* Center */}
        <div className="px-4 flex flex-col items-center">
          <span className="text-charcoal/30 text-xl">-</span>
        </div>

        {/* Team B */}
        <div className="text-center flex-1">
          <div className={cn(
            'text-sm mb-1',
            winner === 'B' ? 'text-gold font-medium' : 'text-charcoal/60'
          )}>
            {game.teams?.b.name || 'Team B'}
          </div>
          <div className={cn(
            'font-display text-3xl',
            winner === 'B' ? 'text-gold' : 'text-charcoal'
          )}>
            {scoreB}
          </div>
        </div>
      </div>
    </>
  );
};

// Tarot game card - horizontal grid for all players
const TarotGameCard = ({ game, isFinished, onDelete }) => {
  const players = game.players || [];
  // Find leader (highest score)
  const maxScore = Math.max(...players.map(p => p.score || 0));

  return (
    <>
      {/* Header */}
      <div className="mb-3 pb-2 border-b border-charcoal/10 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Crown className="size-4 text-gold" />
          <span className="text-charcoal/60">Tarot</span>
          <span className="text-charcoal/40">• {players.length} players</span>
        </div>
        <div className="flex items-center gap-2">
          {isFinished && <Trophy className="size-4 text-gold" />}
          <span className="text-charcoal/40">{formatDate(game.createdAt)}</span>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(game);
              }}
              className="text-charcoal/30 hover:text-ruby hover:bg-ruby/10 -mr-2"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Player scores - horizontal grid, equal columns */}
      <div
        className="grid text-center"
        style={{ gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))` }}
      >
        {players.map((player, idx) => {
          const isLeader = player.score === maxScore && maxScore !== 0;
          return (
            <div key={idx} className="px-1">
              <div className={cn(
                'text-xs truncate mb-1',
                isLeader ? 'text-gold font-medium' : 'text-charcoal/60'
              )}>
                {player.name}
              </div>
              <div className={cn(
                'font-display text-2xl',
                isLeader ? 'text-gold' : 'text-charcoal'
              )}>
                {player.score || 0}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

const GameCard = ({ game, onClick, onDelete }) => {
  const isFinished = game.status === 'finished';
  const isTarot = game.type === 'tarot';

  return (
    <Card
      className={cn(
        'bg-ivory/95 border-gold/30 shadow-lg cursor-pointer transition-all hover:shadow-xl hover:scale-[1.02]',
        isFinished && 'opacity-80'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {isTarot ? (
          <TarotGameCard game={game} isFinished={isFinished} onDelete={onDelete} />
        ) : (
          <BeloteGameCard game={game} isFinished={isFinished} onDelete={onDelete} />
        )}
      </CardContent>
    </Card>
  );
};

export default GameCard;
