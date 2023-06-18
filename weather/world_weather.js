// Prompt the user for latitude and longitude
const urlParams = new URLSearchParams(window.location.search);
const latitude = urlParams.get('lat');
const longitude = urlParams.get('lng');

// Make a request to retrieve the location name
var locationURL = "https://geocode.maps.co/reverse?lat=" + latitude + "&lon=" + longitude;
fetch(locationURL)
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        var locationName = data.display_name;
        var locationDiv = document.getElementById("location");
        locationDiv.innerHTML = locationName;
    })
    .catch(error => {
        console.error('Error:', error);
    });

// Make a request to retrieve the forecast URL
var apikey = "2d5672b6edee932debbc47e20026124c";
var forecastURL = "https://api.openweathermap.org/data/2.5/forecast?units=metric&lat=" + latitude + "&lon=" + longitude + "&appid=" + apikey;

fetch(forecastURL)
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.message);
            });
        }
        return response.json();
    })
    .then(data => {
        var weatherDiv = document.getElementById("weather");
        var htmlContent = "";

        data.list.forEach(period => {
            var date = new Date(period.dt * 1000); // UNIX timestamp is in seconds, JavaScript Date object expects milliseconds

            htmlContent += "<h2>" + date.toLocaleString() + "</h2>";
            htmlContent += "<img src='http://openweathermap.org/img/w/" + period.weather[0].icon + ".png' alt='Weather icon'>";

            var tempCelsius = period.main.temp;
            tempCelsius = Math.round(tempCelsius * 10) / 10; // Round to one decimal place

            htmlContent += "<p>Temperature: " + tempCelsius + " &deg;C</p>";
            htmlContent += "<p>Wind: " + period.wind.speed + " m/s, " + period.wind.deg + " degrees direction</p>";
            htmlContent += "<p>Forecast: " + period.weather[0].main + ", " + period.weather[0].description + "</p>";
            htmlContent += "<hr>"; // a horizontal line for separating periods
        });

        weatherDiv.innerHTML = htmlContent;
    })
    .catch(error => {
        console.error("Error retrieving forecast data:", error);
        document.getElementById("weather").innerHTML = `Error: ${error.message}`;
    });
