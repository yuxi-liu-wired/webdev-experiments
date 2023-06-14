My experiments with Nginx, Docker, and Python web hosting.

Each folder is a standalone project and contains its own `README.md` which describes how to run it, and how it works. 

To run the projects:
* Install `Docker`.
* Run `git clone https://github.com/yuxiliu1995/webdev-experiments.git`.
* Go into each folder and follow the `README.md` within.

Table of contents:
* `hello`: A website that shows `Hello World!`.
* `counter`: Counts how many times it is hit by HTTP requests and displays it on the webpage.
* `reverse-proxy`: Performs [reverse proxying](https://en.wikipedia.org/wiki/Reverse_proxy), with two servers on the backend. One takes 2/3 of the load, and the other 1/3.
