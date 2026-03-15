import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, LogOut, RefreshCw } from 'lucide-react';
import { signOut } from '@/lib/auth';
import { listGames, deleteGame } from '@/lib/api';
import GameCard from '@/components/GameCard';
import ConfirmModal from '@/components/ConfirmModal';

const HomePage = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gameToDelete, setGameToDelete] = useState(null);

  // Load games on mount
  const loadGames = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listGames();
      setGames(data.games || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGames();
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleGameClick = (game) => {
    navigate(`/belote/game/${game.id}`);
  };

  const handleDeleteGame = async () => {
    if (!gameToDelete) return;
    try {
      await deleteGame(gameToDelete.id, gameToDelete.type);
      setGames(games.filter(g => g.id !== gameToDelete.id));
      setGameToDelete(null);
    } catch (err) {
      setError(err.message);
      setGameToDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-felt pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-felt-dark/95 backdrop-blur-sm z-10 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] border-b border-ivory/10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <h1 className="font-display text-2xl text-ivory">Atout</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={loadGames}
              disabled={loading}
              className="text-ivory/60 hover:text-ivory hover:bg-ivory/10"
            >
              <RefreshCw className={`size-5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="text-ivory/60 hover:text-ivory hover:bg-ivory/10"
            >
              <LogOut className="size-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto p-4 space-y-4">
        {error && (
          <div className="p-4 bg-ruby/20 text-ruby rounded-lg text-center">
            {error}
          </div>
        )}

        {loading && games.length === 0 ? (
          <div className="text-ivory/40 text-center py-12">
            Loading games...
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-ivory/60 mb-4">No games yet</p>
            <p className="text-ivory/40 text-sm">
              Tap the + button to start a new game
            </p>
          </div>
        ) : (
          <>
            {/* Active Games */}
            {games.filter(g => g.status === 'active').length > 0 && (
              <div>
                <h2 className="text-ivory/60 text-sm uppercase tracking-wide mb-3">
                  Active Games
                </h2>
                <div className="space-y-3">
                  {games
                    .filter(g => g.status === 'active')
                    .map((game) => (
                      <GameCard
                        key={game.id}
                        game={game}
                        onClick={() => handleGameClick(game)}
                        onDelete={setGameToDelete}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Finished Games */}
            {games.filter(g => g.status === 'finished').length > 0 && (
              <div>
                <h2 className="text-ivory/60 text-sm uppercase tracking-wide mb-3 mt-6">
                  Finished Games
                </h2>
                <div className="space-y-3">
                  {games
                    .filter(g => g.status === 'finished')
                    .map((game) => (
                      <GameCard
                        key={game.id}
                        game={game}
                        onClick={() => handleGameClick(game)}
                        onDelete={setGameToDelete}
                      />
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-6 right-6">
        <Button
          onClick={() => navigate('/new-game')}
          className="size-14 rounded-full bg-gold text-charcoal hover:bg-gold/90 shadow-xl"
        >
          <Plus className="size-7" />
        </Button>
      </div>

      {/* Delete Confirmation */}
      {gameToDelete && (
        <ConfirmModal
          title="Delete Game"
          message={`Delete "${gameToDelete.teams?.a.name} vs ${gameToDelete.teams?.b.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDeleteGame}
          onCancel={() => setGameToDelete(null)}
        />
      )}
    </div>
  );
};

export default HomePage;
