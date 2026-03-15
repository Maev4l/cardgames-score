import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Camera, Check, Trash2, Home } from 'lucide-react';
import { getGame, addRound, deleteRound, deleteGame } from '@/lib/api';
import TrumpSelector from '@/components/TrumpSelector';
import TeamToggle from '@/components/TeamToggle';
import RoundHistory from '@/components/RoundHistory';
import CameraCapture from '@/components/CameraCapture';
import DetectedCards from '@/components/DetectedCards';
import ConfirmModal from '@/components/ConfirmModal';

const GamePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Game state
  const [game, setGame] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Round entry state
  const [taker, setTaker] = useState('A');
  const [trump, setTrump] = useState('hearts');
  const [pointsA, setPointsA] = useState(0);
  const [pointsB, setPointsB] = useState(0);
  const [belote, setBelote] = useState(false);
  const [capot, setCapot] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Camera/detection state
  const [showCamera, setShowCamera] = useState(false);
  const [showTeamSelect, setShowTeamSelect] = useState(false); // Team selection before scan
  const [scanTeam, setScanTeam] = useState(null); // Which team's pile is being scanned
  const [showDetection, setShowDetection] = useState(false);

  // Confirmation modal state
  const [confirmAction, setConfirmAction] = useState(null); // 'delete' | null

  // Winner popup state - tracks when game finishes
  const [showWinnerPopup, setShowWinnerPopup] = useState(false);
  const prevStatusRef = useRef(null);

  // Cards grouped by image for display
  const [cardsByImage, setCardsByImage] = useState([]);

  // Load game data
  const loadGame = useCallback(async () => {
    try {
      const data = await getGame(id, 'belote');
      setGame(data.game);
      setRounds(data.rounds || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  // Show winner popup when game transitions to finished
  useEffect(() => {
    if (game?.status === 'finished' && prevStatusRef.current === 'active') {
      setShowWinnerPopup(true);
    }
    prevStatusRef.current = game?.status;
  }, [game?.status]);

  // Handle card detection result - show review UI
  const handleCardsDetected = (_, groupedCards) => {
    setCardsByImage(groupedCards || []);
    setShowCamera(false);
    setShowDetection(true);
  };

  // Confirm detection with team selection and calculated points
  const handleConfirmDetection = ({ team, points }) => {
    // Set points for selected team, other team gets remainder
    if (team === 'A') {
      setPointsA(points);
      setPointsB(162 - points);
    } else {
      setPointsB(points);
      setPointsA(162 - points);
    }
    setShowDetection(false);
    setCardsByImage([]);
  };

  // Submit round
  const handleSubmitRound = async () => {
    setSubmitting(true);
    setError(null);

    try {
      // Calculate final scores with bonuses
      let finalA = pointsA;
      let finalB = pointsB;

      // Belote bonus (+20 to team that has it)
      if (belote) {
        if (taker === 'A') finalA += 20;
        else finalB += 20;
      }

      // Capot bonus (winner gets all 252 points)
      if (capot) {
        if (taker === 'A') {
          finalA = 252;
          finalB = 0;
        } else {
          finalA = 0;
          finalB = 252;
        }
      }

      await addRound(id, {
        taker,
        trump,
        scores: { A: finalA, B: finalB },
        belote,
        capot,
      });

      // Reload game to get updated scores
      await loadGame();

      // Reset form
      setPointsA(0);
      setPointsB(0);
      setBelote(false);
      setCapot(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete round (undo)
  const handleDeleteRound = async (roundNum) => {
    try {
      await deleteRound(id, roundNum);
      await loadGame();
    } catch (err) {
      setError(err.message);
    }
  };

  // Delete game entirely
  const handleDeleteGame = async () => {
    setConfirmAction(null);
    try {
      await deleteGame(id);
      navigate('/home');
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-felt">
        <div className="text-ivory/60">Loading...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-felt">
        <div className="text-ivory/60">Game not found</div>
      </div>
    );
  }

  const isFinished = game.status === 'finished';
  const winner = game.teams?.a.score >= game.targetScore ? 'A' :
                 game.teams?.b.score >= game.targetScore ? 'B' : null;

  return (
    <div className="min-h-screen bg-felt pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-felt-dark/95 backdrop-blur-sm z-10 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] border-b border-ivory/10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate('/home')}
            className="text-ivory/80 hover:text-ivory hover:bg-ivory/10"
          >
            <ArrowLeft className="size-4 mr-2" />
            Games
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-ivory/40 text-sm mr-2">Target: {game.targetScore}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setConfirmAction('delete')}
              className="text-ivory/60 hover:text-ruby hover:bg-ruby/10"
              title="Delete game"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Score Header */}
      <div className="max-w-lg mx-auto p-4">
        <Card className="bg-ivory/95 border-gold/30 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              {/* Team A */}
              <div className="text-center flex-1">
                <div className="text-charcoal/60 text-sm mb-1">{game.teams?.a.name || 'Team A'}</div>
                <div className={`font-display text-4xl ${winner === 'A' ? 'text-gold' : 'text-charcoal'}`}>
                  {game.teams?.a.score || 0}
                </div>
              </div>

              {/* Divider */}
              <div className="px-4 text-charcoal/30 text-2xl">-</div>

              {/* Team B */}
              <div className="text-center flex-1">
                <div className="text-charcoal/60 text-sm mb-1">{game.teams?.b.name || 'Team B'}</div>
                <div className={`font-display text-4xl ${winner === 'B' ? 'text-gold' : 'text-charcoal'}`}>
                  {game.teams?.b.score || 0}
                </div>
              </div>
            </div>

            {/* Winner Banner */}
            {isFinished && winner && (
              <div className="mt-4 p-3 bg-gold/20 rounded-lg text-center">
                <Trophy className="size-6 text-gold mx-auto mb-1" />
                <div className="text-charcoal font-medium">
                  {winner === 'A' ? game.teams?.a.name : game.teams?.b.name} wins!
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Round Entry (only if game is active) */}
      {!isFinished && (
        <div className="max-w-lg mx-auto px-4 space-y-4">
          <Card className="bg-ivory/95 border-gold/30 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-charcoal text-lg">New Round</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Taker Selection */}
              <div>
                <label className="text-charcoal/60 text-sm block mb-2">Who takes?</label>
                <TeamToggle
                  value={taker}
                  onChange={setTaker}
                  teamA={game.teams?.a.name}
                  teamB={game.teams?.b.name}
                />
              </div>

              {/* Trump Selection */}
              <div>
                <label className="text-charcoal/60 text-sm block mb-2">Trump suit</label>
                <TrumpSelector value={trump} onChange={setTrump} />
              </div>

              {/* Points Entry - Total per round is 162 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-charcoal/60 text-sm block mb-2">
                    {game.teams?.a.name} points
                  </label>
                  <input
                    type="number"
                    value={pointsA || ''}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setPointsA(val);
                      setPointsB(162 - val);
                    }}
                    className="w-full h-12 px-4 rounded-lg border border-charcoal/20 text-center text-xl bg-white"
                  />
                </div>
                <div>
                  <label className="text-charcoal/60 text-sm block mb-2">
                    {game.teams?.b.name} points
                  </label>
                  <input
                    type="number"
                    value={pointsB || ''}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setPointsB(val);
                      setPointsA(162 - val);
                    }}
                    className="w-full h-12 px-4 rounded-lg border border-charcoal/20 text-center text-xl bg-white"
                  />
                </div>
              </div>

              {/* Camera Button - opens team selection first */}
              <Button
                variant="outline"
                onClick={() => setShowTeamSelect(true)}
                className="w-full h-12 border-charcoal/20 text-charcoal"
              >
                <Camera className="size-5 mr-2" />
                Scan Pile
              </Button>

              {/* Bonuses */}
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={belote}
                    onChange={(e) => setBelote(e.target.checked)}
                    className="size-5 rounded border-charcoal/30"
                  />
                  <span className="text-charcoal">Belote (+20)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={capot}
                    onChange={(e) => setCapot(e.target.checked)}
                    className="size-5 rounded border-charcoal/30"
                  />
                  <span className="text-charcoal">Capot (252)</span>
                </label>
              </div>

              {/* Error */}
              {error && (
                <p className="text-ruby text-sm text-center">{error}</p>
              )}

              {/* Submit Button */}
              <Button
                onClick={handleSubmitRound}
                disabled={submitting}
                className="w-full h-12 bg-ruby text-ivory hover:bg-ruby/90"
              >
                {submitting ? 'Saving...' : (
                  <>
                    <Check className="size-5 mr-2" />
                    Validate Round
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Round History */}
      <div className="max-w-lg mx-auto px-4 mt-4">
        <RoundHistory
          rounds={rounds}
          teams={game.teams}
          onDelete={!isFinished ? handleDeleteRound : undefined}
        />
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <CameraCapture
          onCapture={handleCardsDetected}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Team Selection Modal - shown before camera */}
      {showTeamSelect && (
        <div className="fixed inset-0 bg-charcoal/80 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm bg-ivory">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-charcoal">Whose pile?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => {
                  setScanTeam('A');
                  setShowTeamSelect(false);
                  setShowCamera(true);
                }}
                className="w-full h-14 bg-ruby text-ivory hover:bg-ruby/90 text-lg"
              >
                {game.teams?.a.name || 'Team A'}
              </Button>
              <Button
                onClick={() => {
                  setScanTeam('B');
                  setShowTeamSelect(false);
                  setShowCamera(true);
                }}
                className="w-full h-14 bg-ruby text-ivory hover:bg-ruby/90 text-lg"
              >
                {game.teams?.b.name || 'Team B'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowTeamSelect(false)}
                className="w-full text-charcoal/60"
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detection Review Modal */}
      {showDetection && (
        <DetectedCards
          cardsByImage={cardsByImage}
          trump={trump}
          team={scanTeam}
          teamName={scanTeam === 'A' ? game.teams?.a.name : game.teams?.b.name}
          onConfirm={handleConfirmDetection}
          onCancel={() => {
            setShowDetection(false);
            setCardsByImage([]);
            setScanTeam(null);
          }}
        />
      )}

      {/* Winner Popup - shows when game finishes */}
      {showWinnerPopup && winner && (
        <div className="fixed inset-0 bg-charcoal/90 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm bg-ivory text-center">
            <CardContent className="pt-8 pb-6 px-6">
              <div className="mb-4">
                <Trophy className="size-16 text-gold mx-auto" />
              </div>
              <h2 className="text-2xl font-display text-charcoal mb-2">
                {winner === 'A' ? game.teams?.a.name : game.teams?.b.name} wins!
              </h2>
              <p className="text-charcoal/60 mb-6">
                Final score: {game.teams?.a.score} - {game.teams?.b.score}
              </p>
              <div className="space-y-3">
                <Button
                  onClick={() => setShowWinnerPopup(false)}
                  className="w-full h-12 bg-gold text-charcoal hover:bg-gold/90"
                >
                  View Game
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigate('/home')}
                  className="w-full h-12 text-charcoal/60"
                >
                  <Home className="size-4 mr-2" />
                  Back to Games
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Game Confirmation */}
      {confirmAction === 'delete' && (
        <ConfirmModal
          title="Delete Game"
          message="Delete this game and all its rounds? This cannot be undone."
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDeleteGame}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
};

export default GamePage;
