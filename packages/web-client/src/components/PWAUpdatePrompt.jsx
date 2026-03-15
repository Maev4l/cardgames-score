import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';

// Check for updates every hour and on focus
const UPDATE_INTERVAL = 60 * 60 * 1000;

const PWAUpdatePrompt = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;

      // Periodic check
      setInterval(() => {
        registration.update();
      }, UPDATE_INTERVAL);

      // Check on focus (user returns to app)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update();
        }
      });
    },
  });

  const handleUpdate = () => {
    updateServiceWorker(true);
  };

  const handleClose = () => {
    setNeedRefresh(false);
  };

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-ivory border border-gold/30 rounded-lg shadow-xl p-4 z-50 animate-in slide-in-from-bottom-4">
      <p className="text-charcoal font-medium mb-1">Update available</p>
      <p className="text-charcoal/60 text-sm mb-3">
        A new version is ready. Refresh to update.
      </p>
      <div className="flex gap-2">
        <Button
          onClick={handleUpdate}
          className="flex-1 h-9 bg-felt hover:bg-felt-dark text-ivory text-sm"
        >
          Update now
        </Button>
        <Button
          variant="outline"
          onClick={handleClose}
          className="h-9 border-charcoal/20 text-charcoal text-sm"
        >
          Later
        </Button>
      </div>
    </div>
  );
};

export default PWAUpdatePrompt;
