import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { supabase } from '@/lib/supabase';

interface LocationContextValue {
  selectedCity: string;
  setSelectedCity: (city: string) => Promise<void>;
  availableCities: string[];
}

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
    <LocationContext.Provider value={{ selectedCity, setSelectedCity, availableCities }}>
      {children}
    </LocationContext.Provider>
  );
}
