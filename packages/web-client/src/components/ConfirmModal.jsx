import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const ConfirmModal = ({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'danger', onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-charcoal/80 z-50 flex items-center justify-center p-4">
      <Card className="bg-ivory/95 border-gold/30 shadow-2xl max-w-sm w-full">
        <CardContent className="p-6 space-y-4">
          <h3 className="font-display text-xl text-charcoal text-center">
            {title}
          </h3>
          <p className="text-charcoal/70 text-center">
            {message}
          </p>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1 border-charcoal/20 text-charcoal"
            >
              {cancelLabel}
            </Button>
            <Button
              onClick={onConfirm}
              className={`flex-1 ${
                variant === 'danger'
                  ? 'bg-ruby text-ivory hover:bg-ruby/90'
                  : 'bg-gold text-charcoal hover:bg-gold/90'
              }`}
            >
              {confirmLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfirmModal;
