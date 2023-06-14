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
* [`wsgi`](./wsgi/): An attempt at recreating [WSGI](https://en.wikipedia.org/wiki/Web_Server_Gateway_Interface) according to [WSGI for Web Developers (Ryan Wilson-Perkin) - YouTube](https://www.youtube.com/watch?v=WqrCnVAkLIo)..