import { useCallback, useEffect, useState } from 'react';

const OPTIONS = { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 };

/**
 * The device's location, asked for once.
 *
 * status: 'prompt' (not answered yet) | 'granted' | 'denied' | 'unavailable'
 * (no GPS support, or no fix could be obtained).
 *
 * @param {{ auto?: boolean }} [options] auto: ask as soon as the screen opens.
 * @returns {{ status: 'prompt'|'granted'|'denied'|'unavailable',
 *             position: { lat: number, lng: number, accuracy: number } | null,
 *             request: () => void }}
 */
export function useGeolocation({ auto = true } = {}) {
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const [state, setState] = useState({
    status: supported ? 'prompt' : 'unavailable',
    position: null,
  });

  const request = useCallback(() => {
    if (!supported) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setState({
          status: 'granted',
          position: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
        }),
      (err) =>
        setState({
          status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable',
          position: null,
        }),
      OPTIONS
    );
  }, [supported]);

  useEffect(() => {
    if (auto) request();
  }, [auto, request]);

  return { ...state, request };
}
