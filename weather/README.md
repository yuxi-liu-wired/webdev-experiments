# Weather forecast

Select a location on a map and get a weather forecast for that location.

## How to use

0. Open `map.html` in browser.
1. Click on any location within the United States land area (not marine areas) on the map, as NOAA only supports those locations.
2. Click the 'Get Weather' button to retrieve the weather forecast for the selected location.

If you want to "Get World Weather", then you need to go to [OpenWeatherMap](https://openweathermap.org/) and register for a free API key. Then, fill in the line `var apikey = "";` in `world_weather.js`.

## How it works

- [Leaflet](https://leafletjs.com/): An open-source JavaScript library for interactive maps.
- [NOAA's Weather API](https://www.weather.gov/documentation/services-web-api): An API for weather forecasts provided by NOAA. It works for US locations only.
- [OpenWeatherMap](https://openweathermap.org/): An API for weather forecasts provided by OpenWeatherMap. It works for locations all over the world. However, you need to register for a free API key to use it.

When you open `weather.html`, you will see a map rendered by Leaflet. When you click on the map, the latitude and longitude of the clicked location are retrieved by Leaflet. 

Clicking on the button then activates `map.js`, which opens a url to one of the two further `html` files, either `weather.html` or `world_weather.html`. The url contains the latitude and longitude of the clicked location.

Then the corresponding `js` script reads the latitude and longitude from the url, retrieves the weather for the location via the API, renders them into `html` code, and inserts them into the page by `innerHTML`.

For example, the business code in `weather.js` is as follows:

```js
var weatherDiv = document.getElementById("weather");
var htmlContent = "";

// Loop through all periods
data.properties.periods.forEach(period => {
    htmlContent += "<h2>" + period.name + "</h2>";
    htmlContent += "<img src='" + period.icon + "' alt='Weather icon'>";
    var cellTemp = 0;
    if (period.temperatureUnit === "F") {
        var cellTemp = (period.temperature - 32) * (5 / 9);
    } else {
        cellTemp = period.temperature;
    }
    // round to one decimal place
    cellTemp = Math.round(cellTemp * 10) / 10;

    htmlContent += "<p>Temperature: " + cellTemp + " &deg;C</p>";
    htmlContent += "<p>Wind: " + period.windSpeed + " " + period.windDirection + "</p>";
    htmlContent += "<p>Forecast: " + period.shortForecast + "</p>";
    htmlContent += "<p>Details: " + period.detailedForecast + "</p>";
    htmlContent += "<hr>"; // a horizontal line for separating periods
});

// Insert the new HTML content into the weatherDiv
weatherDiv.innerHTML = htmlContent;
```