import { useState, useEffect } from 'react';
import type React from 'react';
import { Button, Input, Label, Badge, Card, CardContent, CardHeader, CardTitle, CardDescription } from '@extension/ui';
import { Search, MapPin, Globe, Check, Briefcase } from 'lucide-react';
import { cn } from '@extension/ui';
import type { Platform, PlatformId } from '@extension/types';
import type { SearchConfig } from '../hooks/useJobJourneyState';
import { COUNTRIES, PLATFORMS } from '../constants';
import { useToast } from './ToastManager';

interface SearchSectionProps {
  onStartSearch: (config: SearchConfig) => void;
  isAuthenticated: boolean;
}

// localStorage keys for saving preferences
const STORAGE_KEYS = {
  KEYWORDS: 'jobjourney_keywords',
  COUNTRY: 'jobjourney_country',
  LOCATION: 'jobjourney_location',
  PLATFORMS: 'jobjourney_platforms',
};

export const SearchSection: React.FC<SearchSectionProps> = ({ onStartSearch, isAuthenticated }) => {
  const { showToast } = useToast();
  const [keywords, setKeywords] = useState('');
  const [country, setCountry] = useState('');
  const [location, setLocation] = useState('');
  const [platforms, setPlatforms] = useState<Partial<Record<PlatformId, boolean>>>({});
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);

  const selectedCountryConfig = country ? COUNTRIES[country] : null;
  const availableLocations = selectedCountryConfig?.locations || [];
  const availablePlatforms = (selectedCountryConfig?.platforms || []).filter(
    id => !(PLATFORMS[id] && PLATFORMS[id].enabled === false),
  );

  // Check if form is valid
  const isFormValid = () => {
    const hasKeywords = keywords.trim().length > 0;
    const hasCountry = country.length > 0;
    const hasLocation = location.length > 0;
    const hasSelectedPlatforms = Object.values(platforms).some(checked => checked);

    return hasKeywords && hasCountry && hasLocation && hasSelectedPlatforms && isAuthenticated;
  };

  // Load saved preferences
  useEffect(() => {
    const loadSavedPreferences = () => {
      try {
        const savedKeywords = localStorage.getItem(STORAGE_KEYS.KEYWORDS);
        const savedCountry = localStorage.getItem(STORAGE_KEYS.COUNTRY);
        const savedLocation = localStorage.getItem(STORAGE_KEYS.LOCATION);
        localStorage.removeItem(STORAGE_KEYS.PLATFORMS); // Reset platforms

        if (savedKeywords) setKeywords(savedKeywords);
        if (savedCountry && COUNTRIES[savedCountry]) setCountry(savedCountry);
        if (savedLocation) setLocation(savedLocation);

        setHasLoadedInitialData(true);
      } catch (error) {
        console.warn('Failed to load saved preferences:', error);
        setHasLoadedInitialData(true);
      }
    };
    loadSavedPreferences();
  }, []);

  // Save preferences effects
  useEffect(() => {
    if (keywords) localStorage.setItem(STORAGE_KEYS.KEYWORDS, keywords);
  }, [keywords]);

  useEffect(() => {
    if (country) localStorage.setItem(STORAGE_KEYS.COUNTRY, country);
  }, [country]);

  useEffect(() => {
    if (location) localStorage.setItem(STORAGE_KEYS.LOCATION, location);
  }, [location]);

  useEffect(() => {
    if (Object.keys(platforms).length > 0) {
      localStorage.setItem(STORAGE_KEYS.PLATFORMS, JSON.stringify(platforms));
    }
  }, [platforms]);

  // Update platforms when country changes
  useEffect(() => {
    if (!hasLoadedInitialData) return;

    const currentCountryConfig = country ? COUNTRIES[country] : null;

    if (country && currentCountryConfig) {
      const savedPlatforms = localStorage.getItem(STORAGE_KEYS.PLATFORMS);
      const nextAvailablePlatforms = currentCountryConfig.platforms.filter(
        id => !(PLATFORMS[id] && PLATFORMS[id].enabled === false),
      );

      setPlatforms(previousPlatforms => {
        let currentPlatforms: Partial<Record<PlatformId, boolean>> = previousPlatforms;

        try {
          currentPlatforms = savedPlatforms ? JSON.parse(savedPlatforms) : previousPlatforms;
        } catch {
          currentPlatforms = previousPlatforms;
        }

        const newPlatforms: Partial<Record<PlatformId, boolean>> = {};
        nextAvailablePlatforms.forEach(platformId => {
          newPlatforms[platformId] = currentPlatforms[platformId] !== undefined ? currentPlatforms[platformId] : true;
        });

        // Reset invalid platforms
        (Object.keys(PLATFORMS) as PlatformId[]).forEach(platformId => {
          if (!currentCountryConfig.platforms.includes(platformId)) {
            newPlatforms[platformId] = false;
          }
        });

        return newPlatforms;
      });

      // Validate location
      const savedLocation = localStorage.getItem(STORAGE_KEYS.LOCATION);
      if (savedLocation && currentCountryConfig.locations.includes(savedLocation)) {
        setLocation(savedLocation);
      } else {
        setLocation('');
      }
    } else if (!country) {
      // Initialize all platforms if no country
      const allPlatforms: Partial<Record<PlatformId, boolean>> = {};
      (Object.keys(PLATFORMS) as PlatformId[]).forEach(id => (allPlatforms[id] = true));
      setPlatforms(allPlatforms);
    }
  }, [country, hasLoadedInitialData]);

  const togglePlatform = (platformId: PlatformId) => {
    setPlatforms(prev => ({
      ...prev,
      [platformId]: !prev[platformId],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;

    const selectedPlatforms = (Object.entries(platforms) as [PlatformId, boolean | undefined][])
      .filter(([, checked]) => checked)
      .map(([id]) => id);

    const config: SearchConfig = {
      keywords: keywords.trim(),
      platforms: selectedPlatforms,
      country,
      location: location.trim(),
    };

    showToast('info', 'Starting Search', `Searching for "${keywords}" on ${selectedPlatforms.length} platforms`, 3000);
    onStartSearch(config);
  };

  return (
    <Card className="flex h-full flex-col border-0 shadow-none">
      <CardHeader className="px-0 pb-2 pt-0">
        <CardTitle className="text-base font-semibold tracking-tight">Search for Jobs</CardTitle>
        <CardDescription className="text-xs">Enter your preferences to find the best opportunities.</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col px-0 pb-0">
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col space-y-4">
          <div className="space-y-2">
            <Label
              htmlFor="keywords"
              className="text-muted-foreground flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
              <Briefcase className="h-3 w-3" /> Job Title / Keywords
            </Label>
            <Input
              id="keywords"
              placeholder="e.g. Frontend Developer, React"
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label
                htmlFor="country"
                className="text-muted-foreground flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                <Globe className="h-3 w-3" /> Country
              </Label>
              <div className="relative">
                <select
                  id="country"
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  className="border-input bg-background ring-offset-background focus:ring-ring w-full appearance-none rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ height: '36px' }}>
                  <option value="" disabled>
                    Select...
                  </option>
                  {Object.entries(COUNTRIES).map(([code, config]) => (
                    <option key={code} value={code}>
                      {config.icon} {config.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="location"
                className="text-muted-foreground flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                <MapPin className="h-3 w-3" /> Location
              </Label>
              <div className="relative">
                <select
                  id="location"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  disabled={!country}
                  className="border-input bg-background ring-offset-background focus:ring-ring w-full appearance-none rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ height: '36px' }}>
                  <option value="" disabled>
                    {!country ? 'Select Country' : 'Select...'}
                  </option>
                  {availableLocations.map(loc => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
              Select Platforms
            </Label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(PLATFORMS) as [PlatformId, Platform][]).map(([platformId, platform]) => {
                const isAvailable = !country || availablePlatforms.includes(platformId);
                if (!isAvailable) return null;

                const isChecked = platforms[platformId] || false;

                return (
                  <Badge
                    key={platformId}
                    variant={isChecked ? 'default' : 'outline'}
                    className={cn(
                      'cursor-pointer select-none gap-1 px-3 py-1.5 text-xs font-medium transition-all hover:opacity-80 active:scale-95',
                      isChecked
                        ? 'bg-primary text-primary-foreground border-transparent shadow-sm'
                        : 'text-muted-foreground hover:bg-secondary bg-transparent',
                      !isAvailable && 'cursor-not-allowed opacity-50',
                    )}
                    onClick={() => isAvailable && togglePlatform(platformId)}>
                    {isChecked && <Check className="h-3 w-3" />}
                    <span>{platform.icon}</span>
                    <span>{platform.name}</span>
                  </Badge>
                );
              })}
            </div>
            {country && (
              <p className="text-muted-foreground mt-1 text-right text-[10px]">
                * Showing platforms available in {COUNTRIES[country]?.name}
              </p>
            )}
          </div>

          <div className="mt-auto pt-4">
            <Button
              type="submit"
              className="w-full text-sm font-semibold shadow-sm"
              size="default"
              disabled={!isAuthenticated || !isFormValid()}>
              {!isAuthenticated ? 'Sign In to Search' : 'Start Searching'}
              {isAuthenticated && <Search className="ml-2 h-4 w-4" />}
            </Button>
          </div>

          {!isAuthenticated && (
            <p className="text-muted-foreground text-center text-xs">Please sign in to enable job search.</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
};
