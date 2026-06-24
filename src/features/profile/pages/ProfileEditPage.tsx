import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, Camera, Loader2, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';

const INTEREST_OPTIONS = [
  'Gaming', 'Cricket', 'Football', 'Badminton', 'Running', 'Cycling',
  'Yoga', 'Fitness', 'Coding', 'Startup Networking', 'Photography',
  'Music', 'Dance', 'Travel', 'Book Clubs', 'Workshops',
  'Language Exchange', 'House Parties', 'Board Games',
];

export function ProfileEditPage() {
  const { t } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(profile?.avatar_url || '');
  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    username: profile?.username || '',
    bio: profile?.bio || '',
    city: profile?.city || '',
    date_of_birth: profile?.date_of_birth || '',
    gender: profile?.gender || '',
    interests: profile?.interests || [],
    notification_preferences: profile?.notification_preferences || {
      push_events: true,
      push_messages: true,
      push_reminders: true,
      email_digest: true,
      email_marketing: false,
    },
  });

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleInterest = (interest: string) => {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i: string) => i !== interest)
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

  const handleSave = async () => {
    setIsLoading(true);
    try {
      let avatarUrl = profile?.avatar_url;

      // Upload avatar if changed
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
        }
      }

      await supabase
        .from('profiles')
        .update({
          full_name: form.full_name,
          username: form.username,
          bio: form.bio,
          city: form.city,
          date_of_birth: form.date_of_birth || null,
          gender: form.gender || null,
          interests: form.interests,
          avatar_url: avatarUrl,
          notification_preferences: form.notification_preferences,
        })
        .eq('id', profile!.id);

      await refreshProfile();
      navigate('/profile', { replace: true });
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleNotification = (key: string) => {
    setForm((prev) => ({
      ...prev,
      notification_preferences: {
        ...prev.notification_preferences,
        [key]: !(prev.notification_preferences as any)[key],
      },
    }));
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-lg font-bold">{t('profile.editProfile')}</h1>
        <button onClick={handleSave} disabled={isLoading} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t('common.save')}
        </button>
      </div>

      <div className="space-y-6">
        {/* Avatar */}
        <div className="flex justify-center">
          <label className="relative cursor-pointer group">
            <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden ring-4 ring-primary/10 group-hover:ring-primary/30 transition-all">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-primary">{form.full_name?.[0] || '?'}</span>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg">
              <Camera className="w-4 h-4" />
            </div>
            <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </label>
        </div>

        {/* Basic Info */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Basic Info</h2>

          <div>
            <label className="text-sm font-medium mb-1 block">{t('onboarding.fullName')}</label>
            <input type="text" value={form.full_name} onChange={(e) => updateField('full_name', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">{t('onboarding.username')}</label>
            <input type="text" value={form.username} onChange={(e) => updateField('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">{t('onboarding.bio')}</label>
            <textarea value={form.bio} onChange={(e) => updateField('bio', e.target.value)} rows={3} maxLength={200} className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
            <p className="text-xs text-muted-foreground text-right mt-1">{form.bio.length}/200</p>
          </div>
        </section>

        {/* Personal */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Personal</h2>

          <div>
            <label className="text-sm font-medium mb-1 block">{t('onboarding.city')}</label>
            <input type="text" value={form.city} onChange={(e) => updateField('city', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">{t('onboarding.dateOfBirth')}</label>
            <input type="date" value={form.date_of_birth} onChange={(e) => updateField('date_of_birth', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">{t('onboarding.gender')}</label>
            <div className="grid grid-cols-2 gap-2">
              {['male', 'female', 'non_binary', 'prefer_not_to_say'].map((g) => (
                <button key={g} onClick={() => updateField('gender', g)} className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${form.gender === g ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary/50 border-border hover:bg-secondary'}`}>
                  {g.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Interests */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t('onboarding.interests')}</h2>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((interest) => (
              <button key={interest} onClick={() => toggleInterest(interest)} className={`px-3.5 py-2 rounded-full text-sm font-medium transition-all ${form.interests.includes(interest) ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-105' : 'bg-secondary/50 text-foreground border border-border hover:bg-secondary'}`}>
                {interest}
              </button>
            ))}
          </div>
        </section>

        {/* Notification Preferences */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Notifications</h2>
          <div className="space-y-2">
            {Object.entries({
              push_events: 'Event updates',
              push_messages: 'New messages',
              push_reminders: 'Event reminders',
              email_digest: 'Weekly digest',
              email_marketing: 'Marketing emails',
            }).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
                <span className="text-sm">{label}</span>
                <button onClick={() => toggleNotification(key)} className={`w-12 h-7 rounded-full transition-colors ${(form.notification_preferences as any)[key] ? 'bg-primary' : 'bg-secondary'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${(form.notification_preferences as any)[key] ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
