import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Play } from 'lucide-react';
import { createGame } from '@/lib/api';

const SetupPage = () => {
  const navigate = useNavigate();
  const [teamA, setTeamA] = useState('Nous');
  const [teamB, setTeamB] = useState('Eux');
  const [targetScore, setTargetScore] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleStartGame = async () => {
    setLoading(true);
    setError(null);

    try {
      const game = await createGame({
        type: 'belote',
        teams: {
          a: { name: teamA, score: 0 },
          b: { name: teamB, score: 0 },
        },
        targetScore,
      });
      navigate(`/belote/game/${game.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create game');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-felt px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
      {/* Header */}
      <div className="max-w-lg mx-auto mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/new-game')}
          className="text-ivory/80 hover:text-ivory hover:bg-ivory/10"
        >
          <ArrowLeft className="size-4 mr-2" />
          Back
        </Button>
      </div>

      {/* Title */}
      <div className="max-w-lg mx-auto text-center mb-8">
        <h1 className="font-display text-3xl text-ivory mb-2">Belote Setup</h1>
        <p className="text-ivory/60">Configure your game</p>
      </div>

      {/* Setup Form */}
      <Card className="max-w-lg mx-auto bg-ivory/95 border-gold/30 shadow-xl">
        <CardHeader>
          <CardTitle className="text-charcoal">Team Names</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Team A */}
          <div className="space-y-2">
            <Label htmlFor="teamA" className="text-charcoal/70">Team A</Label>
            <Input
              id="teamA"
              value={teamA}
              onChange={(e) => setTeamA(e.target.value)}
              placeholder="Nous"
              className="bg-white border-charcoal/20"
            />
          </div>

          {/* Team B */}
          <div className="space-y-2">
            <Label htmlFor="teamB" className="text-charcoal/70">Team B</Label>
            <Input
              id="teamB"
              value={teamB}
              onChange={(e) => setTeamB(e.target.value)}
              placeholder="Eux"
              className="bg-white border-charcoal/20"
            />
          </div>

          {/* Target Score */}
          <div className="space-y-3">
            <Label className="text-charcoal/70">Target Score</Label>
            <div className="flex gap-3">
              <Button
                variant={targetScore === 1000 ? 'default' : 'outline'}
                onClick={() => setTargetScore(1000)}
                className={targetScore === 1000
                  ? 'flex-1 bg-gold text-charcoal hover:bg-gold/90'
                  : 'flex-1 border-charcoal/20 text-charcoal'
                }
              >
                1000
              </Button>
              <Button
                variant={targetScore === 2000 ? 'default' : 'outline'}
                onClick={() => setTargetScore(2000)}
                className={targetScore === 2000
                  ? 'flex-1 bg-gold text-charcoal hover:bg-gold/90'
                  : 'flex-1 border-charcoal/20 text-charcoal'
                }
              >
                2000
              </Button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-ruby text-sm text-center">{error}</p>
          )}

          {/* Start Button */}
          <Button
            onClick={handleStartGame}
            disabled={loading || !teamA.trim() || !teamB.trim()}
            className="w-full h-12 bg-ruby text-ivory hover:bg-ruby/90 text-lg font-medium"
          >
            {loading ? (
              'Creating...'
            ) : (
              <>
                <Play className="size-5 mr-2" />
                Start Game
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetupPage;
