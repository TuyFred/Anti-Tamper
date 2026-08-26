import { useCallback, useEffect, useRef, useState } from 'react';

const LIVE_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 25000,
  maximumAge: 0,
};

function isSecureContext() {
  return typeof window !== 'undefined'
    && (window.isSecureContext || window.location.hostname === 'localhost');
}

/**
 * Browser geolocation — live GPS on phones and laptops when the user allows access.
 */
export function useGeolocation(options = LIVE_OPTIONS) {
  const optsRef = useRef({ ...LIVE_OPTIONS, ...options });
  optsRef.current = { ...LIVE_OPTIONS, ...options };

  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [permission, setPermission] = useState('prompt');
  const [watching, setWatching] = useState(false);
  const watchId = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setPermission('unsupported');
      return;
    }
    if (!isSecureContext()) {
      setPermission('insecure');
      setError('Location needs HTTPS or localhost — open the app via https:// or on this computer');
      return;
    }
    if (!navigator.permissions?.query) return;
    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      setPermission(result.state);
      result.onchange = () => setPermission(result.state);
    }).catch(() => {});
  }, []);

  const clearWatch = useCallback(() => {
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setWatching(false);
  }, []);

  const requestLocation = useCallback((watch = false) => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported on this device');
      setPermission('unsupported');
      return;
    }
    if (!isSecureContext()) {
      setError('Location needs HTTPS or localhost — use https:// on your phone or open on this laptop');
      setPermission('insecure');
      return;
    }

    setLoading(true);
    setError(null);

    const onSuccess = (pos) => {
      setPosition({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
        timestamp: pos.timestamp,
      });
      setPermission('granted');
      setLoading(false);
    };

    const onFail = (err) => {
      setLoading(false);
      if (err.code === err.PERMISSION_DENIED) {
        setPermission('denied');
        setError('Location blocked — tap Allow when your browser asks, or enable GPS in phone settings');
      } else if (err.code === err.TIMEOUT) {
        setError('Location timed out — move near a window or turn on GPS');
      } else {
        setError('Could not get your location — check GPS is enabled');
      }
    };

    clearWatch();

    if (watch) {
      setWatching(true);
      watchId.current = navigator.geolocation.watchPosition(
        onSuccess,
        onFail,
        optsRef.current,
      );
    } else {
      navigator.geolocation.getCurrentPosition(
        onSuccess,
        onFail,
        optsRef.current,
      );
    }
  }, [clearWatch]);

  const startLiveWatch = useCallback(() => {
    requestLocation(true);
  }, [requestLocation]);

  useEffect(() => () => clearWatch(), [clearWatch]);

  return {
    position,
    loading,
    error,
    permission,
    watching,
    requestLocation,
    startLiveWatch,
    clearWatch,
    supported: permission !== 'unsupported',
    secure: permission !== 'insecure',
  };
}
