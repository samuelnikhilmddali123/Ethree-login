import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { Camera, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

const FaceCapture = ({ onCapture, targetDescriptor = null, onVerify = null, onMismatch = null, label = "Capture Face" }) => {
    const videoRef = useRef();
    const canvasRef = useRef();
    const overlayRef = useRef();
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [stream, setStream] = useState(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState('Initializing...');
    const scanStartTime = useRef(null);
    const syncRef = useRef({
        lastMismatchDescriptor: null,
        lastMismatchImage: null
    });
    const matchCount = useRef(0);
    const enrollMatchCount = useRef(0);

    useEffect(() => {
        loadModels();
        return () => stopCamera();
    }, []);

    useEffect(() => {
        if (modelsLoaded && targetDescriptor && !isCapturing) {
            startCamera();
        }
    }, [modelsLoaded, targetDescriptor]);

    const loadModels = async () => {
        try {
            setStatus('Loading Face AI Models...');
            const MODEL_URL = `${window.location.origin}/models`;
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            ]);
            setModelsLoaded(true);
            setStatus('Models Ready');
        } catch (err) {
            console.error('Model Load Error:', err);
            setError(`Failed to load face detection models: ${err.message || 'Network Error'}`);
        }
    };

    const startCamera = async () => {
        try {
            setError(null);
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'user' }
            });
            setStream(mediaStream);
            setIsCapturing(true);
            setStatus('Camera Active');
        } catch (err) {
            console.error('Camera Access Error:', err);
            setError('Could not access camera. Please check permissions.');
        }
    };

    const captureFrame = () => {
        if (!videoRef.current || !canvasRef.current) return null;
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        // Mirror the image for the capture to match the display
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.8);
    };

    useEffect(() => {
        if (isCapturing && videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [isCapturing, stream]);

    const updateOverlay = (detections) => {
        if (!overlayRef.current || !videoRef.current) return;
        const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
        if (displaySize.width === 0 || displaySize.height === 0) return;
        
        faceapi.matchDimensions(overlayRef.current, displaySize);
        const ctx = overlayRef.current.getContext('2d');
        ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
        
        if (detections) {
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            // Draw with custom color
            faceapi.draw.drawDetections(overlayRef.current, resizedDetections);
            faceapi.draw.drawFaceLandmarks(overlayRef.current, resizedDetections);
        }
    };

    const autoVerifyLoop = async () => {
        if (!videoRef.current || !isCapturing) return;

        // Check for 10-second timeout
        if (targetDescriptor && scanStartTime.current) {
            const timeElapsed = Date.now() - scanStartTime.current;
            if (timeElapsed >= 10000) {
                stopCamera();
                setError('Invalid face detected. Verification failed.');
                setStatus('Verification Failed');

                // If we have a mismatch descriptor, log it as a proxy attempt
                if (syncRef.current.lastMismatchDescriptor && onMismatch) {
                    onMismatch(syncRef.current.lastMismatchDescriptor, syncRef.current.lastMismatchImage);
                }

                return; // Stop the loop completely
            }
        }

        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });

        try {
            const detections = await faceapi
                .detectSingleFace(videoRef.current, options)
                .withFaceLandmarks(true)
                .withFaceDescriptor();

            updateOverlay(detections);

            if (detections && isCapturing) {
                const targetFloatArr = new Float32Array(targetDescriptor);
                const distance = faceapi.euclideanDistance(detections.descriptor, targetFloatArr);

                if (distance < 0.55) {
                    matchCount.current += 1;
                    if (matchCount.current >= 3) {
                        setStatus('Identity Verified! Logging in...');
                        if (onVerify) onVerify(true);
                        stopCamera();
                        return; // Stop the loop successful
                    } else {
                        setStatus(`Verifying... Hold still (${matchCount.current}/3)`);
                    }
                } else {
                    matchCount.current = 0;

                    // Capture mismatch for logging
                    syncRef.current.lastMismatchDescriptor = Array.from(detections.descriptor);
                    syncRef.current.lastMismatchImage = captureFrame();

                    const timeRemaining = Math.ceil((10000 - (Date.now() - scanStartTime.current)) / 1000);
                    setStatus(`Face found, but not a match. Retrying... (${timeRemaining}s)`);
                }
            } else if (isCapturing) {
                matchCount.current = 0;
                const timeRemaining = Math.ceil((10000 - (Date.now() - scanStartTime.current)) / 1000);
                setStatus(`Scanning Face... Please hold still. (${timeRemaining}s)`);
            }
        } catch (err) {
            console.error('Face detection loop error:', err);
            matchCount.current = 0;
        }

        // Loop again if video is still playing
        if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended && isCapturing) {
            setTimeout(autoVerifyLoop, 400);
        }
    };

    const autoEnrollLoop = async () => {
        if (!videoRef.current || !isCapturing || targetDescriptor) return;

        setStatus('Detecting Face...');
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.7 });

        try {
            const detections = await faceapi
                .detectSingleFace(videoRef.current, options)
                .withFaceLandmarks(true)
                .withFaceDescriptor();

            updateOverlay(detections);

            if (detections && isCapturing) {
                // Require high confidence score to ensure it's a real, clear human face
                if (detections.detection.score > 0.7) {
                    enrollMatchCount.current += 1;
                    setStatus(`Good face detected! Hold still... (${enrollMatchCount.current}/3)`);

                    if (enrollMatchCount.current >= 3) {
                        setStatus('Face Captured Successfully!');
                        const descriptor = Array.from(detections.descriptor);
                        onCapture(descriptor);
                        stopCamera();
                        return; // Stop loop
                    }
                } else {
                    enrollMatchCount.current = 0;
                    setStatus('Face detected but score is low. Please improve lighting.');
                }
            } else if (isCapturing) {
                enrollMatchCount.current = 0;
                setStatus('Looking for a clear face...');
            }
        } catch (err) {
            console.error('Face capture loop error:', err);
            enrollMatchCount.current = 0;
        }

        // Loop again if video is still playing
        if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended && isCapturing) {
            setTimeout(autoEnrollLoop, 500);
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
            setIsCapturing(false);
            matchCount.current = 0;
            enrollMatchCount.current = 0;
            if (overlayRef.current) {
                const ctx = overlayRef.current.getContext('2d');
                ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
            }
        }
    };

    const handleCapture = async () => {
        if (!videoRef.current) return;

        setStatus('Detecting Face...');
        const options = new faceapi.TinyFaceDetectorOptions();

        // Detect single face with landmarks and descriptor
        const detections = await faceapi
            .detectSingleFace(videoRef.current, options)
            .withFaceLandmarks(true)
            .withFaceDescriptor();

        if (!detections) {
            setError('No face detected. Please ensure your face is clearly visible.');
            setStatus('Detection Failed');
            return;
        }

        // The descriptor is an array of 128 numbers
        const descriptor = Array.from(detections.descriptor);

        if (targetDescriptor && targetDescriptor.length > 0) {
            setStatus('Verifying Identity...');
            const targetFloatArr = new Float32Array(targetDescriptor);
            const distance = faceapi.euclideanDistance(detections.descriptor, targetFloatArr);

            // Euclidean distance < 0.55 means a match
            if (distance < 0.55) {
                setStatus('Identity Verified!');
                if (onVerify) onVerify(true);
                stopCamera();
            } else {
                setError(`Identity verification failed. (Score: ${distance.toFixed(2)})`);
                setStatus('Match Failed');
                // We don't call onVerify(false) immediately to allow retry
            }
            return;
        }

        onCapture(descriptor);
        setStatus('Face Captured Successfully!');
        stopCamera();
    };

    return (
        <div className="flex flex-col items-center gap-4 p-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            {!isCapturing ? (
                <div className="text-center space-y-4">
                    <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mx-auto">
                        <Camera className="w-10 h-10 text-teal-600" />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-800">{label}</h4>
                        <p className="text-xs text-gray-500 mt-1">Position your face clearly in the frame</p>
                    </div>
                    <button
                        type="button"
                        onClick={startCamera}
                        disabled={!modelsLoaded}
                        className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${modelsLoaded
                            ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-lg shadow-teal-100'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        {status === 'Verification Failed' ? 'Retry Camera' : (modelsLoaded ? 'Start Camera' : 'Loading Models...')}
                    </button>
                </div>
            ) : (
                <div className="relative w-full max-w-[400px]">
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        onPlay={() => {
                            if (targetDescriptor) {
                                scanStartTime.current = Date.now(); // Start 10s timer only when video actually appears
                                autoVerifyLoop();
                            } else {
                                autoEnrollLoop();
                            }
                        }}
                        className="w-full rounded-2xl shadow-xl border-4 border-white bg-black"
                        style={{ transform: 'scaleX(-1)' }}
                    />
                    <div className="mt-4 flex gap-2 justify-center">
                        <button
                            type="button"
                            onClick={stopCamera}
                            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-300 transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                    <canvas 
                        ref={overlayRef} 
                        className="absolute top-0 left-0 w-full h-full pointer-events-none rounded-2xl border-4 border-transparent" 
                        style={{ transform: 'scaleX(-1)' }} 
                    />
                </div>
            )}

            {status && !error && (
                <p className="text-[10px] font-bold uppercase tracking-wider text-teal-600 animate-pulse">
                    {status}
                </p>
            )}

            {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg text-xs font-medium">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}
        </div>
    );
};

export default FaceCapture;
