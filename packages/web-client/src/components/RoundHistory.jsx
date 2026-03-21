import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import { useState } from 'react';

const RoundHistory = ({ rounds, teams, onDelete }) => {
  const [expanded, setExpanded] = useState(true);

  if (!rounds || rounds.length === 0) {
    return null;
  }

  return (
    <Card className="bg-ivory/95 border-gold/30 shadow-xl">
      <CardHeader
        className="pb-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-charcoal text-lg">
            Round History ({rounds.length})
          </CardTitle>
          {expanded ? (
            <ChevronUp className="size-5 text-charcoal/40" />
          ) : (
            <ChevronDown className="size-5 text-charcoal/40" />
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-2">
          {rounds.map((round) => {
            const scoreA = round.scores?.A || 0;
            const scoreB = round.scores?.B || 0;
            const takerWon = (round.taker === 'A' && scoreA > scoreB) ||
                             (round.taker === 'B' && scoreB > scoreA);
            const takerName = round.taker === 'A' ? teams?.a.name : teams?.b.name;

            return (
              <div
                key={round.roundNum}
                className="flex items-center justify-between p-3 bg-charcoal/5 rounded-lg"
              >
                {/* Round info: number, win/lose icon, taker */}
                <div className="flex items-center gap-2">
                  <span className="text-charcoal/40 text-sm w-6">#{round.roundNum}</span>
                  {/* Win/lose indicator */}
                  {takerWon ? (
                    <Check className="size-5 text-green-600" />
                  ) : (
                    <X className="size-5 text-ruby" />
                  )}
                  <div className="text-sm">
                    <span className="text-charcoal/60">{takerName}</span>
                    {round.belote && (
                      <span className="ml-2 px-1.5 py-0.5 bg-gold/20 text-gold rounded text-xs">
                        Belote
                      </span>
                    )}
                    {round.capot && (
                      <span className="ml-2 px-1.5 py-0.5 bg-ruby/20 text-ruby rounded text-xs">
                        Capot
                      </span>
                    )}
                  </div>
                </div>

                {/* Scores with fixed widths for alignment */}
                <div className="flex items-center gap-2">
                  <div className="text-sm tabular-nums">
                    <span className={scoreA > scoreB ? 'text-charcoal font-bold' : 'text-charcoal/60'}>
                      {teams?.a.name}:&nbsp;{scoreA}
                    </span>
                    <span className="text-charcoal/40 mx-1">–</span>
                    <span className={scoreB > scoreA ? 'text-charcoal font-bold' : 'text-charcoal/60'}>
                      {teams?.b.name}:&nbsp;{scoreB}
                    </span>
                  </div>
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onDelete(round.roundNum)}
                      className="text-charcoal/40 hover:text-ruby hover:bg-ruby/10"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
};

export default RoundHistory;
