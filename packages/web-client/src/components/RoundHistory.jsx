import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

const suitSymbols = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const suitColors = {
  hearts: 'text-ruby',
  diamonds: 'text-ruby',
  clubs: 'text-charcoal',
  spades: 'text-charcoal',
};

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
          {rounds.map((round) => (
            <div
              key={round.roundNum}
              className="flex items-center justify-between p-3 bg-charcoal/5 rounded-lg"
            >
              {/* Round info */}
              <div className="flex items-center gap-3">
                <span className="text-charcoal/40 text-sm w-6">#{round.roundNum}</span>
                <span className={`text-2xl ${suitColors[round.trump]}`}>
                  {suitSymbols[round.trump]}
                </span>
                <div className="text-sm">
                  <span className="text-charcoal/60">
                    {round.taker === 'A' ? teams?.a.name : teams?.b.name} takes
                  </span>
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

              {/* Score & Delete */}
              <div className="flex items-center gap-3">
                <div className="text-right text-sm">
                  <div className="text-charcoal font-medium">
                    {round.scores?.A || 0} - {round.scores?.B || 0}
                  </div>
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
          ))}
        </CardContent>
      )}
    </Card>
  );
};

export default RoundHistory;
