# systemd experiments

## Install



```bash
docker pull ubuntu/nginx

# run img with enough priv to get systemd working
docker run -d --name lab \
  --privileged \
  -p 2222:22 \
  -v /sys/fs/cgroup:/sys/fs/cgroup:ro \
  ubuntu/nginx
```

COMM. The privilege is necessary because [Containers are not VMs](https://www.docker.com/blog/containers-are-not-vms/), so systemd needs to get some privilege from the host.

> Apartments (the containers) are built around shared infrastructure. The apartment building (Docker Host) shares plumbing, heating, electrical, etc. With containers, you share the underlying resources of the Docker host and you build an image that is exactly what you need to run your application. VMs are built in the opposite direction. You are going to start with a full operating system and, depending on your application, might be strip out the things you don’t want.
>
> ...how do you backup your container, you don’t. Your data doesn’t live in the container, it lives in a named volume that is shared between 1-N containers that you define. You backup the data volume, and forget about the container. Optimally your containers are completely stateless and immutable.

