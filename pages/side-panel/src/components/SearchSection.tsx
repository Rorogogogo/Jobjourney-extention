import { useToast } from './ToastManager';
import { COUNTRIES, PLATFORMS } from '../constants';
import { useState, useEffect } from 'react';
import type React from 'react';

interface SearchSectionProps {
  onStartSearch: (config: SearchConfig) => void;
  isAuthenticated: boolean;
}

interface SearchConfig {
  keywords: string;
  location?: string;
  country?: string;
  platforms: string[];
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
  const [platforms, setPlatforms] = useState<Record<string, boolean>>({});
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);

  const selectedCountryConfig = country ? COUNTRIES[country] : null;
  const availableLocations = selectedCountryConfig?.locations || [];
  const availablePlatforms = selectedCountryConfig?.platforms || [];

  // Check if form is valid for enabling the Discover Jobs button
  const isFormValid = () => {
    const hasKeywords = keywords.trim().length > 0;
    const hasCountry = country.length > 0;
    const hasLocation = location.length > 0;
    const hasSelectedPlatforms = Object.values(platforms).some(checked => checked);

    return hasKeywords && hasCountry && hasLocation && hasSelectedPlatforms && isAuthenticated;
  };

  // Load saved preferences on component mount
  useEffect(() => {
    const loadSavedPreferences = () => {
      try {
        const savedKeywords = localStorage.getItem(STORAGE_KEYS.KEYWORDS);
        const savedCountry = localStorage.getItem(STORAGE_KEYS.COUNTRY);
        const savedLocation = localStorage.getItem(STORAGE_KEYS.LOCATION);
        const savedPlatforms = localStorage.getItem(STORAGE_KEYS.PLATFORMS);

        if (savedKeywords) {
          setKeywords(savedKeywords);
        }

        if (savedCountry && COUNTRIES[savedCountry]) {
          setCountry(savedCountry);
        }

        if (savedLocation) {
          setLocation(savedLocation);
        }

        if (savedPlatforms) {
          try {
            const platformsData = JSON.parse(savedPlatforms);
            if (typeof platformsData === 'object' && platformsData !== null) {
              setPlatforms(platformsData);
            }
          } catch (e) {
            console.warn('Failed to parse saved platforms:', e);
          }
        }

        console.log('📱 Loaded saved search preferences');
        setHasLoadedInitialData(true);
      } catch (error) {
        console.warn('Failed to load saved preferences:', error);
        setHasLoadedInitialData(true);
      }
    };

    loadSavedPreferences();
  }, []);

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    if (keywords) {
      localStorage.setItem(STORAGE_KEYS.KEYWORDS, keywords);
    }
  }, [keywords]);

  useEffect(() => {
    if (country) {
      localStorage.setItem(STORAGE_KEYS.COUNTRY, country);
    }
    // Don't remove country from localStorage when it becomes empty during re-renders
    // Only remove if user explicitly clears it
  }, [country]);

  useEffect(() => {
    if (location) {
      localStorage.setItem(STORAGE_KEYS.LOCATION, location);
    }
    // Don't remove location from localStorage when it becomes empty during re-renders
    // Only remove if user explicitly clears it
  }, [location]);

  useEffect(() => {
    // Only save to localStorage if platforms object is not empty
    if (Object.keys(platforms).length > 0) {
      console.log('🔄 Saving platforms to localStorage:', platforms);
      localStorage.setItem(STORAGE_KEYS.PLATFORMS, JSON.stringify(platforms));
    }
  }, [platforms]);

  // Update platforms when country changes
  useEffect(() => {
    // Skip this effect on initial load
    if (!hasLoadedInitialData) return;

    console.log('🌍 Country effect running, country:', country, 'hasLoadedInitialData:', hasLoadedInitialData);

    if (country && selectedCountryConfig) {
      // Get saved platforms or current state
      const savedPlatforms = localStorage.getItem(STORAGE_KEYS.PLATFORMS);
      let currentPlatforms: Record<string, boolean> = {};

      if (savedPlatforms) {
        try {
          currentPlatforms = JSON.parse(savedPlatforms);
        } catch (e) {
          currentPlatforms = platforms;
        }
      } else {
        currentPlatforms = platforms;
      }

      const newPlatforms: Record<string, boolean> = {};

      // For platforms available in this country, preserve user's selection
      selectedCountryConfig.platforms.forEach(platformId => {
        newPlatforms[platformId] = currentPlatforms[platformId] !== undefined ? currentPlatforms[platformId] : true;
      });

      // Disable all other platforms (not available in this country)
      Object.keys(PLATFORMS).forEach(platformId => {
        if (!selectedCountryConfig.platforms.includes(platformId)) {
          newPlatforms[platformId] = false;
        }
      });

      setPlatforms(newPlatforms);

      // Only reset location if it's not available in the new country
      const savedLocation = localStorage.getItem(STORAGE_KEYS.LOCATION);
      if (savedLocation && selectedCountryConfig.locations.includes(savedLocation)) {
        setLocation(savedLocation);
      } else {
        setLocation(''); // Reset location when country changes
      }
    } else if (!country) {
      console.log('🌍 No country selected, checking saved platforms');
      // If no country selected, check if we have saved platforms
      const savedPlatforms = localStorage.getItem(STORAGE_KEYS.PLATFORMS);
      console.log('📱 Saved platforms from localStorage:', savedPlatforms);
      if (savedPlatforms) {
        try {
          const platformsData = JSON.parse(savedPlatforms);
          if (typeof platformsData === 'object' && platformsData !== null) {
            setPlatforms(platformsData);
          }
        } catch (e) {
          // Fallback: enable all platforms only if no saved state
          const allPlatforms: Record<string, boolean> = {};
          Object.keys(PLATFORMS).forEach(platformId => {
            allPlatforms[platformId] = true;
          });
          setPlatforms(allPlatforms);
        }
      } else {
        // First time: enable all platforms
        const allPlatforms: Record<string, boolean> = {};
        Object.keys(PLATFORMS).forEach(platformId => {
          allPlatforms[platformId] = true;
        });
        setPlatforms(allPlatforms);
      }
    }
  }, [country, hasLoadedInitialData]); // Only run after initial load

  const handlePlatformChange = (platformId: string, checked: boolean) => {
    setPlatforms(prev => {
      const updated = {
        ...prev,
        [platformId]: checked,
      };
      // Save platforms selection to localStorage
      localStorage.setItem(STORAGE_KEYS.PLATFORMS, JSON.stringify(updated));
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedPlatforms = Object.entries(platforms)
      .filter(([_, checked]) => checked)
      .map(([id, _]) => id);

    if (selectedPlatforms.length === 0) {
      alert('Please select at least one platform');
      return;
    }

    if (!keywords.trim()) {
      alert('Please enter job keywords');
      return;
    }

    const finalLocation = location.trim();

    const config: SearchConfig = {
      keywords: keywords.trim(),
      platforms: selectedPlatforms,
    };

    if (country) config.country = country;
    if (finalLocation) config.location = finalLocation;

    // Show toast notification
    showToast(
      'info',
      'Job Search Started',
      `Searching for "${keywords.trim()}" on ${selectedPlatforms.length} platform${selectedPlatforms.length > 1 ? 's' : ''}`,
      3000,
    );

    onStartSearch(config);
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Search for jobs (e.g. Software Engineer)"
            value={keywords}
            onChange={e => setKeywords(e.target.value)}
            required
            className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-3 text-sm text-white transition-all duration-300 placeholder:text-white/60 focus:border-white/40 focus:bg-white/10 focus:outline-none"
          />
        </div>

        <div className="mb-2">
          <select
            value={country}
            onChange={e => setCountry(e.target.value)}
            className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-3 text-sm text-white transition-all duration-300 focus:border-white/40 focus:bg-white/10 focus:outline-none">
            <option value="" className="bg-gray-800 text-white">
              🌍 Select Country
            </option>
            {Object.entries(COUNTRIES).map(([code, countryConfig]) => (
              <option key={code} value={code} className="bg-gray-800 text-white">
                {countryConfig.icon} {countryConfig.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-2">
          <select
            value={location}
            onChange={e => setLocation(e.target.value)}
            disabled={!country || availableLocations.length === 0}
            className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-3 text-sm text-white transition-all duration-300 focus:border-white/40 focus:bg-white/10 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50">
            <option value="" className="bg-gray-800 text-white">
              {!country
                ? 'Select country first'
                : availableLocations.length === 0
                  ? 'No locations available'
                  : 'Select location (optional)'}
            </option>
            {availableLocations.map(loc => (
              <option key={loc} value={loc} className="bg-gray-800 text-white">
                {loc}
              </option>
            ))}
          </select>
        </div>

        {/* Platform Selection */}
        <div className="my-3">
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(PLATFORMS).map(([platformId, platform]) => {
              const isAvailable = !country || availablePlatforms.includes(platformId);
              const isChecked = platforms[platformId] || false;

              return (
                <label
                  key={platformId}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-all duration-300 ${
                    isAvailable
                      ? 'border-white/20 bg-white/5 text-white hover:border-white/30 hover:bg-white/10'
                      : 'cursor-not-allowed border-white/10 bg-white/5 text-white/50 opacity-50'
                  }`}>
                  <input
                    type="checkbox"
                    checked={isChecked && isAvailable}
                    onChange={e => handlePlatformChange(platformId, e.target.checked)}
                    disabled={!isAvailable}
                    className="m-0 w-auto"
                  />
                  {platform.icon} {platform.name}
                </label>
              );
            })}
          </div>
          {country && (
            <p className="mt-2 text-xs text-white/60">
              Platforms available in {selectedCountryConfig?.icon} {selectedCountryConfig?.name}
            </p>
          )}
        </div>

        {/* Search Button */}
        <button
          type="submit"
          disabled={!isFormValid()}
          className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-none px-4 py-3 text-sm font-semibold transition-all duration-300 enabled:bg-gradient-to-r enabled:from-blue-600 enabled:to-blue-700 enabled:text-white enabled:hover:from-blue-700 enabled:hover:to-blue-800 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/50">
          <span>
            {!isAuthenticated
              ? 'Sign In Required'
              : !keywords.trim()
                ? 'Enter Job Keywords'
                : !country
                  ? 'Select Country'
                  : !location
                    ? 'Select Location'
                    : !Object.values(platforms).some(checked => checked)
                      ? 'Select Platform'
                      : 'Discover Jobs'}
          </span>
          <span>🚀</span>
        </button>

        {!isFormValid() && (
          <div className="mt-2 text-center text-xs text-white/70">
            {!isAuthenticated ? (
              <p>Please sign in to JobJourney to start searching for jobs</p>
            ) : (
              <div className="space-y-1">
                <p>Complete the form to start job search:</p>
                <div className="flex flex-wrap justify-center gap-2 text-xs">
                  {!keywords.trim() && <span className="rounded bg-white/10 px-2 py-1">🔍 Job title</span>}
                  {!country && <span className="rounded bg-white/10 px-2 py-1">🌍 Country</span>}
                  {!location && <span className="rounded bg-white/10 px-2 py-1">📍 Location</span>}
                  {!Object.values(platforms).some(checked => checked) && (
                    <span className="rounded bg-white/10 px-2 py-1">⚡ Platform</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </form>

      {/* Preferences saved indicator */}
      <div className="mt-2 text-center text-xs text-white/50">💾 Your search preferences are automatically saved</div>
    </div>
  );
};
