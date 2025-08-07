# How to run

## `Dockerfile_telnet`

```bash
docker run -d -v my-debian-volume:/data -p 10023:23 --name debian-telnet-container debian-telnet
```

## `Dockerfile_ssh`

First, generate a key pair and copy the public key to the current directory. For example:

```bash
rm ~/.ssh/id_ed25519*
ssh-keygen -t ed25519
chmod 600 ~/.ssh/id_ed25519*
cp ~/.ssh/id_ed25519.pub . 
```

Then, build the image and run the container.

```bash
docker build -t debian-ssh .
docker run -d -v my-debian-volume:/data -p 10022:22 --name debian-ssh-container debian-ssh
```

## ssh tunnelling

In the above example, the only way to access the container is to ssh into `localhost:10022`. However, there is more that we can do!

### Tunnelling out a port within the container

If there is a service running on a port within the container, we can access it by tunnelling out the port. For example, if there is a web server running on port 80 within the container, we can access it by running the following command:

```bash
ssh -f -N -i ~/.ssh/id_ed25519 -p 10022 -L 10081:localhost:80 root@localhost
```

This command forwards port 10081 on the host to port 80 on the container in the background.
* The `-f` option runs the ssh command in the background.
* The `-N` option tells ssh that we don't want to execute any command on the remote host.
* The `-i` option specifies the private key to use.
* The `-p` option specifies the port to connect to on the remote host.
* The `-L` option specifies the port forwarding goes from localhost to remote host.
* `-L 10081:localhost:80` means that port `10081` on the localhost is forwarded to `localhost:80` on the container. Note that `10081` is relative to the localhost, `localhost:80` is relative to the container.

Now we can access the web server by visiting `localhost:10080` in the browser.

To test this, here is the world's smallest web server:

```bash
while true; do { echo -ne "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n<html><body><h1>Hello World</h1></body></html>\r\n"; } | nc -l -p 80; done
```

This is a bash script that runs an infinite loop. In each iteration, it echoes a HTTP response to the client and pipes it to `nc` (netcat) which listens on port 80. The response is

```html
HTTP/1.1 200 OK
Content-Type: text/html
Connection: close

<html>
<body>
<h1>Hello World</h1>
</body>
</html>
```

