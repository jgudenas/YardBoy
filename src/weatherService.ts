// Weather service using OpenWeatherMap API
// Get free API key at: https://openweathermap.org/api

const OPENWEATHER_API_KEY = (import.meta as any).env?.VITE_OPENWEATHER_API_KEY || '';
const DEFAULT_CITY = (import.meta as any).env?.VITE_DEFAULT_CITY || 'Seattle, WA';

export interface WeatherData {
  temperature: {
    current: number;
    min: number;
    max: number;
  };
  rain: {
    probability: number;
    total: string;
  };
  sunrise: string;
  sunset: string;
  daylightPercent: number;
  description: string;
  icon: string;
}

export interface WeatherError {
  message: string;
  code?: number;
}

class WeatherService {
  private async makeRequest(endpoint: string): Promise<any> {
    if (!OPENWEATHER_API_KEY) {
      throw new Error('OpenWeatherMap API key not configured. Add VITE_OPENWEATHER_API_KEY to your .env file');
    }

    const url = `https://api.openweathermap.org/data/2.5/${endpoint}&appid=${OPENWEATHER_API_KEY}&units=imperial`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Weather API request failed:', error);
      throw error;
    }
  }

  async getCurrentWeather(city: string = DEFAULT_CITY): Promise<WeatherData> {
    try {
      // Get current weather data
      const currentData = await this.makeRequest(`weather?q=${encodeURIComponent(city)}`);
      
      // Get 5-day forecast for rain probability
      const forecastData = await this.makeRequest(`forecast?q=${encodeURIComponent(city)}`);
      
      // Calculate daylight percentage
      const now = new Date();
      const sunrise = new Date(currentData.sys.sunrise * 1000);
      const sunset = new Date(currentData.sys.sunset * 1000);
      const daylightPercent = this.calculateDaylightPercent(now, sunrise, sunset);
      
      // Find today's rain probability from forecast
      const todayForecast = forecastData.list.find((item: any) => {
        const forecastDate = new Date(item.dt * 1000);
        const today = new Date();
        return forecastDate.toDateString() === today.toDateString();
      });
      
      const rainProbability = todayForecast?.pop ? Math.round(todayForecast.pop * 100) : 0;
      const rainTotal = todayForecast?.rain?.['3h'] ? `${(todayForecast.rain['3h'] / 25.4).toFixed(2)}` : '0';
      
      return {
        temperature: {
          current: Math.round(currentData.main.temp),
          min: Math.round(currentData.main.temp_min),
          max: Math.round(currentData.main.temp_max),
        },
        rain: {
          probability: rainProbability,
          total: rainTotal,
        },
        sunrise: sunrise.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        }),
        sunset: sunset.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        }),
        daylightPercent,
        description: currentData.weather[0]?.description || 'Unknown',
        icon: currentData.weather[0]?.icon || '01d',
      };
    } catch (error) {
      console.error('Failed to fetch weather data:', error);
      throw error;
    }
  }

  private calculateDaylightPercent(now: Date, sunrise: Date, sunset: Date): number {
    const totalDaylight = sunset.getTime() - sunrise.getTime();
    const elapsedDaylight = now.getTime() - sunrise.getTime();
    
    if (now < sunrise) return 0;
    if (now > sunset) return 100;
    
    return Math.max(0, Math.min(100, (elapsedDaylight / totalDaylight) * 100));
  }

  // Fallback data when API fails
  getFallbackData(): WeatherData {
    const now = new Date();
    const sunrise = new Date(now);
    sunrise.setHours(6, 20, 0, 0);
    const sunset = new Date(now);
    sunset.setHours(20, 6, 0, 0);
    
    return {
      temperature: { current: 75, min: 63, max: 85 },
      rain: { probability: 0, total: '0' },
      sunrise: '6:20 AM',
      sunset: '8:06 PM',
      daylightPercent: 55,
      description: 'Partly cloudy',
      icon: '02d',
    };
  }
}

export const weatherService = new WeatherService();
