import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Upload, MapPin, Plus, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { slugify } from '@/lib/utils';
import { EVENT_TYPES, GENDER_OPTIONS } from '@/lib/constants';
import type { EventCategory } from '@/types';

const STEPS = ['Basic Info', 'Type & Schedule', 'Location', 'Capacity & Pricing', 'Rules & Publish'];

export function CreateEventPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [form, setForm] = useState({
    title: '', subtitle: '', description: '', category_id: '',
    event_type: 'public', event_date: '', start_time: '', end_time: '',
    address: '', city: '', latitude: 0, longitude: 0,
    max_attendees: '', waitlist_enabled: false,
    gender_restriction: 'anyone', min_age: '18', max_age: '99',
    is_free: true, ticket_price: '', refund_policy: '',
    approval_type: 'instant', rules: [] as string[],
  });
  const [newRule, setNewRule] = useState('');

  useEffect(() => {
    supabase.from('event_categories').select('*').eq('is_active', true).order('sort_order')
      .then(({ data }) => setCategories((data || []) as EventCategory[]));
  }, []);

  const updateForm = (field: string, value: any) => setForm((prev) => ({ ...prev, [field]: value }));

  const addRule = () => {
    if (newRule.trim()) {
      updateForm('rules', [...form.rules, newRule.trim()]);
      setNewRule('');
    }
  };

  const removeRule = (index: number) => {
    updateForm('rules', form.rules.filter((_, i) => i !== index));
  };

  const handlePublish = async () => {
    if (!user) return;
    setIsSubmitting(true);
    setError('');
    try {
      // Validate required fields first
      if (!form.title.trim()) throw new Error('Please add an event title');
      if (!form.event_date) throw new Error('Please select an event date');
      if (!form.start_time) throw new Error('Please set a start time — go to Step 2 (Type & Schedule)');
      if (!form.end_time) throw new Error('Please set an end time — go to Step 2 (Type & Schedule)');

      // Build proper ISO timestamp strings — handle both HH:MM and HH:MM:SS from browser
      const toIso = (date: string, time: string) => {
        const d = new Date(`${date}T${time}`);
        if (isNaN(d.getTime())) throw new Error(`Invalid date/time: ${date} ${time}`);
        return d.toISOString();
      };
      const startIso = toIso(form.event_date, form.start_time);
      const endIso = toIso(form.event_date, form.end_time);
      if (new Date(endIso) <= new Date(startIso)) throw new Error('End time must be after start time');

      if (!form.is_free && (!form.ticket_price || parseFloat(form.ticket_price) <= 0)) {
        throw new Error('Please set a valid ticket price for paid events');
      }

      const eventData = {
        host_id: user.id,
        title: form.title.trim(),
        subtitle: form.subtitle || null,
        description: form.description || null,
        slug: slugify(form.title) + '-' + Date.now().toString(36),
        category_id: form.category_id || null,
        event_type: form.event_type,
        status: 'published',
        event_date: form.event_date,
        start_time: startIso,
        end_time: endIso,
        address: form.address || null,
        city: form.city || null,
        latitude: form.latitude || null,
        longitude: form.longitude || null,
        max_attendees: form.max_attendees ? parseInt(form.max_attendees) : null,
        waitlist_enabled: form.waitlist_enabled,
        gender_restriction: form.gender_restriction,
        min_age: parseInt(form.min_age),
        max_age: parseInt(form.max_age),
        is_free: form.is_free,
        ticket_price: form.is_free ? 0 : parseFloat(form.ticket_price) || 0,
        currency: 'INR',
        refund_policy: form.refund_policy || null,
        approval_type: form.approval_type,
        rules: form.rules,
      };

      const { data, error: insertError } = await supabase.from('events').insert(eventData).select().single();
      if (insertError) {
        // Give human-readable messages for common DB errors
        if (insertError.code === '42501' || insertError.message?.includes('policy') || insertError.message?.includes('permission')) {
          throw new Error('Permission denied. Please make sure you are signed in and try again.');
        }
        if (insertError.message?.includes('check_event_dates') || insertError.message?.includes('check constraint')) {
          throw new Error('End time must be after start time. Please go back to Step 2 and fix the times.');
        }
        throw insertError;
      }
      navigate(`/events/${data.id}`);
    } catch (err: any) {
      console.error('Error creating event:', err);
      setError(err.message || 'Failed to publish event. Please check your inputs and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepContent = [
    // Step 0: Basic Info
    <div className="space-y-4" key="basic">
      <div>
        <label className="text-sm font-medium mb-1 block">{t('createEvent.eventTitle')}</label>
        <input type="text" value={form.title} onChange={(e) => updateForm('title', e.target.value)} placeholder="e.g. Weekend Cricket Match" className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">{t('createEvent.eventSubtitle')}</label>
        <input type="text" value={form.subtitle} onChange={(e) => updateForm('subtitle', e.target.value)} placeholder="A short tagline..." className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">{t('createEvent.eventDescription')}</label>
        <textarea value={form.description} onChange={(e) => updateForm('description', e.target.value)} rows={4} placeholder="Describe your event..." className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">{t('createEvent.selectCategory')}</label>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => updateForm('category_id', cat.id)} className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${form.category_id === cat.id ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 border border-border'}`}>
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">{t('createEvent.bannerImage')}</label>
        <div className="flex items-center justify-center w-full h-32 rounded-xl border-2 border-dashed border-border bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors">
          <div className="text-center">
            <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
            <span className="text-xs text-muted-foreground">{t('createEvent.uploadImage')}</span>
          </div>
        </div>
      </div>
    </div>,

    // Step 1: Type & Schedule
    <div className="space-y-4" key="type">
      <div>
        <label className="text-sm font-medium mb-2 block">{t('createEvent.eventType')}</label>
        <div className="space-y-2">
          {EVENT_TYPES.map((type) => (
            <button key={type.value} onClick={() => updateForm('event_type', type.value)} className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-colors text-left ${form.event_type === type.value ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${form.event_type === type.value ? 'border-primary' : 'border-border'}`}>
                {form.event_type === type.value && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
              </div>
              <div>
                <p className="text-sm font-medium">{type.label}</p>
                <p className="text-xs text-muted-foreground">{type.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">{t('createEvent.eventDate')}</label>
        <input type="date" value={form.event_date} onChange={(e) => updateForm('event_date', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-1 block">{t('createEvent.startTime')}</label>
          <input type="time" value={form.start_time} onChange={(e) => updateForm('start_time', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">{t('createEvent.endTime')}</label>
          <input type="time" value={form.end_time} onChange={(e) => updateForm('end_time', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>
    </div>,

    // Step 2: Location
    <div className="space-y-4" key="location">
      <div>
        <label className="text-sm font-medium mb-1 block">{t('createEvent.address')}</label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={form.address} onChange={(e) => updateForm('address', e.target.value)} placeholder="Event address" className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">City</label>
        <input type="text" value={form.city} onChange={(e) => updateForm('city', e.target.value)} placeholder="City" className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div className="w-full h-48 rounded-xl bg-secondary/30 border border-border flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Map will appear here</p>
          <p className="text-xs">Google Maps integration</p>
        </div>
      </div>
    </div>,

    // Step 3: Capacity & Pricing
    <div className="space-y-4" key="capacity">
      <div>
        <label className="text-sm font-medium mb-1 block">{t('createEvent.maxAttendees')}</label>
        <input type="number" value={form.max_attendees} onChange={(e) => updateForm('max_attendees', e.target.value)} placeholder="Leave empty for unlimited" className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
        <span className="text-sm font-medium">{t('createEvent.enableWaitlist')}</span>
        <button onClick={() => updateForm('waitlist_enabled', !form.waitlist_enabled)} className={`w-12 h-7 rounded-full transition-colors ${form.waitlist_enabled ? 'bg-primary' : 'bg-secondary'}`}>
          <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${form.waitlist_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">{t('createEvent.genderRestriction')}</label>
        <div className="grid grid-cols-2 gap-2">
          {GENDER_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => updateForm('gender_restriction', opt.value)} className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${form.gender_restriction === opt.value ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 border border-border'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-1 block">{t('createEvent.minAge')}</label>
          <input type="number" value={form.min_age} onChange={(e) => updateForm('min_age', e.target.value)} min="18" className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">{t('createEvent.maxAge')}</label>
          <input type="number" value={form.max_age} onChange={(e) => updateForm('max_age', e.target.value)} max="99" className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>
      <div className="space-y-3">
        <label className="text-sm font-medium block">{t('createEvent.pricing')}</label>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => updateForm('is_free', true)} className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${form.is_free ? 'bg-success text-white' : 'bg-secondary/50 border border-border'}`}>
            🎉 {t('createEvent.freeEvent')}
          </button>
          <button onClick={() => updateForm('is_free', false)} className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${!form.is_free ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 border border-border'}`}>
            🎫 {t('createEvent.paidEvent')}
          </button>
        </div>
        {!form.is_free && (
          <div>
            <label className="text-sm font-medium mb-1 block">{t('createEvent.ticketPrice')} (₹)</label>
            <input type="number" value={form.ticket_price} onChange={(e) => updateForm('ticket_price', e.target.value)} placeholder="0.00" className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        )}
      </div>
    </div>,

    // Step 4: Rules & Publish
    <div className="space-y-4" key="rules">
      <div>
        <label className="text-sm font-medium mb-2 block">{t('createEvent.approvalType')}</label>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => updateForm('approval_type', 'instant')} className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${form.approval_type === 'instant' ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 border border-border'}`}>
            ⚡ {t('createEvent.instantJoin')}
          </button>
          <button onClick={() => updateForm('approval_type', 'host_approval')} className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${form.approval_type === 'host_approval' ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 border border-border'}`}>
            ✅ {t('createEvent.hostApproval')}
          </button>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">Event Rules</label>
        {form.rules.map((rule, i) => (
          <div key={i} className="flex items-center gap-2 mb-2 p-2.5 rounded-lg bg-secondary/30 border border-border">
            <span className="text-sm flex-1">{rule}</span>
            <button onClick={() => removeRule(i)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
        ))}
        <div className="flex gap-2">
          <input type="text" value={newRule} onChange={(e) => setNewRule(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addRule()} placeholder={t('createEvent.rulePlaceholder')} className="flex-1 px-4 py-2.5 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
          <button onClick={addRule} className="px-3 py-2.5 rounded-xl bg-secondary border border-border hover:bg-secondary/80 transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
      {!form.is_free && (
        <div>
          <label className="text-sm font-medium mb-1 block">{t('createEvent.refundPolicy')}</label>
          <textarea value={form.refund_policy} onChange={(e) => updateForm('refund_policy', e.target.value)} rows={3} placeholder="Describe your refund policy..." className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none text-sm" />
        </div>
      )}
    </div>,
  ];

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      {/* Progress */}
      <div className="flex gap-1.5 mb-6">
        {STEPS.map((s, i) => (
          <div key={i} className="flex-1">
            <div className={`h-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-secondary'}`} />
            <p className={`text-[10px] mt-1 text-center ${i <= step ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{s}</p>
          </div>
        ))}
      </div>

      <h1 className="text-xl font-bold mb-4">{t('createEvent.title')}</h1>

      {/* Step content */}
      <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
        {stepContent[step]}
      </motion.div>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20 text-center">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8 pb-4">
        <button onClick={() => step > 0 ? setStep(step - 1) : navigate(-1)} className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> {step > 0 ? t('createEvent.back') : 'Cancel'}
        </button>
        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep(step + 1)} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity">
            {t('createEvent.next')} <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handlePublish} disabled={isSubmitting || !form.title} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg shadow-primary/25">
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('createEvent.publish')}
          </button>
        )}
      </div>
    </div>
  );
}
