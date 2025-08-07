FROM ubuntu/nginx:24.04
ENV DEBIAN_FRONTEND=noninteractive container=docker

# 1) core bits
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        systemd systemd-sysv openssh-server git ca-certificates && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# 2) simple dev account for SSH
RUN useradd -m dev && echo "dev:dev" | chpasswd && mkdir /var/run/sshd
RUN systemctl enable ssh.service

# 3) clone
RUN git clone --depth 1 \
      https://github.com/yuxi-liu-wired/webdev-experiments.git /srv/webdev

# 4) install your unit files so systemd can see them
RUN cp /srv/webdev/systemd/systemd_files/* /etc/systemd/system/ && \
    systemctl daemon-reload && \
    systemctl enable git-update.timer

# 5) expose ports
EXPOSE 22 80 443

STOPSIGNAL SIGRTMIN+3
CMD ["/usr/lib/systemd/systemd"]
