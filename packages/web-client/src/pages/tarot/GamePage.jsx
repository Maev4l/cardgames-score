import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check, Trash2, Home, Crown, X, Camera } from 'lucide-react';
import { getGame, addRound, deleteRound, deleteGame, updateGame } from '@/lib/api';
import ConfirmModal from '@/components/ConfirmModal';
import CameraCapture from '@/components/CameraCapture';
import DetectedCardsTarot from '@/components/DetectedCardsTarot';

// Contract multipliers
const CONTRACTS = [
  { id: 'petite', label: 'Petite', multiplier: 1 },
  { id: 'garde', label: 'Garde', multiplier: 2 },
  { id: 'garde_sans', label: 'Garde Sans', multiplier: 4 },
  { id: 'garde_contre', label: 'Garde Contre', multiplier: 6 },
];

// Required points based on bouts
const REQUIRED_POINTS = { 0: 56, 1: 51, 2: 41, 3: 36 };

// Calculate score preview
const calculatePreview = (playerCount, contract, bouts, takerPoints, petitAuBout, poignee, chelem) => {
  const required = REQUIRED_POINTS[bouts];
  const diff = takerPoints - required;
  const won = diff >= 0;

  // Base: (|diff| rounded to 10) + 25
  const absDiff = Math.abs(diff);
  const rounded = Math.round(absDiff / 10) * 10;
  let base = rounded + 25;

  // Apply contract multiplier
  const multiplier = CONTRACTS.find(c => c.id === contract)?.multiplier || 1;
  base *= multiplier;

  // Bonuses
  let bonus = 0;
  if (petitAuBout) {
    const petitBonus = 10 * multiplier;
    bonus += petitAuBout === 'defense' ? -petitBonus : petitBonus;
  }
  if (poignee === 10) bonus += 20;
  if (poignee === 13) bonus += 30;
  if (poignee === 15) bonus += 40;
  if (chelem === 'announced') bonus += 400;
  if (chelem === 'achieved') bonus += 200;

  const perDefender = won ? base + bonus : -(base + bonus);
  const defenderCount = playerCount - 1; // Simplified (no partner for now)
  const takerScore = perDefender * defenderCount;

  return { won, takerScore, perDefender };
};

const TarotGamePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Game state
  const [game, setGame] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Round entry state
  const [taker, setTaker] = useState(0);
  const [partner, setPartner] = useState(null);
  const [contract, setContract] = useState('garde');
  const [bouts, setBouts] = useState(1);
  const [takerPoints, setTakerPoints] = useState(45);
  const [petitAuBout, setPetitAuBout] = useState(null);
  const [poignee, setPoignee] = useState(0);
  const [chelem, setChelem] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // UI state
  const [confirmAction, setConfirmAction] = useState(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // Camera/detection state
  const [showCamera, setShowCamera] = useState(false);
  const [showPileSelect, setShowPileSelect] = useState(false);
  const [scanningTakerPile, setScanningTakerPile] = useState(true); // true = taker's pile, false = defense
  const [showDetection, setShowDetection] = useState(false);
  const [detectedCards, setDetectedCards] = useState([]);
  const [showPreview, setShowPreview] = useState(false); // Only show after scan

  // Load game data
  const loadGame = useCallback(async () => {
    try {
      const data = await getGame(id, 'tarot');
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


  // Handle card detection result
  const handleCardsDetected = (cards) => {
    setDetectedCards(cards || []);
    setShowCamera(false);
    setShowDetection(true);
  };

  // Confirm detection - set taker points and bouts from scanned pile
  const handleConfirmDetection = ({ points, bouts: detectedBouts }) => {
    // If scanning taker's pile, use points directly and set bouts
    // If scanning defense pile, taker gets 91 - points (bouts stay as-is since they're in taker's pile)
    const takerPts = scanningTakerPile ? points : (91 - points);
    setTakerPoints(takerPts);
    // Only update bouts if scanning taker's pile
    if (scanningTakerPile && detectedBouts !== undefined) {
      setBouts(detectedBouts);
    }
    setShowDetection(false);
    setDetectedCards([]);
    setShowPreview(true); // Show score preview after scan
  };

  // Submit round
  const handleSubmitRound = async () => {
    setSubmitting(true);
    setError(null);

    try {
      await addRound(id, {
        taker,
        partner: game.playerCount === 5 ? partner : undefined,
        contract,
        bouts,
        takerPoints,
        petitAuBout: petitAuBout || undefined,
        poignee: poignee || undefined,
        chelem: chelem || undefined,
      }, 'tarot');

      await loadGame();

      // Reset form for next round
      setTakerPoints(45);
      setBouts(1);
      setPetitAuBout(null);
      setPoignee(0);
      setChelem(null);
      setShowPreview(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete round
  const handleDeleteRound = async (roundNum) => {
    try {
      await deleteRound(id, roundNum, 'tarot');
      await loadGame();
    } catch (err) {
      setError(err.message);
    }
  };

  // End game manually
  const handleEndGame = async () => {
    setShowEndConfirm(false);
    try {
      await updateGame(id, { status: 'finished' }, 'tarot');
      await loadGame();
    } catch (err) {
      setError(err.message);
    }
  };

  // Delete game
  const handleDeleteGame = async () => {
    setConfirmAction(null);
    try {
      await deleteGame(id, 'tarot');
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

  if (!game || !game.players) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-felt">
        <div className="text-ivory/60">Game not found</div>
      </div>
    );
  }

  const isFinished = game.status === 'finished';
  const preview = showPreview
    ? calculatePreview(game.playerCount, contract, bouts, takerPoints, petitAuBout, poignee, chelem)
    : null;

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
            <Crown className="size-4 text-gold" />
            <span className="text-ivory/60 text-sm">Tarot</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setConfirmAction('delete')}
              className="text-ivory/60 hover:text-ruby hover:bg-ruby/10 ml-2"
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
          <CardContent className="p-4">
            <div
              className="grid text-center"
              style={{ gridTemplateColumns: `repeat(${game.players?.length || 1}, minmax(0, 1fr))` }}
            >
              {game.players?.map((player, i) => {
                // Find leader
                const maxScore = Math.max(...(game.players?.map(p => p.score) || [0]));
                const isLeader = player.score === maxScore && maxScore !== 0;
                return (
                  <div key={i} className="px-1">
                    <div className={`text-xs truncate mb-1 ${isLeader ? 'text-gold font-medium' : 'text-charcoal/60'}`}>
                      {player.name}
                    </div>
                    <div className={`font-display text-2xl ${isLeader ? 'text-gold' : 'text-charcoal'}`}>
                      {player.score}
                    </div>
                  </div>
                );
              })}
            </div>
            {isFinished && (
              <div className="mt-3 p-2 bg-gold/20 rounded-lg text-center">
                <Crown className="size-5 text-gold mx-auto" />
                <span className="text-charcoal text-sm">Game finished</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Round Entry */}
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
                <div className="flex flex-wrap gap-2">
                  {game.players?.map((player, i) => (
                    <Button
                      key={i}
                      variant={taker === i ? 'default' : 'outline'}
                      onClick={() => setTaker(i)}
                      className={taker === i
                        ? 'flex-1 min-w-[80px] bg-ruby text-ivory hover:bg-ruby/90'
                        : 'flex-1 min-w-[80px] border-charcoal/20 text-charcoal'
                      }
                    >
                      {player.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* 5-player: Partner selection (taker can call himself = plays alone) */}
              {game.playerCount === 5 && (
                <div>
                  <label className="text-charcoal/60 text-sm block mb-2">Partner</label>
                  <div className="flex flex-wrap gap-2">
                    {game.players?.map((player, i) => (
                      <Button
                        key={i}
                        variant={partner === i ? 'default' : 'outline'}
                        onClick={() => setPartner(i)}
                        className={partner === i
                          ? 'flex-1 min-w-[80px] bg-gold text-charcoal hover:bg-gold/90'
                          : 'flex-1 min-w-[80px] border-charcoal/20 text-charcoal'
                        }
                      >
                        {i === taker ? `${player.name} (seul)` : player.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Contract Selection */}
              <div>
                <label className="text-charcoal/60 text-sm block mb-2">Contract</label>
                <div className="grid grid-cols-2 gap-2">
                  {CONTRACTS.map((c) => (
                    <Button
                      key={c.id}
                      variant={contract === c.id ? 'default' : 'outline'}
                      onClick={() => setContract(c.id)}
                      className={contract === c.id
                        ? 'bg-gold text-charcoal hover:bg-gold/90'
                        : 'border-charcoal/20 text-charcoal'
                      }
                    >
                      {c.label} (x{c.multiplier})
                    </Button>
                  ))}
                </div>
              </div>

              {/* Bouts Selection */}
              <div>
                <label className="text-charcoal/60 text-sm block mb-2">
                  Bouts (Oudlers) - Required: {REQUIRED_POINTS[bouts]} pts
                </label>
                <div className="flex gap-2">
                  {[0, 1, 2, 3].map((b) => (
                    <Button
                      key={b}
                      variant={bouts === b ? 'default' : 'outline'}
                      onClick={() => setBouts(b)}
                      className={bouts === b
                        ? 'flex-1 bg-ruby text-ivory hover:bg-ruby/90'
                        : 'flex-1 border-charcoal/20 text-charcoal'
                      }
                    >
                      {b}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Taker Points */}
              <div>
                <label className="text-charcoal/60 text-sm block mb-2">
                  Taker's Points (0-91)
                </label>
                <input
                  type="range"
                  min="0"
                  max="91"
                  value={takerPoints}
                  onChange={(e) => setTakerPoints(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal/40">0</span>
                  <span className="text-charcoal font-bold text-lg">{takerPoints}</span>
                  <span className="text-charcoal/40">91</span>
                </div>
                {/* Camera Button */}
                <Button
                  variant="outline"
                  onClick={() => setShowPileSelect(true)}
                  className="w-full h-10 mt-2 border-charcoal/20 text-charcoal"
                >
                  <Camera className="size-4 mr-2" />
                  Scan Pile
                </Button>
              </div>

              {/* Bonuses */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-charcoal/60 text-xs block mb-1">Petit au bout</label>
                  <select
                    value={petitAuBout || ''}
                    onChange={(e) => setPetitAuBout(e.target.value || null)}
                    className="w-full h-10 px-2 rounded border border-charcoal/20 bg-white text-sm"
                  >
                    <option value="">None</option>
                    <option value="taker">Taker</option>
                    <option value="defense">Defense</option>
                  </select>
                </div>
                <div>
                  <label className="text-charcoal/60 text-xs block mb-1">Poignee</label>
                  <select
                    value={poignee}
                    onChange={(e) => setPoignee(parseInt(e.target.value))}
                    className="w-full h-10 px-2 rounded border border-charcoal/20 bg-white text-sm"
                  >
                    <option value="0">None</option>
                    <option value="10">10 (+20)</option>
                    <option value="13">13 (+30)</option>
                    <option value="15">15 (+40)</option>
                  </select>
                </div>
                <div>
                  <label className="text-charcoal/60 text-xs block mb-1">Chelem</label>
                  <select
                    value={chelem || ''}
                    onChange={(e) => setChelem(e.target.value || null)}
                    className="w-full h-10 px-2 rounded border border-charcoal/20 bg-white text-sm"
                  >
                    <option value="">None</option>
                    <option value="announced">Announced (+400)</option>
                    <option value="achieved">Achieved (+200)</option>
                  </select>
                </div>
              </div>

              {/* Score Preview - only shown after scan */}
              {showPreview && preview && (
                <div className={`p-3 rounded-lg text-center ${preview.won ? 'bg-green-100' : 'bg-red-100'}`}>
                  <div className="text-sm text-charcoal/60">
                    {preview.won ? 'Taker wins' : 'Taker loses'}
                  </div>
                  <div className="text-xl font-bold text-charcoal">
                    Taker: {preview.takerScore > 0 ? '+' : ''}{preview.takerScore}
                  </div>
                  <div className="text-sm text-charcoal/60">
                    Each defender: {preview.perDefender > 0 ? '+' : ''}{-preview.perDefender}
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <p className="text-ruby text-sm text-center">{error}</p>
              )}

              {/* Submit Button */}
              <Button
                onClick={handleSubmitRound}
                disabled={submitting || (game.playerCount === 5 && partner === null)}
                className="w-full h-12 bg-ruby text-ivory hover:bg-ruby/90 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : (
                  <>
                    <Check className="size-5 mr-2" />
                    {game.playerCount === 5 && partner === null ? 'Select Partner' : 'Validate Round'}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* End Game Button */}
          <Button
            variant="outline"
            onClick={() => setShowEndConfirm(true)}
            className="w-full border-charcoal/20 text-charcoal"
          >
            End Game
          </Button>
        </div>
      )}

      {/* Round History */}
      {rounds.length > 0 && (
        <div className="max-w-lg mx-auto px-4 mt-4">
          <Card className="bg-ivory/95 border-gold/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-charcoal text-sm">Round History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {rounds.map((round) => {
                const takerName = game.players?.[round.taker]?.name || '?';
                const partnerName = round.partner !== null && round.partner !== undefined
                  ? game.players?.[round.partner]?.name || '?'
                  : null;
                const contractLabel = round.contract?.replace('_', ' ') || '';
                // Point difference from required
                const required = REQUIRED_POINTS[round.bouts] || 56;
                const diff = round.takerPoints - required;
                return (
                  <div
                    key={round.roundNum}
                    className="flex items-center justify-between p-2 bg-charcoal/5 rounded"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-charcoal/40 text-xs">R{round.roundNum}</span>
                        <span className="text-charcoal text-sm font-medium truncate">
                          {takerName}{partnerName ? ` + ${partnerName}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-charcoal/60 text-xs capitalize">{contractLabel}</span>
                        <span className={`text-xs font-medium ${round.won ? 'text-green-600' : 'text-ruby'}`}>
                          {round.won ? '+' : ''}{diff} pts
                        </span>
                      </div>
                    </div>
                    {!isFinished && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDeleteRound(round.roundNum)}
                        className="text-charcoal/40 hover:text-ruby"
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Back to Home (finished games) */}
      {isFinished && (
        <div className="max-w-lg mx-auto px-4 mt-4">
          <Button
            onClick={() => navigate('/home')}
            className="w-full h-12 bg-gold text-charcoal hover:bg-gold/90"
          >
            <Home className="size-4 mr-2" />
            Back to Games
          </Button>
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

      {/* End Game Confirmation */}
      {showEndConfirm && (
        <ConfirmModal
          title="End Game"
          message="End this game? You won't be able to add more rounds."
          confirmLabel="End Game"
          variant="warning"
          onConfirm={handleEndGame}
          onCancel={() => setShowEndConfirm(false)}
        />
      )}

      {/* Pile Selection Modal */}
      {showPileSelect && (
        <div className="fixed inset-0 bg-charcoal/80 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm bg-ivory">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-charcoal">Whose pile?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => {
                  setScanningTakerPile(true);
                  setShowPileSelect(false);
                  setShowCamera(true);
                }}
                className="w-full h-14 bg-ruby text-ivory hover:bg-ruby/90 text-lg"
              >
                Taker ({game.players?.[taker]?.name})
              </Button>
              <Button
                onClick={() => {
                  setScanningTakerPile(false);
                  setShowPileSelect(false);
                  setShowCamera(true);
                }}
                variant="outline"
                className="w-full h-14 border-charcoal/20 text-charcoal text-lg"
              >
                Defense
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowPileSelect(false)}
                className="w-full text-charcoal/60"
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Camera Modal */}
      {showCamera && (
        <CameraCapture
          onCapture={handleCardsDetected}
          onClose={() => setShowCamera(false)}
          gameType="tarot"
        />
      )}

      {/* Detection Review Modal */}
      {showDetection && (
        <DetectedCardsTarot
          cards={detectedCards}
          pileName={scanningTakerPile ? `${game.players?.[taker]?.name}'s pile` : 'Defense pile'}
          onConfirm={handleConfirmDetection}
          onCancel={() => {
            setShowDetection(false);
            setDetectedCards([]);
          }}
          onRetake={() => {
            setShowDetection(false);
            setDetectedCards([]);
            setShowCamera(true);
          }}
        />
      )}
    </div>
  );
};

export default TarotGamePage;
