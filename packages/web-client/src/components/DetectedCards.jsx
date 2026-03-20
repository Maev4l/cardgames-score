import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const suitSymbols = {
  Hearts: '♥',
  Diamonds: '♦',
  Clubs: '♣',
  Spades: '♠',
};

const suitColors = {
  Hearts: 'text-ruby',
  Diamonds: 'text-ruby',
  Clubs: 'text-charcoal',
  Spades: 'text-charcoal',
};

// Rank abbreviations for compact display
const rankAbbrev = {
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  'Jack': 'J',
  'Queen': 'Q',
  'King': 'K',
  'Ace': 'A',
};

// All possible cards in Belote
const allRanks = ['7', '8', '9', '10', 'Jack', 'Queen', 'King', 'Ace'];
const allSuits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];

// Card point values
const cardPoints = {
  '7': { normal: 0, trump: 0 },
  '8': { normal: 0, trump: 0 },
  '9': { normal: 0, trump: 14 },
  '10': { normal: 10, trump: 10 },
  'Jack': { normal: 2, trump: 20 },
  'Queen': { normal: 3, trump: 3 },
  'King': { normal: 4, trump: 4 },
  'Ace': { normal: 11, trump: 11 },
};

// Get points for a single card
const getCardPoints = (card, trump) => {
  const isTrump = card.suit?.toLowerCase() === trump?.toLowerCase();
  const points = cardPoints[card.rank];
  if (!points) return 0; // Unknown rank = 0 points (safety fallback)
  return isTrump ? points.trump : points.normal;
};

// Calculate points for a set of cards given trump suit
const calculatePoints = (cards, trump) => {
  return cards.reduce((total, card) => total + getCardPoints(card, trump), 0);
};

const DetectedCards = ({ cardsByImage = [], trump, team, teamName, onConfirm, onCancel }) => {
  const [groupedCards, setGroupedCards] = useState(cardsByImage);
  const [manualCards, setManualCards] = useState([]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [addRank, setAddRank] = useState('Ace');
  const [addSuit, setAddSuit] = useState('Hearts');

  // All cards = detected + manual
  const allCards = useMemo(() => {
    const detected = groupedCards.flat();
    return [...detected, ...manualCards];
  }, [groupedCards, manualCards]);

  // Calculate points for current cards
  const points = useMemo(() => calculatePoints(allCards, trump), [allCards, trump]);

  // Remove a detected card
  const handleRemoveCard = (imageIndex, cardIndex) => {
    setGroupedCards(prev => prev.map((group, i) =>
      i === imageIndex ? group.filter((_, j) => j !== cardIndex) : group
    ));
  };

  // Remove a manually added card
  const handleRemoveManualCard = (cardIndex) => {
    setManualCards(prev => prev.filter((_, i) => i !== cardIndex));
  };

  // Add a card to manual list
  const handleAddCard = () => {
    setManualCards(prev => [...prev, { rank: addRank, suit: addSuit }]);
    setShowAddCard(false);
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
            <CardTitle className="text-charcoal text-lg">
              {allCards.length} cards
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Points Display */}
            <div className="p-4 bg-gold/20 rounded-lg text-center">
              <div className="text-charcoal/60 text-sm">{teamName || `Team ${team}`}'s pile</div>
              <div className="text-3xl font-bold text-charcoal">{points} pts</div>
              <div className="text-charcoal/40 text-sm">
                Other team: {162 - points} pts
              </div>
            </div>

            {/* Card List - grouped by image */}
            <div className="space-y-3">
              {groupedCards.map((imageCards, imageIndex) => (
                <div key={imageIndex}>
                  {/* Image label - only show if multiple images */}
                  {groupedCards.length > 1 && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 h-px bg-charcoal/10" />
                      <span className="text-charcoal/30 text-xs">Photo {imageIndex + 1}</span>
                      <div className="flex-1 h-px bg-charcoal/10" />
                    </div>
                  )}
                  {/* Cards in this image */}
                  <div className="flex flex-wrap gap-2">
                    {imageCards.map((card, cardIndex) => {
                      const pts = getCardPoints(card, trump);
                      const conf = card.confidence || 100;
                      const isLowConf = conf < 70;
                      return (
                        <button
                          key={card.order || cardIndex}
                          onClick={() => handleRemoveCard(imageIndex, cardIndex)}
                          className={cn(
                            "relative flex flex-col items-center px-3 py-2 rounded-lg active:bg-ruby/20 transition-colors",
                            isLowConf ? "bg-gold/20 border border-gold/40" : "bg-charcoal/5"
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
                </div>
              ))}
            </div>

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
                    const pts = getCardPoints(card, trump);
                    return (
                      <button
                        key={cardIndex}
                        onClick={() => handleRemoveManualCard(cardIndex)}
                        className="relative flex flex-col items-center px-3 py-2 bg-charcoal/5 rounded-lg active:bg-ruby/20 transition-colors"
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
                    <label className="text-charcoal/60 text-sm block mb-1">Rank</label>
                    <select
                      value={addRank}
                      onChange={(e) => setAddRank(e.target.value)}
                      className="w-full h-10 px-3 rounded border border-charcoal/20 bg-white"
                    >
                      {allRanks.map((rank) => (
                        <option key={rank} value={rank}>{rank}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-charcoal/60 text-sm block mb-1">Suit</label>
                    <select
                      value={addSuit}
                      onChange={(e) => setAddSuit(e.target.value)}
                      className="w-full h-10 px-3 rounded border border-charcoal/20 bg-white"
                    >
                      {allSuits.map((suit) => (
                        <option key={suit} value={suit}>{suitSymbols[suit]} {suit}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowAddCard(false)}
                    className="flex-1 border-charcoal/20 text-charcoal"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddCard}
                    className="flex-1 bg-gold text-charcoal hover:bg-gold/90"
                  >
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

            {/* Confirm Button */}
            <Button
              onClick={() => onConfirm({ team, points, cards: allCards })}
              className="w-full h-12 bg-gold text-charcoal hover:bg-gold/90"
            >
              <Check className="size-5 mr-2" />
              Confirm {points} pts for {teamName || `Team ${team}`}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DetectedCards;
