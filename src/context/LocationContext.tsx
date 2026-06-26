import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { supabase } from '@/lib/supabase';

interface LocationContextValue {
  selectedCity: string;
  setSelectedCity: (city: string) => Promise<void>;
  availableCities: string[];
  userCoords: { lat: number; lng: number } | null;
}

const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'Delhi': { lat: 28.6139, lng: 77.2090 },
  'Mumbai': { lat: 19.0760, lng: 72.8777 },
  'Bengaluru': { lat: 12.9716, lng: 77.5946 },
  'Pune': { lat: 18.5204, lng: 73.8567 },
  'Hyderabad': { lat: 17.3850, lng: 78.4867 },
  'Goa': { lat: 15.2993, lng: 74.1240 },
  'Chennai': { lat: 13.0827, lng: 80.2707 },
};

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

export function useLocationContext() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }
  return context;
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const { user, profile, updateProfile } = useAuth();
  const [selectedCity, setSelectedCityState] = useState<string>(() => {
    return localStorage.getItem('vibeloop_selected_city') || '';
  });
  const [availableCities, setAvailableCities] = useState<string[]>([
    'Delhi',
    'Mumbai',
    'Bengaluru',
    'Pune',
    'Hyderabad',
    'Goa',
    'Chennai'
  ]);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Load cities from events table dynamically
  useEffect(() => {
    const fetchCities = async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('city')
          .eq('status', 'published');
        if (!error && data) {
          const cities = Array.from(
            new Set(data.map((e: any) => e.city).filter(Boolean))
          ) as string[];
          setAvailableCities((prev) => {
            const merged = Array.from(new Set([...prev, ...cities])).sort();
            return merged;
          });
        }
      } catch (err) {
        console.error('Error fetching cities:', err);
      }
    };
    fetchCities();
  }, []);

  // Try to get geolocation automatically on mount if no city is saved or it is 'Current Location'
  useEffect(() => {
    const saved = localStorage.getItem('vibeloop_selected_city');
    if (!saved || saved === 'Current Location') {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserCoords({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
            setSelectedCityState('Current Location');
            localStorage.setItem('vibeloop_selected_city', 'Current Location');
          },
          (error) => {
            console.error('Automatic geolocation failed:', error);
          }
        );
      }
    }
  }, []);

  // Update selected city when profile city changes
  useEffect(() => {
    if (profile?.city) {
      setSelectedCityState(profile.city);
      localStorage.setItem('vibeloop_selected_city', profile.city);
    } else {
      const saved = localStorage.getItem('vibeloop_selected_city');
      if (saved) {
        setSelectedCityState(saved);
      }
    }
  }, [profile]);

  // Resolve user coords
  useEffect(() => {
    if (!selectedCity) {
      setUserCoords(null);
      return;
    }

    if (selectedCity === 'Current Location') {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserCoords({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          (error) => {
            console.error('Error fetching GPS coordinates:', error);
            setUserCoords(null);
          }
        );
      } else {
        setUserCoords(null);
      }
      return;
    }

    if (CITY_COORDINATES[selectedCity]) {
      setUserCoords(CITY_COORDINATES[selectedCity]);
      return;
    }

    // Geocode other Indian districts dynamically
    const geocodeCity = async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(selectedCity + ', India')}&limit=1`
        );
        const data = await response.json();
        if (data && data.length > 0) {
          setUserCoords({
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
          });
        } else {
          setUserCoords(null);
        }
      } catch (err) {
        console.error('Error geocoding selected city:', err);
        setUserCoords(null);
      }
    };
    geocodeCity();
  }, [selectedCity]);

  const setSelectedCity = async (city: string) => {
    setSelectedCityState(city);
    localStorage.setItem('vibeloop_selected_city', city);
    if (user && profile && city !== profile.city) {
      try {
        await updateProfile({ city });
      } catch (err) {
        console.error('Failed to sync city to profile:', err);
      }
    }
  };

  return (
    <LocationContext.Provider value={{ selectedCity, setSelectedCity, availableCities, userCoords }}>
      {children}
    </LocationContext.Provider>
  );
}
