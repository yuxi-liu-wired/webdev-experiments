FROM ubuntu/nginx
ENV DEBIAN_FRONTEND=noninteractive container=docker

# 1) core bits
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        systemd systemd-sysv openssh-server git ca-certificates && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# 2) simple dev account for SSH
RUN useradd -m dev                     \
 && echo "dev:dev" | chpasswd         \
 && mkdir -p /run/sshd

# 3) ensure sshd starts at boot (multi-user.target)
RUN ln -s /lib/systemd/system/ssh.service \
        /etc/systemd/system/multi-user.target.wants/ssh.service

# 4) clone your repo
RUN git clone --depth 1 \
      https://github.com/yuxi-liu-wired/webdev-experiments.git /srv/webdev

# 5) install all unit files and enable them
RUN install -m0644 /srv/webdev/systemd/systemd_files/* /etc/systemd/system/ && \
    mkdir -p \
      /etc/systemd/system/multi-user.target.wants \
      /etc/systemd/system/timers.target.wants && \
    ln -s /etc/systemd/system/git-update.service \
          /etc/systemd/system/multi-user.target.wants/git-update.service && \
    ln -s /etc/systemd/system/git-update.timer \
          /etc/systemd/system/timers.target.wants/git-update.timer

# 6) expose ports
EXPOSE 22 80 443

STOPSIGNAL SIGRTMIN+3
CMD ["/usr/lib/systemd/systemd"]
