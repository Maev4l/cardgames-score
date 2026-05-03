// Tarot card detection review component
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X, Plus, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

const suitSymbols = {
  Hearts: '♥',
  Diamonds: '♦',
  Clubs: '♣',
  Spades: '♠',
  Trump: '★',
};

const suitColors = {
  Hearts: 'text-ruby',
  Diamonds: 'text-ruby',
  Clubs: 'text-charcoal',
  Spades: 'text-charcoal',
  Trump: 'text-gold',
};

// Tarot: 78 cards
// Standard suits (14 each): 1-10, Valet, Cavalier, Dame, Roi
// Trumps (22): 1-21 + Excuse
const suitRanks = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Valet', 'Cavalier', 'Dame', 'Roi'];
const trumpRanks = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', 'Excuse'];
const allSuits = ['Hearts', 'Diamonds', 'Clubs', 'Spades', 'Trump'];

// Rank abbreviations (French + English names from detection)
const rankAbbrev = {
  'Valet': 'V', 'Cavalier': 'C', 'Dame': 'D', 'Roi': 'R', 'Excuse': 'Ex',
  'Jack': 'V', 'Knight': 'C', 'Queen': 'D', 'King': 'R',
};

// Tarot point values (counted in pairs, shown as halves)
// Bouts (1, 21, Excuse): 4.5 pts
// Roi: 4.5, Dame: 3.5, Cavalier: 2.5, Valet: 1.5
// All others: 0.5
const getCardPoints = (card) => {
  const { rank, suit } = card;
  // Bouts (oudlers)
  if (suit === 'Trump' && (rank === '1' || rank === '21' || rank === 'Excuse')) {
    return 4.5;
  }
  // Court cards
  if (rank === 'Roi') return 4.5;
  if (rank === 'Dame') return 3.5;
  if (rank === 'Cavalier') return 2.5;
  if (rank === 'Valet') return 1.5;
  // All others (including trumps 2-20 and suit cards 1-10)
  return 0.5;
};

// Check if card is a bout (oudler)
const isBout = (card) => {
  return card.suit === 'Trump' && (card.rank === '1' || card.rank === '21' || card.rank === 'Excuse');
};

const calculatePoints = (cards) => {
  const total = cards.reduce((sum, card) => sum + getCardPoints(card), 0);
  return Math.round(total); // Round to integer
};

const countBouts = (cards) => {
  return cards.filter(isBout).length;
};

