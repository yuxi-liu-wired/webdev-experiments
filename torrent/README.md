# View torrent information and peers

Enter a magnet link and get the information about the magnet resource as well as the peers connected.

Uses Flask (Python) and [WebTorrent (javascript)](https://github.com/webtorrent/webtorrent).

## File Structure

* `app.py`: The main Python file that runs the Flask server. Contains the routing and logic for the application.
* `requirements.txt`: Contains a list of Python dependencies that can be installed using pip.
* `/static/js/main.js`: The JavaScript file that contains the logic for interacting with the WebTorrent API on the client side.
* `/templates/index.html`: The HTML file that is rendered when you visit the home page. It contains the basic structure of the web page and includes the JavaScript files.
* `/static/js/webtorrent.min.js`: The minified WebTorrent library that is used to interact with the WebTorrent network.

## Running the Project

`python app.py`, then go to <http://127.0.0.1:5000> in a browser.
