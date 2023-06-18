// Global variables
let map;
let marker; // A variable to hold the current marker
let locDiv;

// Normalise the latitude and longitude values 
// if latitude exteends [-90, 90], then clamp it to [-90, 90]
// also, ensure longitude is in range [-180, 180], by first modulo 360,
// then subtract 360 if the result is greater than 180
function normalise (lat, lng) {
    let normalisedLat = lat;
    let normalisedLng = lng;
    if (lat < -90) {
        normalisedLat = -90;
    } else if (lat > 90) {
        normalisedLat = 90;
    }
    normalisedLng = lng % 360;
    if (normalisedLng > 180) {
        normalisedLng -= 360;
    }
    return [normalisedLat, normalisedLng];
}

window.onload = function () {
    locDiv = document.getElementById("location");

    // Initialize the map
    function initMap() {
        map = L.map('map').setView([39.50, -98.35], 4);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(map);

        // Add click event listener to the map
        map.on('click', function (event) {
            var latitude = event.latlng.lat;
            var longitude = event.latlng.lng;

            // If a marker already exists, remove it
            if (marker) {
                map.removeLayer(marker);
            }
            // normalize
            [latitude, longitude] = normalise(latitude, longitude);

            // Add a new marker to the map at the clicked location
            marker = L.marker([latitude, longitude]).addTo(map);

            // round to one decimal place
            longitude = Math.round(longitude * 10) / 10;
            latitude = Math.round(latitude * 10) / 10;
            var message = `You clicked on Longitude: ${longitude}, Latitude: ${latitude}!`;
            locDiv.innerHTML = message;
        });
    }

    // Call the initMap function
    initMap();

    // Add event listener to the "Get American Weather" button
    document.getElementById("getWeather").addEventListener("click", function () {
        if (marker) {
            var latitude = marker.getLatLng().lat;
            var longitude = marker.getLatLng().lng;
            // normalize
            [latitude, longitude] = normalise(latitude, longitude);
            window.location.href = `weather.html?lat=${latitude}&lng=${longitude}`;
        } else {
            alert("Please click on the map to select a location.");
        }
    });

    // Add event listener to the "Get World Weather" button
    document.getElementById("getWorldWeather").addEventListener("click", function () {
        if (marker) {
            var latitude = marker.getLatLng().lat;
            var longitude = marker.getLatLng().lng;
            // normalize
            [latitude, longitude] = normalise(latitude, longitude);
            window.location.href = `world_weather.html?lat=${latitude}&lng=${longitude}`;
        } else {
            alert("Please click on the map to select a location.");
        }
    });
}
