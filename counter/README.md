## How to run

Run `docker-compose up` in this folder. Read what the terminal says. When it stops changing, go to `http://localhost:8000`. It should say `Hello World! I have been seen 1 times.`

Now you can refresh it to see the number going up. Now press `Ctrl+C` to shut down the Docker.

If you want to *really* see numbers go up, you can use a command-line tool to hit it with a lot of requests.

I used `wrk`. To install it from source:

```bash
git clone --depth=1 https://github.com/wg/wrk.git
cd wrk
make -j
```

Test that it works by `./wrk -t 6 -c 200 -d 30s --latency https://google.com`. If it doesn't work, then you can try installing `ab` (Apache HTTP server benchmarking tool) or `siege` or some other tools.

If it does work, then 

Run `docker-compose up -d` to run it in the background (so that the terminal doesn't fill up with 10000 lines of `counter-web-1    | 172.21.0.1 - - [...] "GET / HTTP/1.1" 200 -`).

Run `./wrk -t4 -c1000 -d20s http://localhost:8000/`, which would run 4 `wrk` threads, each of which would hit the server with 250 concurrent connectinons (1000 in total). Each concurrent connection would send one new request as soon as the previous one is replied. This should stress the server. Now open `http://localhost:8000` in browser and refresh. It should have significant lag, and the numbers would jump up by a thousand or more, every time you refresh.

## What did we do?

### `requirements.txt`

List of packages needed for the Python file. We need just `flask, redis`.

### `app.py`

This defines a web server that displays a counter that increments every time the page is loaded. It uses `Flask` to define the web server. It uses `Redis` to keep count, which basically is a key-value pair in RAM instead of the hard drive. It's like Python dictionary but faster.

```python
from flask import Flask
from redis import Redis

app = Flask(__name__)
redis = Redis(host='redis', port=6379)
# Redis server, at hostname 'redis' and on port number 6379

@app.route('/') # call this when the root URL '/' is accessed.
def hello():
    count = redis.incr('hits') # increments the value at the key 'hits' in the Redis database
    return 'Hello World! I have been seen {} times.\n'.format(count)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int("5000"), debug=True) 
    # The server listens for all requests to port 5000, no matter which IP address the request is pointing towards.
    # It also prints debug information to console.
```

### `Dockerfile`

Start with a lightweight Linux image (`alpine`) with `Python 3.7` pre-installed. It costs a bit less than 200 MB.

Then, set `/app` as the default directory. All subsequent commands assume that.

`ADD . .` copies the content of this folder into the docker image's `/app` folder.

`RUN pip install -r requirements.txt` installs `Flask, Redis` Python libraries.

`CMD ["python", "app.py"]` means every time the image is run, it automatically runs `python /app/app.py`, thus starting the server.

### `docker-compose.yml`

A `yaml` file that defines 2 services that makes up our application. It is run by `docker-compose up`. It is useful when you want to run several images at once, each image responsible for doing one service, like setting up a company instead of just a single agent.

First is `web`. It is built by the `Dockerfile` in the current directory `.`. Then it is run using port mapping `8000:5000`. This means if you access `localhost:8000` on your machine, you're really accessing port `5000` on the container.

Second is `redis`, which is just `redis:alpine`, a small `alpine` linux preloaded with `Redis`.

```yaml
version: '3'
services:
  web:
    build: .
    ports:
     - "8000:5000"
  redis:
    image: "redis:alpine"
```