import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, Crown } from 'lucide-react';

const NewGamePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-felt px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
      {/* Header */}
      <div className="max-w-lg mx-auto mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/home')}
          className="text-ivory/80 hover:text-ivory hover:bg-ivory/10"
        >
          <ArrowLeft className="size-4 mr-2" />
          Back
        </Button>
      </div>

      {/* Title */}
      <div className="max-w-lg mx-auto text-center mb-8">
        <h1 className="font-display text-3xl text-ivory mb-2">New Game</h1>
        <p className="text-ivory/60">Choose a card game to play</p>
      </div>

      {/* Game Options */}
      <div className="max-w-lg mx-auto space-y-4">
        {/* Belote - Active */}
        <Card
          className="bg-ivory/95 border-gold/30 shadow-xl cursor-pointer hover:bg-ivory transition-colors"
          onClick={() => navigate('/belote/setup')}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-ruby/10 rounded-lg">
                <Users className="size-6 text-ruby" />
              </div>
              <div>
                <CardTitle className="text-charcoal text-lg">Belote</CardTitle>
                <CardDescription>2 teams, 32 cards</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-charcoal/70 text-sm">
              Classic French Belote for 2 teams. First to reach the target score wins.
            </p>
          </CardContent>
        </Card>

        {/* Tarot - Active */}
        <Card
          className="bg-ivory/95 border-gold/30 shadow-xl cursor-pointer hover:bg-ivory transition-colors"
          onClick={() => navigate('/tarot/setup')}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gold/10 rounded-lg">
                <Crown className="size-6 text-gold" />
              </div>
              <div>
                <CardTitle className="text-charcoal text-lg">Tarot</CardTitle>
                <CardDescription>3-5 players, 78 cards</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-charcoal/70 text-sm">
              French Tarot for 3-5 players. Complex bidding and scoring system.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NewGamePage;
