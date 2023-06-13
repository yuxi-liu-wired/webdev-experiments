## How to run

Build a docker image: `docker build -t my-nginx-app .`
* THis builds a docker image according to the `Dockerfile` in the current folder.
* The built image is called `my-nginx-app`.

Instantiate a docker container for that image by  `docker run --detach --publish 8080:80 my-nginx-app`. The `8080:80` part means that any visit to `localhost:8080` would be sent to port `80` of the container.

Now open `localhost:8080` in a browser.

## What did we do?

The Dockerfile starts with `nginx` image, then copies the entire local folder to `/usr/share/nginx/html` in the Docker image, then copies `default.conf` to `/etc/nginx/conf.d/default.conf` in the Docker image.

```dockerfile
FROM nginx
COPY . /usr/share/nginx/html
COPY default.conf /etc/nginx/conf.d/default.conf
```

