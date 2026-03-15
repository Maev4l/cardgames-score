import { cn } from '@/lib/utils';

const TeamToggle = ({ value, onChange, teamA = 'Team A', teamB = 'Team B' }) => {
  return (
    <div className="flex rounded-lg border border-charcoal/20 overflow-hidden">
      <button
        type="button"
        onClick={() => onChange('A')}
        className={cn(
          'flex-1 h-12 text-center font-medium transition-colors',
          value === 'A'
            ? 'bg-ruby text-ivory'
            : 'bg-white text-charcoal hover:bg-charcoal/5'
        )}
      >
        {teamA}
      </button>
      <button
        type="button"
        onClick={() => onChange('B')}
        className={cn(
          'flex-1 h-12 text-center font-medium transition-colors',
          value === 'B'
            ? 'bg-ruby text-ivory'
            : 'bg-white text-charcoal hover:bg-charcoal/5'
        )}
      >
        {teamB}
      </button>
    </div>
  );
};

export default TeamToggle;
