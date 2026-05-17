import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/utils/logger";

interface CurrentWeather {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  icon: string;
  city: string;
}

interface ForecastItem {
  day: string;
  high: number;
  low: number;
  condition: string;
  icon: string;
}

export const useWeatherData = () => {
  const { toast } = useToast();
  const [currentWeather, setCurrentWeather] = useState<CurrentWeather>({
    temperature: 72,
    condition: "Partly Cloudy",
    humidity: 65,
    windSpeed: 8,
    icon: "🌤️",
    city: "Getting location...",
  });

  const [forecast, setForecast] = useState<ForecastItem[]>([
    { day: "Today", high: 75, low: 62, condition: "Partly Cloudy", icon: "🌤️" },
    { day: "Tomorrow", high: 78, low: 65, condition: "Sunny", icon: "☀️" },
    { day: "Wednesday", high: 73, low: 58, condition: "Rainy", icon: "🌧️" },
    { day: "Thursday", high: 69, low: 55, condition: "Cloudy", icon: "☁️" },
    { day: "Friday", high: 76, low: 63, condition: "Sunny", icon: "☀️" },
  ]);

  const [weatherLoading, setWeatherLoading] = useState(true);

  const fetchWeatherData = async () => {
    setWeatherLoading(true);

    if (!navigator.geolocation) {
      toast({
        title: "Error",
        description: "Geolocation is not supported by this browser.",
        variant: "destructive",
      });
      setWeatherLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          const response = await fetch('/api/weather', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude, longitude }),
          });

          if (!response.ok) {
            throw new Error('Weather API error');
          }

          const data = await response.json();

          if (data) {
            setCurrentWeather({
              ...data.current,
              city: data.current.city,
            });
            setForecast(data.forecast);
          }
        } catch (error) {
          logger.error('Error fetching weather:', error);
          toast({
            title: "Weather Error",
            description: "Failed to get weather information.",
            variant: "destructive",
          });
        }

        setWeatherLoading(false);
      },
      (error) => {
        let errorMessage = "Unable to retrieve your location.";

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied. Please enable location permissions.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out.";
            break;
        }

        toast({
          title: "Location Error",
          description: errorMessage,
          variant: "destructive",
        });

        setWeatherLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  const fetchAllWeatherData = async () => {
    setWeatherLoading(true);

    if (!navigator.geolocation) {
      toast({
        title: "Error",
        description: "Geolocation is not supported by this browser.",
        variant: "destructive",
      });
      setWeatherLoading(false);
      return [];
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;

          const locations = [
            { latitude, longitude, name: "Current Location" },
            { latitude: 40.7128, longitude: -74.0060, name: "New York" },
            { latitude: 25.7617, longitude: -80.1918, name: "Miami" },
            { latitude: 47.6062, longitude: -122.3321, name: "Seattle" },
            { latitude: 34.0522, longitude: -118.2437, name: "Los Angeles" },
            { latitude: 41.8781, longitude: -87.6298, name: "Chicago" },
          ];

          try {
            const response = await fetch('/api/weather', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ locations }),
            });

            if (!response.ok) {
              throw new Error('Weather API error');
            }

            const data = await response.json();

            if (data && data.locations) {
              const currentLocationData = data.locations.find((loc: any) => loc.location === "Current Location");
              if (currentLocationData && !currentLocationData.error) {
                setCurrentWeather({
                  ...currentLocationData.current,
                  city: currentLocationData.current.city,
                });
                setForecast(currentLocationData.forecast);
              }

              setWeatherLoading(false);
              resolve(data.locations);
            }
          } catch (error) {
            logger.error('Error fetching weather:', error);
            toast({
              title: "Weather Error",
              description: "Failed to get weather information.",
              variant: "destructive",
            });
            setWeatherLoading(false);
            reject(error);
          }
        },
        (error) => {
          let errorMessage = "Unable to retrieve your location.";

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Location access denied. Please enable location permissions.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location information is unavailable.";
              break;
            case error.TIMEOUT:
              errorMessage = "Location request timed out.";
              break;
          }

          toast({
            title: "Location Error",
            description: errorMessage,
            variant: "destructive",
          });

          setWeatherLoading(false);
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  };

  useEffect(() => {
    fetchWeatherData();
  }, []);

  return {
    currentWeather,
    forecast,
    weatherLoading,
    fetchWeatherData,
    fetchAllWeatherData,
  };
};
