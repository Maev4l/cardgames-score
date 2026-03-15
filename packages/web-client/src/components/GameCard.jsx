import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Clock, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const GameCard = ({ game, onClick, onDelete }) => {
  const isFinished = game.status === 'finished';
  const scoreA = game.teams?.a.score || 0;
  const scoreB = game.teams?.b.score || 0;
  const winner = scoreA >= game.targetScore ? 'A' : scoreB >= game.targetScore ? 'B' : null;

  // Format date
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card
      className={cn(
        'bg-ivory/95 border-gold/30 shadow-lg cursor-pointer transition-all hover:shadow-xl hover:scale-[1.02]',
        isFinished && 'opacity-80'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
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
            {isFinished ? (
              <Trophy className={cn(
                'size-5 mb-1',
                winner ? 'text-gold' : 'text-charcoal/30'
              )} />
            ) : (
              <Clock className="size-5 text-charcoal/30 mb-1" />
            )}
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

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-charcoal/10 flex items-center justify-between text-xs">
          <span className="text-charcoal/40">
            Target: {game.targetScore}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-charcoal/40">
              {formatDate(game.createdAt)}
            </span>
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
      </CardContent>
    </Card>
  );
};

export default GameCard;