const DetectedCardsTarot = ({ cards = [], pileName, onConfirm, onCancel, onRetake }) => {
  const [detectedCards, setDetectedCards] = useState(cards);
  const [manualCards, setManualCards] = useState([]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [addSuit, setAddSuit] = useState('Trump');
  const [addRank, setAddRank] = useState('1');

  const allCards = useMemo(() => [...detectedCards, ...manualCards], [detectedCards, manualCards]);
  const points = useMemo(() => calculatePoints(allCards), [allCards]);
  const bouts = useMemo(() => countBouts(allCards), [allCards]);

  // Get available ranks based on selected suit
  const availableRanks = addSuit === 'Trump' ? trumpRanks : suitRanks;

  const handleRemoveCard = (cardIndex) => {
    setDetectedCards(prev => prev.filter((_, i) => i !== cardIndex));
  };

  const handleRemoveManualCard = (cardIndex) => {
    setManualCards(prev => prev.filter((_, i) => i !== cardIndex));
  };

  const handleAddCard = () => {
    setManualCards(prev => [...prev, { rank: addRank, suit: addSuit }]);
    setShowAddCard(false);
  };

  // Reset rank when suit changes
  const handleSuitChange = (suit) => {
    setAddSuit(suit);
    setAddRank(suit === 'Trump' ? '1' : '1');
  };

  return (
    <div className="fixed inset-0 bg-charcoal/90 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] bg-charcoal">
        <h2 className="text-ivory font-medium">Review Detected Cards</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="text-ivory/80 hover:text-ivory hover:bg-ivory/10"
        >
          <X className="size-6" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <Card className="bg-ivory/95 border-gold/30 shadow-xl max-w-lg mx-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-charcoal text-lg">{allCards.length} cards</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Points Display */}
            <div className="p-4 bg-gold/20 rounded-lg text-center">
              <div className="text-charcoal/60 text-sm">{pileName}</div>
              <div className="text-3xl font-bold text-charcoal">{points} pts</div>
              <div className="text-charcoal/60 text-sm">
                {bouts} bout{bouts !== 1 ? 's' : ''} • Defense: {91 - points} pts
              </div>
            </div>

            {/* Detected Cards */}
            {detectedCards.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {detectedCards.map((card, cardIndex) => {
                  const pts = getCardPoints(card);
                  const conf = card.confidence || 100;
                  const isLowConf = conf < 70;
                  const bout = isBout(card);
                  return (
                    <button
                      key={`${card.image}-${card.order}-${cardIndex}`}
                      onClick={() => handleRemoveCard(cardIndex)}
                      className={cn(
                        "relative flex flex-col items-center px-3 py-2 rounded-lg active:bg-ruby/20 transition-colors",
                        bout ? "bg-gold/30 border border-gold" : isLowConf ? "bg-gold/20 border border-gold/40" : "bg-charcoal/5"
                      )}
                    >
                      <div className="flex items-center gap-0.5">
                        <span className={cn('text-xl font-bold', suitColors[card.suit])}>
                          {rankAbbrev[card.rank] || card.rank}
                        </span>
                        <span className={cn('text-xl', suitColors[card.suit])}>
                          {suitSymbols[card.suit]}
                        </span>
                      </div>
                      <span className="text-xs text-charcoal/50">{pts}pts</span>
                      <span className={cn("text-[10px]", isLowConf ? "text-gold" : "text-charcoal/40")}>{conf}%</span>
                      <X className="absolute top-1 right-1 size-3 text-charcoal/30" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Manually added cards */}
            {manualCards.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-px bg-charcoal/10" />
                  <span className="text-charcoal/30 text-xs">Added manually</span>
                  <div className="flex-1 h-px bg-charcoal/10" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {manualCards.map((card, cardIndex) => {
                    const pts = getCardPoints(card);
                    const bout = isBout(card);
                    return (
                      <button
                        key={cardIndex}
                        onClick={() => handleRemoveManualCard(cardIndex)}
                        className={cn(
                          "relative flex flex-col items-center px-3 py-2 rounded-lg active:bg-ruby/20 transition-colors",
                          bout ? "bg-gold/30 border border-gold" : "bg-charcoal/5"
                        )}
                      >
                        <div className="flex items-center gap-0.5">
                          <span className={cn('text-xl font-bold', suitColors[card.suit])}>
                            {rankAbbrev[card.rank] || card.rank}
                          </span>
                          <span className={cn('text-xl', suitColors[card.suit])}>
                            {suitSymbols[card.suit]}
                          </span>
                        </div>
                        <span className="text-xs text-charcoal/50">{pts}pts</span>
                        <X className="absolute top-1 right-1 size-3 text-charcoal/30" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add Card Section */}
            {showAddCard ? (
              <div className="p-4 border border-charcoal/20 rounded-lg space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-charcoal/60 text-sm block mb-1">Suit</label>
                    <select
                      value={addSuit}
                      onChange={(e) => handleSuitChange(e.target.value)}
                      className="w-full h-10 px-3 rounded border border-charcoal/20 bg-white"
                    >
                      {allSuits.map((suit) => (
                        <option key={suit} value={suit}>{suitSymbols[suit]} {suit}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-charcoal/60 text-sm block mb-1">Rank</label>
                    <select
                      value={addRank}
                      onChange={(e) => setAddRank(e.target.value)}
                      className="w-full h-10 px-3 rounded border border-charcoal/20 bg-white"
                    >
                      {availableRanks.map((rank) => (
                        <option key={rank} value={rank}>{rankAbbrev[rank] || rank}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowAddCard(false)} className="flex-1 border-charcoal/20 text-charcoal">
                    Cancel
                  </Button>
                  <Button onClick={handleAddCard} className="flex-1 bg-gold text-charcoal hover:bg-gold/90">
                    Add
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowAddCard(true)}
                className="w-full border-dashed border-charcoal/30 text-charcoal/60"
              >
                <Plus className="size-4 mr-2" />
                Add Missing Card
              </Button>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              {onRetake && (
                <Button variant="outline" onClick={onRetake} className="flex-1 h-12 border-charcoal/20 text-charcoal">
                  <RotateCcw className="size-5 mr-2" />
                  Retake
                </Button>
              )}
              <Button
                onClick={() => onConfirm({ points, bouts, cards: allCards })}
                className="flex-1 h-12 bg-gold text-charcoal hover:bg-gold/90"
              >
                <Check className="size-5 mr-2" />
                Confirm {points} pts
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DetectedCardsTarot;
