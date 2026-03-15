import { cn } from '@/lib/utils';

const suits = [
  { id: 'hearts', symbol: '♥', color: 'text-ruby' },
  { id: 'diamonds', symbol: '♦', color: 'text-ruby' },
  { id: 'clubs', symbol: '♣', color: 'text-charcoal' },
  { id: 'spades', symbol: '♠', color: 'text-charcoal' },
];

const TrumpSelector = ({ value, onChange }) => {
  return (
    <div className="grid grid-cols-4 gap-2">
      {suits.map((suit) => (
        <button
          key={suit.id}
          type="button"
          onClick={() => onChange(suit.id)}
          className={cn(
            'h-14 rounded-lg border-2 text-3xl transition-all',
            value === suit.id
              ? 'border-gold bg-gold/10 scale-105'
              : 'border-charcoal/20 bg-white hover:border-charcoal/40',
            suit.color
          )}
        >
          {suit.symbol}
        </button>
      ))}
    </div>
  );
};

export default TrumpSelector;
