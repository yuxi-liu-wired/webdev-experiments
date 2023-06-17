// Prompt the user for latitude and longitude
const urlParams = new URLSearchParams(window.location.search);
const latitude = urlParams.get('lat');
const longitude = urlParams.get('lng');

// Construct the URL to retrieve the forecast URL
var pointsURL = "https://api.weather.gov/points/" + latitude + "," + longitude;

// Make a request to retrieve the forecast URL

fetch(pointsURL)
    .then(response => {
        if (!response.ok) {
            // First, we convert the non-ok HTTP response to JSON
            return response.json().then(err => {
                // Then we throw an Error with the title from the JSON body
                throw new Error(err.title);
            });
        }
        return response.json();
    })
    .then(data => {
        var forecastURL = data.properties.forecast;

        fetch(forecastURL)
            .then(response => {
                if (!response.ok) {
                    // Again, we convert the non-ok HTTP response to JSON
                    return response.json().then(err => {
                        // Then we throw an Error with the title from the JSON body
                        throw new Error(err.title);
                    });
                }
                return response.json();
            })
            .then(data => {
                // Now that we have our data, let's display it
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
            })
            .catch(error => {
                console.error("Error retrieving forecast data:", error);
                document.getElementById("weather").innerHTML = `Error: ${error.message}`;
            });
    })
    .catch(error => {
        console.error("Error retrieving forecast URL:", error);
        document.getElementById("weather").innerHTML = `Error: ${error.message}`;
    });
