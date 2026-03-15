import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Crown } from 'lucide-react';

// Placeholder page for Tarot - not yet implemented
const SetupPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-felt p-4">
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

      {/* Coming Soon */}
      <Card className="max-w-lg mx-auto bg-ivory/95 border-gold/30 shadow-xl">
        <CardHeader className="text-center">
          <Crown className="size-12 text-charcoal/30 mx-auto mb-4" />
          <CardTitle className="text-charcoal">Tarot</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-charcoal/60 mb-6">
            French Tarot scoring is coming soon. This feature is currently under development.
          </p>
          <Button
            variant="outline"
            onClick={() => navigate('/new-game')}
            className="border-charcoal/20 text-charcoal"
          >
            Go Back
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetupPage;
