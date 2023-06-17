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