# Hello World

Your Padington instance is up and running!

## Next Steps

* Configure a reverse-proxy for port 80 (Client) and 9002 (Server)
* Enable TLS

**Note**: *The client container is currently hard-coded to connect to the server on the same domain, port 9002*

## General Infos

* All pad names are slugified before the channel connection is established (i.e. `Pad` and `pad` are the same channel)
* At the moment, a pad is saved when all clients have left the channel