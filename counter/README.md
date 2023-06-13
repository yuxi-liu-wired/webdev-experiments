## How to run


Now you can refresh it to see the number going up. If you want to *really* see numbers go up, you can use a command-line tool to hit it with a lot of requests. 

I used `wrk`. To install it from source:

```bash
git clone --depth=1 https://github.com/wg/wrk.git
cd wrk
make -j
```

Test that it works by `./wrk -t 6 -c 200 -d 30s --latency https://google.com`. If it doesn't work, then you can try installing `ab` (Apache HTTP server benchmarking tool) or `siege` or some other tools.

If it does work, then run `./wrk `


## What did we do?

`app.py`

`requirements.txt`

`Dockerfile`

`docker-compose.yml`