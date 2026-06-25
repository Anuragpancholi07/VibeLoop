import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Upload, MapPin, Plus, X, Loader2, Navigation } from 'lucide-react';
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

  // Custom Category states
  const [isOtherSelected, setIsOtherSelected] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const handleCreateCustomCategory = async () => {
    const trimmed = customCategoryName.trim();
    if (!trimmed) return;

    setIsCreatingCategory(true);
    try {
      // Check if category already exists in local loaded list (case-insensitive)
      const existing = categories.find(
        (cat) => cat.name.toLowerCase() === trimmed.toLowerCase()
      );

      if (existing) {
        updateForm('category_id', existing.id);
        setIsOtherSelected(false);
        setCustomCategoryName('');
        alert('This category already exists. It has been selected for you.');
        return;
      }

      const slug = slugify(trimmed);
      const { data, error: insertError } = await supabase
        .from('event_categories')
        .insert({
          name: trimmed,
          slug,
          icon: '✨',
          color: 'from-purple-500 to-indigo-500',
          is_active: true,
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          const { data: existingCat, error: fetchError } = await supabase
            .from('event_categories')
            .select('*')
            .ilike('name', trimmed)
            .single();

          if (!fetchError && existingCat) {
            const cat = existingCat as EventCategory;
            setCategories((prev) => [...prev, cat]);
            updateForm('category_id', cat.id);
            setIsOtherSelected(false);
            setCustomCategoryName('');
            return;
          }
        }
        throw insertError;
      }

      if (data) {
        const newCat = data as EventCategory;
        setCategories((prev) => [...prev, newCat]);
        updateForm('category_id', newCat.id);
        setIsOtherSelected(false);
        setCustomCategoryName('');
      }
    } catch (err: any) {
      console.error('Error creating custom category:', err);
      alert(err.message || 'Failed to create category. Please try again.');
    } finally {
      setIsCreatingCategory(false);
    }
  };


  // Image upload states
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string>('');

  // Address search states
  const [addressSearch, setAddressSearch] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  // Map refs
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

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

  // File picker handler
  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBannerFile(file);
      const reader = new FileReader();
      reader.onload = () => setBannerPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Debounced search suggestions using OpenStreetMap Nominatim API
  useEffect(() => {
    if (!addressSearch || addressSearch.length < 3) {
      setSuggestions([]);
      return;
    }
    setIsSearching(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(addressSearch)}&countrycodes=in&limit=5`
        );
        const data = await response.json();
        setSuggestions(data || []);
      } catch (err) {
        console.error('Geocoder search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 600);
    return () => clearTimeout(delayDebounceFn);
  }, [addressSearch]);

  // Leaflet map renderer & interaction
  useEffect(() => {
    if (step !== 2 || !mapContainerRef.current) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
      return;
    }

    const initialLat = form.latitude || 28.6139;
    const initialLng = form.longitude || 77.2090;
    const L = (window as any).L;
    if (!L) {
      console.error('Leaflet script not found');
      return;
    }

    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const map = L.map(mapContainerRef.current).setView([initialLat, initialLng], 13);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);
    markerRef.current = marker;

    const reverseGeocode = async (lat: number, lng: number) => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
        );
        const data = await response.json();
        if (data) {
          const address = data.display_name || '';
          const city = data.address.city || data.address.town || data.address.village || data.address.state_district || data.address.state || '';
          updateForm('address', address);
          updateForm('city', city);
        }
      } catch (err) {
        console.error(err);
      }
    };

    marker.on('dragend', () => {
      const position = marker.getLatLng();
      updateForm('latitude', position.lat);
      updateForm('longitude', position.lng);
      reverseGeocode(position.lat, position.lng);
    });

    map.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      updateForm('latitude', lat);
      updateForm('longitude', lng);
      reverseGeocode(lat, lng);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [step]);

  // Geolocation trigger
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        updateForm('latitude', lat);
        updateForm('longitude', lng);

        if (mapRef.current && markerRef.current) {
          mapRef.current.setView([lat, lng], 15);
          markerRef.current.setLatLng([lat, lng]);
        }

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
          );
          const data = await response.json();
          if (data) {
            const address = data.display_name || '';
            const city = data.address.city || data.address.town || data.address.village || data.address.state_district || data.address.state || '';
            updateForm('address', address);
            updateForm('city', city);
            setAddressSearch(address);
          }
        } catch (err) {
          console.error(err);
        } finally {
          setIsFetchingLocation(false);
        }
      },
      (error) => {
        console.error(error);
        alert('Failed to obtain location. Please grant permission in browser settings.');
        setIsFetchingLocation(false);
      }
    );
  };

  // Form Validation per step
  const isStepValid = (stepIndex: number) => {
    switch (stepIndex) {
      case 0:
        return !!form.title.trim() && !!form.category_id && !!bannerFile;
      case 1:
        return !!form.event_type && !!form.event_date && !!form.start_time && !!form.end_time;
      case 2:
        return !!form.address.trim() && !!form.city.trim() && form.latitude !== 0 && form.longitude !== 0;
      case 3:
        return (
          !!form.gender_restriction &&
          !!form.min_age &&
          !!form.max_age &&
          (form.is_free || (!!form.ticket_price && parseFloat(form.ticket_price) > 0))
        );
      case 4:
        return !!form.approval_type && (form.is_free || !!form.refund_policy.trim());
      default:
        return true;
    }
  };

  const handlePublish = async () => {
    if (!user) return;
    setIsSubmitting(true);
    setError('');
    try {
      if (!form.title.trim()) throw new Error('Please add an event title');
      if (!form.event_date) throw new Error('Please select an event date');
      if (!form.start_time) throw new Error('Please set a start time');
      if (!form.end_time) throw new Error('Please set an end time');
      if (!bannerFile) throw new Error('Please upload a banner image');

      // Upload banner image to Supabase Storage
      let bannerUrl = null;
      if (bannerFile) {
        const fileExt = bannerFile.name.split('.').pop();
        const filePath = `events/${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('user-uploads')
          .upload(filePath, bannerFile, { upsert: true });

        if (uploadError) {
          throw new Error('Failed to upload image banner: ' + uploadError.message);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('user-uploads')
          .getPublicUrl(filePath);
        bannerUrl = publicUrl;
      }

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
        banner_url: bannerUrl,
      };

      const { data, error: insertError } = await supabase.from('events').insert(eventData).select().single();
      if (insertError) {
        if (insertError.code === '42501' || insertError.message?.includes('policy') || insertError.message?.includes('permission')) {
          throw new Error('Permission denied. Please make sure you are signed in and try again.');
        }
        if (insertError.message?.includes('check_event_dates') || insertError.message?.includes('check constraint')) {
          throw new Error('End time must be after start time. Please check step 2 schedules.');
        }
        throw insertError;
      }
      navigate(`/events/${data.id}`);
    } catch (err: any) {
      console.error('Error creating event:', err);
      setError(err.message || 'Failed to publish event. Please check inputs and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepContent = [
    // Step 0: Basic Info
    <div className="space-y-4" key="basic">
      <div>
        <label className="text-sm font-medium mb-1 block">{t('createEvent.eventTitle')} *</label>
        <input type="text" value={form.title} onChange={(e) => updateForm('title', e.target.value)} placeholder="e.g. Weekend Cricket Match" className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">{t('createEvent.eventSubtitle')}</label>
        <input type="text" value={form.subtitle} onChange={(e) => updateForm('subtitle', e.target.value)} placeholder="A short tagline..." className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">{t('createEvent.eventDescription')}</label>
        <textarea value={form.description} onChange={(e) => updateForm('description', e.target.value)} rows={3} placeholder="Describe your event..." className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">{t('createEvent.selectCategory')} *</label>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button 
              key={cat.id} 
              type="button"
              onClick={() => {
                updateForm('category_id', cat.id);
                setIsOtherSelected(false);
              }} 
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${form.category_id === cat.id ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 border border-border'}`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setIsOtherSelected(true);
              updateForm('category_id', '');
            }}
            className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${isOtherSelected ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 border border-border'}`}
          >
            ✨ Other
          </button>
        </div>

        {isOtherSelected && (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={customCategoryName}
              onChange={(e) => setCustomCategoryName(e.target.value)}
              placeholder="Enter custom category name..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
            <button
              type="button"
              onClick={handleCreateCustomCategory}
              disabled={isCreatingCategory || !customCategoryName.trim()}
              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1.5 shadow-md shadow-primary/25 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isCreatingCategory ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add
            </button>
          </div>
        )}
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">{t('createEvent.bannerImage')} *</label>
        <div 
          onClick={() => document.getElementById('banner-upload-input')?.click()}
          className="relative flex items-center justify-center w-full h-36 rounded-xl border-2 border-dashed border-border bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors overflow-hidden"
        >
          {bannerPreview ? (
            <img src={bannerPreview} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <div className="text-center">
              <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
              <span className="text-xs text-muted-foreground">{t('createEvent.uploadImage')}</span>
            </div>
          )}
          <input 
            type="file" 
            id="banner-upload-input" 
            accept="image/*" 
            onChange={handleBannerChange} 
            className="hidden" 
          />
        </div>
      </div>
    </div>,

    // Step 1: Type & Schedule
    <div className="space-y-4" key="type">
      <div>
        <label className="text-sm font-medium mb-2 block">{t('createEvent.eventType')} *</label>
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
        <label className="text-sm font-medium mb-1 block">{t('createEvent.eventDate')} *</label>
        <input type="date" value={form.event_date} onChange={(e) => updateForm('event_date', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-1 block">{t('createEvent.startTime')} *</label>
          <input type="time" value={form.start_time} onChange={(e) => updateForm('start_time', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">{t('createEvent.endTime')} *</label>
          <input type="time" value={form.end_time} onChange={(e) => updateForm('end_time', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
        </div>
      </div>
    </div>,

    // Step 2: Location Search & Map
    <div className="space-y-4" key="location">
      <div className="relative">
        <label className="text-sm font-medium mb-1 block">Search Location / Address *</label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            value={addressSearch} 
            onChange={(e) => setAddressSearch(e.target.value)} 
            placeholder="Type landmark, street, or city in India..." 
            className="w-full pl-10 pr-10 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" 
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {/* geocode dropdown */}
        {suggestions.length > 0 && (
          <div className="absolute z-[1000] left-0 right-0 mt-1 rounded-xl border border-border bg-popover text-popover-foreground shadow-lg max-h-56 overflow-y-auto divide-y divide-border/50">
            {suggestions.map((item) => (
              <button
                key={item.place_id}
                onClick={() => {
                  const lat = parseFloat(item.lat);
                  const lng = parseFloat(item.lon);
                  const displayName = item.display_name;
                  const city = item.address.city || item.address.town || item.address.village || item.address.state_district || item.address.state || '';
                  
                  updateForm('address', displayName);
                  updateForm('city', city);
                  updateForm('latitude', lat);
                  updateForm('longitude', lng);
                  
                  if (mapRef.current && markerRef.current) {
                    mapRef.current.setView([lat, lng], 15);
                    markerRef.current.setLatLng([lat, lng]);
                  }
                  
                  setAddressSearch(displayName);
                  setSuggestions([]);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-secondary/50 text-xs transition-colors flex items-start gap-2"
              >
                <MapPin className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                <span className="line-clamp-2">{item.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center gap-2">
        <button 
          onClick={handleGetCurrentLocation} 
          disabled={isFetchingLocation}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors disabled:opacity-50"
        >
          {isFetchingLocation ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Navigation className="w-3.5 h-3.5" />
          )}
          {isFetchingLocation ? 'Fetching location...' : 'Use Current Location'}
        </button>
        <span className="text-[10px] text-muted-foreground">Click map or drag pin to fine-tune</span>
      </div>

      {/* Map Element */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-44 rounded-xl border border-border bg-secondary/30 overflow-hidden z-10" 
      />

      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="text-sm font-medium mb-1 block">Selected Address *</label>
          <textarea 
            rows={2}
            value={form.address} 
            onChange={(e) => updateForm('address', e.target.value)} 
            placeholder="Address location detail..." 
            className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-xs resize-none" 
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">City *</label>
          <input 
            type="text" 
            value={form.city} 
            onChange={(e) => updateForm('city', e.target.value)} 
            placeholder="City Name" 
            className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-xs" 
          />
        </div>
      </div>
    </div>,

    // Step 3: Capacity & Pricing
    <div className="space-y-4" key="capacity">
      <div>
        <label className="text-sm font-medium mb-1 block">{t('createEvent.maxAttendees')}</label>
        <input type="number" value={form.max_attendees} onChange={(e) => updateForm('max_attendees', e.target.value)} placeholder="Leave empty for unlimited" className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
      </div>
      <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
        <span className="text-sm font-medium">{t('createEvent.enableWaitlist')}</span>
        <button onClick={() => updateForm('waitlist_enabled', !form.waitlist_enabled)} className={`w-12 h-7 rounded-full transition-colors ${form.waitlist_enabled ? 'bg-primary' : 'bg-secondary'}`}>
          <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${form.waitlist_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">{t('createEvent.genderRestriction')} *</label>
        <div className="grid grid-cols-2 gap-2">
          {GENDER_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => updateForm('gender_restriction', opt.value)} className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${form.gender_restriction === opt.value ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 border border-border'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">Age Range *</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t('createEvent.minAge')}</label>
            <input type="number" value={form.min_age} onChange={(e) => updateForm('min_age', e.target.value)} min="18" className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t('createEvent.maxAge')}</label>
            <input type="number" value={form.max_age} onChange={(e) => updateForm('max_age', e.target.value)} max="99" className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <label className="text-sm font-medium block">{t('createEvent.pricing')} *</label>
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
            <label className="text-sm font-medium mb-1 block">{t('createEvent.ticketPrice')} (₹) *</label>
            <input type="number" value={form.ticket_price} onChange={(e) => updateForm('ticket_price', e.target.value)} placeholder="0.00" className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
          </div>
        )}
      </div>
    </div>,

    // Step 4: Rules & Publish
    <div className="space-y-4" key="rules">
      <div>
        <label className="text-sm font-medium mb-2 block">{t('createEvent.approvalType')} *</label>
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
          <label className="text-sm font-medium mb-1 block">{t('createEvent.refundPolicy')} *</label>
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
          <button 
            disabled={!isStepValid(step)}
            onClick={() => setStep(step + 1)} 
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('createEvent.next')} <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button 
            onClick={handlePublish} 
            disabled={isSubmitting || !isStepValid(step)} 
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary/25"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('createEvent.publish')}
          </button>
        )}
      </div>
    </div>
  );
}
