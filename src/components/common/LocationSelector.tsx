import { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Navigation, ChevronDown, Check } from 'lucide-react';
import { INDIAN_DISTRICTS, POPULAR_CITIES } from '@/lib/districts';
import { cn } from '@/lib/utils';

interface LocationSelectorProps {
  value: string;
  onChange: (city: string) => void;
  placeholder?: string;
  showAllIndia?: boolean;
  className?: string;
}

export function LocationSelector({
  value,
  onChange,
  placeholder = 'Select city...',
  showAllIndia = true,
  className
}: LocationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter districts based on search query
  const filteredDistricts = search.trim()
    ? INDIAN_DISTRICTS.filter((city) =>
        city.toLowerCase().includes(search.toLowerCase())
      )
    : INDIAN_DISTRICTS;

  const handleSelect = (city: string) => {
    onChange(city);
    setIsOpen(false);
    setSearch('');
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      onChange('Current Location');
      setIsOpen(false);
      setSearch('');
    } else {
      alert('Geolocation is not supported by your browser');
    }
  };

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold bg-secondary/50 border border-border rounded-full text-foreground hover:bg-secondary cursor-pointer transition-all focus:outline-none focus:ring-1 focus:ring-primary min-w-[120px]"
      >
        <div className="flex items-center gap-1.5 truncate">
          <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <span className="truncate">{value || (showAllIndia ? 'All India' : placeholder)}</span>
        </div>
        <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-72 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col max-h-96">
          {/* Search Input */}
          <div className="p-3 border-b border-border relative flex items-center">
            <Search className="w-4 h-4 text-muted-foreground absolute left-6" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search district places..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-secondary/50 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground text-foreground"
              autoFocus
            />
          </div>

          {/* List Scrollable Content */}
          <div className="overflow-y-auto flex-1 p-2 space-y-3 custom-scrollbar">
            {/* GPS Selection */}
            {!search && (
              <button
                type="button"
                onClick={handleGetCurrentLocation}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-primary/5 text-primary text-xs font-bold transition-colors text-left"
              >
                <Navigation className="w-4 h-4" />
                Use Current Location
              </button>
            )}

            {/* Main Options */}
            {!search && (
              <div className="space-y-1.5">
                {showAllIndia && (
                  <button
                    type="button"
                    onClick={() => handleSelect('')}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors",
                      value === '' ? "bg-primary/10 text-primary font-semibold" : "hover:bg-secondary/60 text-foreground"
                    )}
                  >
                    <span>All India</span>
                    {value === '' && <Check className="w-3.5 h-3.5" />}
                  </button>
                )}

                {/* Popular Cities */}
                <div>
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-1">
                    Popular Cities
                  </h4>
                  <div className="grid grid-cols-2 gap-1 p-1">
                    {POPULAR_CITIES.map((city) => (
                      <button
                        key={city}
                        type="button"
                        onClick={() => handleSelect(city)}
                        className={cn(
                          "px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left truncate",
                          value === city ? "bg-primary/10 text-primary font-semibold" : "hover:bg-secondary/60 text-foreground"
                        )}
                      >
                        {city}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Districts List */}
            <div className="space-y-1">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-1">
                {search ? 'Matching Districts' : 'All District Places'}
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                {filteredDistricts.length > 0 ? (
                  filteredDistricts.map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSelect(city); }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors text-left",
                        value === city ? "bg-primary/10 text-primary font-semibold" : "hover:bg-secondary/60 text-foreground"
                      )}
                    >
                      <span className="truncate">{city}</span>
                      {value === city && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                    </button>
                  ))
                ) : (
                  <p className="text-center text-xs text-muted-foreground py-4">
                    No districts found
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
