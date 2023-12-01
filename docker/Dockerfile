# Use Debian 11 as the base image
FROM debian:11

# Update the system and install necessary packages
RUN apt-get update && apt-get install -y \
    openssh-server \
    netcat \
    && rm -rf /var/lib/apt/lists/*

# Install telnet server
RUN apt-get update && apt-get install -y xinetd telnetd

# Create SSH directory and add the ed25519 public key
RUN mkdir /root/.ssh
COPY id_ed25519.pub /root/.ssh/authorized_keys
RUN chmod 700 /root/.ssh && chmod 600 /root/.ssh/authorized_keys
RUN mkdir -p /run/sshd && chmod 0755 /run/sshd

# Configure SSH to permit key-based login and disable password authentication
RUN sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config
RUN sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config

# Expose the necessary ports
EXPOSE 22

# Set up a volume for persistent data
VOLUME ["/data"]
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]

# Install supervisord
RUN apt-get update && apt-get install -y supervisor
# Use supervisord as the default command
RUN echo "[supervisord]\nnodaemon=true\n[program:sshd]\ncommand=/usr/sbin/sshd -D\nautorestart=true" > /etc/supervisor/conf.d/supervisord.conf

CMD ["/usr/bin/supervisord"]
