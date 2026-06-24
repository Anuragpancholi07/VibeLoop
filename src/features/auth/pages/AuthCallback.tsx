import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { PageLoader } from '@/components/common';

export function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for the session state from Supabase Auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        try {
          // Check if user has already completed onboarding
          const { data, error } = await supabase
            .from('profiles')
            .select('onboarding_completed')
            .eq('id', session.user.id)
            .single();

          if (!error && data?.onboarding_completed) {
            navigate('/', { replace: true });
          } else {
            navigate('/onboarding', { replace: true });
          }
        } catch (err) {
          console.error('Error fetching onboarding status:', err);
          navigate('/onboarding', { replace: true });
        }
      } else {
        // Fallback timeout in case auth does not resolve immediately
        const timer = setTimeout(() => {
          navigate('/auth/login', { replace: true });
        }, 3000);
        return () => clearTimeout(timer);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background">
      <PageLoader />
      <p className="mt-4 text-muted-foreground animate-pulse">Completing secure sign-in...</p>
    </div>
  );
}
