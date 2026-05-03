import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Crown, Users, Play } from 'lucide-react';
import { createGame } from '@/lib/api';

// Tarot setup page - configure player count and names
const SetupPage = () => {
  const navigate = useNavigate();
  const [playerCount, setPlayerCount] = useState(4);
  const [players, setPlayers] = useState(['', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Update player name at index
  const handlePlayerChange = (index, value) => {
    const newPlayers = [...players];
    newPlayers[index] = value;
    setPlayers(newPlayers);
  };

  // Create game and navigate to game page
  const handleStart = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get player names (use defaults if empty)
      const playerNames = players.slice(0, playerCount).map((name, i) =>
        name.trim() || `Joueur ${i + 1}`
      );

      const game = await createGame({
        type: 'tarot',
        players: playerNames,
        playerCount,
      });

      navigate(`/tarot/game/${game.id}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-felt pb-8">
      {/* Header with safe area */}
      <div className="sticky top-0 bg-felt-dark/95 backdrop-blur-sm z-10 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] border-b border-ivory/10">
        <div className="max-w-lg mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate('/new-game')}
            className="text-ivory/80 hover:text-ivory hover:bg-ivory/10"
          >
            <ArrowLeft className="size-4 mr-2" />
            Back
          </Button>
        </div>
      </div>

      {/* Setup Form */}
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <Card className="bg-ivory/95 border-gold/30 shadow-xl">
          <CardHeader className="text-center pb-2">
            <Crown className="size-10 text-gold mx-auto mb-2" />
            <CardTitle className="text-charcoal">New Tarot Game</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Player Count */}
            <div>
              <Label className="text-charcoal/60 mb-2 block">
                <Users className="size-4 inline mr-2" />
                Number of Players
              </Label>
              <div className="flex gap-2">
                {[3, 4, 5].map((count) => (
                  <Button
                    key={count}
                    variant={playerCount === count ? 'default' : 'outline'}
                    onClick={() => setPlayerCount(count)}
                    className={playerCount === count
                      ? 'flex-1 h-12 bg-ruby text-ivory hover:bg-ruby/90'
                      : 'flex-1 h-12 border-charcoal/20 text-charcoal'
                    }
                  >
                    {count} Players
                  </Button>
                ))}
              </div>
            </div>

            {/* Player Names */}
            <div className="space-y-3">
              <Label className="text-charcoal/60">Player Names</Label>
              {Array.from({ length: playerCount }).map((_, i) => (
                <Input
                  key={i}
                  value={players[i]}
                  onChange={(e) => handlePlayerChange(i, e.target.value)}
                  placeholder={`Joueur ${i + 1}`}
                  className="h-12 border-charcoal/20 bg-white"
                />
              ))}
            </div>

            {/* Error */}
            {error && (
              <p className="text-ruby text-sm text-center">{error}</p>
            )}

            {/* Start Button */}
            <Button
              onClick={handleStart}
              disabled={loading}
              className="w-full h-14 bg-gold text-charcoal hover:bg-gold/90 text-lg"
            >
              {loading ? 'Creating...' : (
                <>
                  <Play className="size-5 mr-2" />
                  Start Game
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-ivory/60 border-gold/20">
          <CardContent className="p-4 text-sm text-charcoal/60">
            <p className="mb-2"><strong>French Tarot Rules:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>3-5 players, one taker per round</li>
              <li>Contracts: Petite, Garde, Garde Sans, Garde Contre</li>
              <li>5 players: taker can call a King for a partner</li>
              <li>Bonuses: Petit au bout, Poignee, Chelem</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SetupPage;
