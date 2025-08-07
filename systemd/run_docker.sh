#!bin/bash
docker build -t nginx-sysd .
docker run -d --name sysbox \
  --privileged \
  --tmpfs /run --tmpfs /tmp \
  -v /sys/fs/cgroup:/sys/fs/cgroup:rw \
  -p 8022:22 -p 8080:80 \
  nginx-sysd
