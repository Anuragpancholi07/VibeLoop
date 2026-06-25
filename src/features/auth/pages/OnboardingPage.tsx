import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, Camera } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const INTEREST_OPTIONS = [
  'Gaming', 'Cricket', 'Football', 'Badminton', 'Running', 'Cycling',
  'Yoga', 'Fitness', 'Coding', 'Startup Networking', 'Photography',
  'Music', 'Dance', 'Travel', 'Book Clubs', 'Workshops',
  'Language Exchange', 'House Parties', 'Board Games',
];

export function OnboardingPage() {
  const { t } = useTranslation();
  const { updateProfile, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    username: profile?.username || '',
    bio: '',
    date_of_birth: '',
    gender: '' as string,
    city: '',
    interests: [] as string[],
  });

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleInterest = (interest: string) => {
    setFormData((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      let avatarUrl = profile?.avatar_url || '';

      if (avatarFile && profile?.id) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `avatars/${profile.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('user-uploads')
          .upload(filePath, avatarFile, { upsert: true });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('user-uploads')
            .getPublicUrl(filePath);
          avatarUrl = publicUrl;
        } else {
          console.error('Avatar upload error:', uploadError);
        }
      }

      await updateProfile({
        ...formData,
        avatar_url: avatarUrl || null,
        onboarding_completed: true,
      } as any);
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Error completing onboarding:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    // Step 0: Basic Info
    <motion.div
      key="basic"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <div className="flex justify-center mb-4">
        <div 
          onClick={() => document.getElementById('avatar-upload-input')?.click()}
          className="relative w-24 h-24 rounded-full bg-secondary flex items-center justify-center overflow-hidden cursor-pointer hover:bg-secondary/80 transition-colors"
        >
          {avatarPreview ? (
            <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <Camera className="w-8 h-8 text-muted-foreground" />
          )}
          <button className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg">
            <span className="text-lg">+</span>
          </button>
        </div>
        <input 
          type="file" 
          id="avatar-upload-input" 
          accept="image/*" 
          onChange={handleAvatarChange} 
          className="hidden" 
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-1 block">{t('onboarding.fullName')}</label>
        <input
          type="text"
          value={formData.full_name}
          onChange={(e) => updateField('full_name', e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Your name"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-1 block">{t('onboarding.username')}</label>
        <input
          type="text"
          value={formData.username}
          onChange={(e) => updateField('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="@username"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-1 block">{t('onboarding.bio')}</label>
        <textarea
          value={formData.bio}
          onChange={(e) => updateField('bio', e.target.value)}
          rows={3}
          maxLength={200}
          className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          placeholder="Tell us about yourself..."
        />
      </div>
    </motion.div>,

    // Step 1: Personal Details
    <motion.div
      key="personal"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <div>
        <label className="text-sm font-medium text-foreground mb-1 block">{t('onboarding.dateOfBirth')}</label>
        <input
          type="date"
          value={formData.date_of_birth}
          onChange={(e) => updateField('date_of_birth', e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-1 block">{t('onboarding.gender')}</label>
        <div className="grid grid-cols-2 gap-2">
          {['male', 'female', 'non_binary', 'prefer_not_to_say'].map((g) => (
            <button
              key={g}
              onClick={() => updateField('gender', g)}
              className={`px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                formData.gender === g
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary/50 border-border hover:bg-secondary'
              }`}
            >
              {g.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-1 block">{t('onboarding.city')}</label>
        <input
          type="text"
          value={formData.city}
          onChange={(e) => updateField('city', e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Your city"
        />
      </div>
    </motion.div>,

    // Step 2: Interests
    <motion.div
      key="interests"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <p className="text-sm text-muted-foreground">{t('onboarding.selectInterests')}</p>
      <div className="flex flex-wrap gap-2">
        {INTEREST_OPTIONS.map((interest) => (
          <button
            key={interest}
            onClick={() => toggleInterest(interest)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              formData.interests.includes(interest)
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-105'
                : 'bg-secondary/50 text-foreground border border-border hover:bg-secondary'
            }`}
          >
            {interest}
          </button>
        ))}
      </div>
    </motion.div>,
  ];

  return (
    <div className="min-h-dvh flex flex-col px-4 py-8 bg-background">
      <div className="max-w-sm mx-auto w-full">
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-primary' : 'bg-secondary'
              }`}
            />
          ))}
        </div>

        <h1 className="text-2xl font-bold mb-2">{t('onboarding.title')}</h1>
        <p className="text-muted-foreground text-sm mb-6">{t('onboarding.subtitle')}</p>

        {/* Current Step */}
        {steps[step]}

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          {step > 0 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="px-6 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Back
            </button>
          ) : (
            <button
              onClick={() => navigate('/', { replace: true })}
              className="px-6 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('onboarding.skip')}
            </button>
          )}

          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={isLoading}
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('onboarding.complete')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
