import mongoose from 'mongoose';

const weatherReadingSchema = new mongoose.Schema({
  city: { type: String, default: 'Bhubaneswar' },
  state: { type: String, default: 'Odisha' },
  currentRainfallMmPerHour: { type: Number, required: true, default: 28.5 },
  rainfallIntensity: {
    type: String,
    enum: ['None', 'Light', 'Moderate', 'Heavy', 'Violent'],
    default: 'Heavy',
  },
  forecastRainfallMm: { type: Number, required: true, default: 64.0 },
  forecastDurationHours: { type: Number, default: 6 },
  temperatureC: { type: Number, default: 27.2 },
  humidityPct: { type: Number, default: 89 },
  windSpeedKmh: { type: Number, default: 24 },
  cloudCoverPct: { type: Number, default: 95 },
  weatherCondition: { type: String, default: 'Heavy Monsoon Showers with Thunderstorm' },
  hourlyForecast: [
    {
      hourOffset: { type: Number },
      rainfallMm: { type: Number },
      probabilityPct: { type: Number },
      condition: { type: String },
    }
  ],
  lastUpdated: { type: Date, default: Date.now },
});

const WeatherReading = mongoose.model('WeatherReading', weatherReadingSchema);
export default WeatherReading;
