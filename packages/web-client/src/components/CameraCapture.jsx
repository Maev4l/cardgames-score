// Camera capture using react-webcam for reliable lifecycle management
// Supports capturing multiple photos before submitting for detection
import { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Button } from '@/components/ui/button';
import { X, Camera, Loader2, SwitchCamera, VideoOff, Send } from 'lucide-react';
import { detectCards } from '@/lib/api';

const CameraCapture = ({ onCapture, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [capturedImages, setCapturedImages] = useState([]);
  const webcamRef = useRef(null);

  const videoConstraints = {
    facingMode,
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  };

  const handleUserMedia = useCallback(() => {
    setCameraReady(true);
    setCameraError(null);
  }, []);

  const handleUserMediaError = useCallback((err) => {
    console.error('Camera error:', err);
    if (err.name === 'NotAllowedError') {
      setCameraError('Camera permission denied');
    } else {
      setCameraError(err.message || 'Failed to start camera');
    }
  }, []);

  const handleSwitchCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    setCameraReady(false);
  };

  // Capture full frame photo
  const handleCapture = useCallback(() => {
    if (!webcamRef.current || loading) return;

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      setError('Failed to capture image');
      return;
    }

    const base64 = imageSrc.split(',')[1];
    setCapturedImages(prev => [...prev, { image: base64, mediaType: 'image/jpeg', preview: imageSrc }]);
    setError(null);
  }, [loading]);

  const handleRemoveImage = (index) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = useCallback(async () => {
    if (capturedImages.length === 0 || loading) return;

    setLoading(true);
    setError(null);

    try {
      const images = capturedImages.map(({ image, mediaType }) => ({ image, mediaType }));
      const result = await detectCards(images);
      // Pass both flat cards and grouped cardsByImage
      onCapture(result.cards || [], result.cardsByImage || []);
    } catch (err) {
      setError(err.message || 'Failed to detect cards');
      setLoading(false);
    }
  }, [capturedImages, loading, onCapture]);

  return (
    <div className="fixed inset-0 bg-charcoal z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] bg-charcoal/95">
        <h2 className="text-ivory font-medium">
          Capture Cards {capturedImages.length > 0 && `(${capturedImages.length})`}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSwitchCamera}
            className="text-ivory/80 hover:text-ivory hover:bg-ivory/10"
            title="Switch camera"
          >
            <SwitchCamera className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-ivory/80 hover:text-ivory hover:bg-ivory/10"
          >
            <X className="size-6" />
          </Button>
        </div>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative bg-black">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Loader2 className="size-12 text-gold animate-spin mb-4" />
            <p className="text-ivory/60">Analyzing {capturedImages.length} image{capturedImages.length !== 1 && 's'}...</p>
          </div>
        ) : cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8">
            <VideoOff className="size-16 text-ivory/30" />
            <p className="text-ivory/60 text-center">{cameraError}</p>
            {cameraError === 'Camera permission denied' && (
              <p className="text-ivory/40 text-sm text-center">
                Please enable camera permissions in your browser settings
              </p>
            )}
          </div>
        ) : (
          <>
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              screenshotQuality={0.9}
              videoConstraints={videoConstraints}
              onUserMedia={handleUserMedia}
              onUserMediaError={handleUserMediaError}
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Guide overlay - centered in camera view */}
            {cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[90%] aspect-[4/3] max-h-[80%] border-2 border-dashed border-gold/80 rounded-lg flex items-center justify-center">
                  <span className="text-gold/60 text-sm">Place cards here</span>
                </div>
              </div>
            )}

            {/* Loading camera indicator */}
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <p className="text-ivory/60">Starting camera...</p>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="absolute inset-x-0 top-4 flex justify-center z-10">
                <p className="bg-ruby/90 text-ivory px-4 py-2 rounded-lg">{error}</p>
              </div>
            )}

            {/* Captured images thumbnails */}
            {capturedImages.length > 0 && (
              <div className="absolute left-4 top-4 bottom-4 w-20 flex flex-col gap-2 overflow-y-auto">
                {capturedImages.map((img, index) => (
                  <div key={index} className="relative">
                    <img
                      src={img.preview}
                      alt={`Capture ${index + 1}`}
                      className="w-full aspect-[4/3] object-cover rounded border-2 border-ivory/50"
                    />
                    <button
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-1 right-1 size-5 bg-ruby/90 rounded-full flex items-center justify-center shadow active:scale-90 transition-transform"
                    >
                      <X className="size-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Capture hint */}
            <div className="absolute inset-x-0 bottom-24 text-center">
              <p className="text-ivory/60 text-sm">
                {capturedImages.length === 0
                  ? 'Center cards in frame and capture'
                  : 'Take more photos or submit'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Action Buttons */}
      {!loading && !cameraError && (
        <div className="p-6 bg-charcoal/95 flex justify-center gap-4">
          <Button
            onClick={handleCapture}
            disabled={!cameraReady}
            className="size-16 rounded-full bg-ivory hover:bg-ivory/90 p-0 disabled:opacity-50"
            title="Take photo"
          >
            <Camera className="size-8 text-charcoal" />
          </Button>

          {capturedImages.length > 0 && (
            <Button
              onClick={handleSubmit}
              className="size-16 rounded-full bg-gold hover:bg-gold/90 p-0"
              title="Analyze cards"
            >
              <Send className="size-7 text-charcoal" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default CameraCapture;
