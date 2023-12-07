# Webdev Experiments

My experiments with Nginx, Docker, and Python web hosting.

Each folder is a standalone project and contains its own `README.md` which describes how to run it, and how it works.

To run the projects:

* Install [Docker Desktop](https://www.docker.com/products/docker-desktop/).
* Run `git clone https://github.com/yuxiliu1995/webdev-experiments.git`.
* Go into each folder and follow the `README.md` within.

Table of contents:

* [`hello`](./hello/): A website that shows `Hello World!`.
* [`counter`](./counter/)
: Counts how many times it is hit by HTTP requests and displays it on the webpage.
* [`reverse-proxy`](./reverse-proxy/): Performs [reverse proxying](https://en.wikipedia.org/wiki/Reverse_proxy), with two servers on the backend. One takes 2/3 of the load, and the other 1/3. It also does [caching](https://en.wikipedia.org/wiki/Web_cache) for 2 seconds.
* [`wsgi`](./wsgi/): An attempt at recreating [WSGI](https://en.wikipedia.org/wiki/Web_Server_Gateway_Interface) according to [WSGI for Web Developers (Ryan Wilson-Perkin) - YouTube](https://www.youtube.com/watch?v=WqrCnVAkLIo).
* [`doublestroop`](./doublestroop/): A website that serves a double [Stroop test](https://en.wikipedia.org/wiki/Stroop_effect) puzzle, and checks the user's answers. It uses [Flask](https://flask.palletsprojects.com/en/1.1.x/).
* [`weather`](./weather/): Select a location on a map and get a weather forecast for that location. It uses [Leaflet](https://leafletjs.com/) for rendering the map, and [NOAA](https://www.weather.gov/documentation/services-web-api) or [OpenWeatherMap](https://openweathermap.org/) for retrieving the weather forecast by an API call.
* [`torrent`](./torrent/): Enter a magnet link and get the information about the magnet resource as well as the peers connected. It uses [Flask](https://flask.palletsprojects.com/en/1.1.x/) and [WebTorrent (javascript)](https://github.com/webtorrent/webtorrent).
* [`docker`](./docker/): Something rather low-level: how to use TCP ports. It has two [Docker](https://www.docker.com/) engines that create two containers. The first one, `Dockerfile_telnet`, creates a container that runs a telnet server. The second one, `Dockerfile`, creates a container that runs a `ssh` server. The `README.md` in the folder describes how to connect to the `ssh` server from the localhost machine, and how you can create the world's smallest webserver using `nc` and `bash` that is listening on a port 80, then tunnel it out of the container into the localhost port.
* [`opossum search`](./opossum_search
/): I saw it in Google Gemini's paper and figured it's worth a try.