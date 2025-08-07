# systemd experiments

## Get Docker running

```bash
chmod 755 run_docker.sh
./run_docker.sh

ssh dev@localhost -p 8022
# `dev` is the hardcoded password (see Dockerfile)
```

## Check that systemd is self-updating

You can check that systemd is self-updating by looking at the `git-update.timer` and `git-update.service` files in the `systemd_files` directory. These files are set up to run every minute to update the systemd units from a git repository. You can modify these files to test the self-updating feature.

```bash
docker exec sysbox systemctl cat git-update.timer
# wait a while...
docker exec sysbox systemctl cat git-update.timer
```

If you are impatient, you can manually trigger the update:

```bash
docker exec sysbox systemctl start git-update.service
```

## Check systemd status

You can do it via `docker exec`:

```bash
$ docker exec sysbox ps -p 1 -o pid,comm
    PID COMMAND
      1 systemd

$ docker exec sysbox systemctl list-units --type=service --state=running
  UNIT                     LOAD   ACTIVE SUB     DESCRIPTION
  getty@tty1.service       loaded active running Getty on tty1
  getty@tty2.service       loaded active running Getty on tty2
  getty@tty3.service       loaded active running Getty on tty3
  getty@tty4.service       loaded active running Getty on tty4
  getty@tty5.service       loaded active running Getty on tty5
  getty@tty6.service       loaded active running Getty on tty6
  nginx.service            loaded active running A high performance web server and a reverse proxy server
  ssh.service              loaded active running OpenBSD Secure Shell server
  systemd-journald.service loaded active running Journal Service

Legend: LOAD   → Reflects whether the unit definition was properly loaded.
        ACTIVE → The high-level unit activation state, i.e. generalization of SUB.
        SUB    → The low-level unit activation state, values depend on unit type.

9 loaded units listed.
```

Note that `systemctl` commands can't be run if you ssh into the container directly, because `dev` user is an unprivileged user in a fresh session, that doesn't automatically have access to the system bus socket that `systemctl` uses (that lives under `/run/systemd/private`). So you need to use `docker exec` to run `systemctl` commands.

```bash
docker exec sysbox systemctl status
docker exec sysbox systemctl list-units --type=service
docker exec sysbox systemctl list-unit-files --type=service
```

## Check nginx status

```bash
docker exec sysbox systemctl status nginx
docker exec sysbox systemctl list-units --type=service | grep nginx
docker exec sysbox systemctl list-unit-files --type=service | grep nginx
```
