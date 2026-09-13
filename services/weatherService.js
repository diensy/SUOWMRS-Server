import WeatherReading from '../models/WeatherReading.js';

let cachedWeather = null;

export async function initWeatherService() {
  try {
    let reading = await WeatherReading.findOne();
    if (!reading) {
      reading = await WeatherReading.create({
        city: 'Bhubaneswar',
        state: 'Odisha',
        currentRainfallMmPerHour: 34.5,
        rainfallIntensity: 'Heavy',
        forecastRainfallMm: 72.0,
        forecastDurationHours: 6,
        temperatureC: 26.8,
        humidityPct: 91,
        windSpeedKmh: 28,
        cloudCoverPct: 98,
        weatherCondition: 'Monsoon Thunderstorm with Active Inundation Alert',
        hourlyForecast: [
          { hourOffset: 1, rainfallMm: 38.0, probabilityPct: 90, condition: 'Heavy Rain' },
          { hourOffset: 2, rainfallMm: 44.0, probabilityPct: 95, condition: 'Violent Downpour' },
          { hourOffset: 3, rainfallMm: 31.0, probabilityPct: 85, condition: 'Heavy Rain' },
          { hourOffset: 4, rainfallMm: 22.0, probabilityPct: 75, condition: 'Moderate Showers' },
          { hourOffset: 5, rainfallMm: 15.0, probabilityPct: 60, condition: 'Passing Showers' },
          { hourOffset: 6, rainfallMm: 8.0, probabilityPct: 40, condition: 'Overcast' },
        ],
        lastUpdated: new Date(),
      });
      console.log('🌧️ Initialized Phase 7.2 Weather Telemetry & Forecast service!');
    }
    cachedWeather = reading.toObject();
  } catch (err) {
    console.error('Error initializing weather service:', err);
  }
}

export async function getCurrentWeather() {
  try {
    if (cachedWeather) return cachedWeather;
    const reading = await WeatherReading.findOne();
    if (reading) {
      cachedWeather = reading.toObject();
      return cachedWeather;
    }
    return {
      city: 'Bhubaneswar',
      state: 'Odisha',
      currentRainfallMmPerHour: 34.5,
      rainfallIntensity: 'Heavy',
      forecastRainfallMm: 72.0,
      forecastDurationHours: 6,
      temperatureC: 26.8,
      humidityPct: 91,
      windSpeedKmh: 28,
      cloudCoverPct: 98,
      weatherCondition: 'Monsoon Thunderstorm with Active Inundation Alert',
      hourlyForecast: [],
      lastUpdated: new Date(),
    };
  } catch (err) {
    console.error('Failed to get current weather:', err);
    return null;
  }
}

export async function updateWeatherConditions(updates) {
  try {
    const reading = await WeatherReading.findOneAndUpdate(
      {},
      { ...updates, lastUpdated: new Date() },
      { new: true, upsert: true }
    );
    cachedWeather = reading.toObject();
    return cachedWeather;
  } catch (err) {
    console.error('Failed to update weather conditions:', err);
    return null;
  }
}
