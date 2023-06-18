# NOAA weather forecast

Sselect a location on a map and get a weather forecast for that location.

## How to use

0. Open `map.html` in browser.
1. Click on any location within the United States land area (not marine areas) on the map, as NOAA only supports those locations.
2. Click the 'Get Weather' button to retrieve the weather forecast for the selected location.

If you want to "Get World Weather", then you need to go to [OpenWeatherMap](https://openweathermap.org/) and register for a free API key. Then, fill in the line `var apikey = "";` in `world_weather.js`.

## Technologies Used

- [Leaflet](https://leafletjs.com/): An open-source JavaScript library for interactive maps.
- [NOAA's Weather API](https://www.weather.gov/documentation/services-web-api): An API for weather forecasts provided by NOAA.
