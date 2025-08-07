#!/bin/bash
docker rm -f sysbox || true
yes | docker system prune -a
docker build -t nginx-sysd .
docker run -d --name sysbox \
  --privileged \
  --cgroupns=host \
  --tmpfs /run --tmpfs /run/lock --tmpfs /tmp \
  -v /sys/fs/cgroup:/sys/fs/cgroup:rw \
  -p 8022:22 -p 8080:80 \
  nginx-sysd
