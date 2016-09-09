# gce-launcher

This is a Chrome extension to make it easy to launch GCE servers as development
boxes and automatically shut them down when not using them.

This repo contains the Chrome extension code as well as a Go program that checks
for the heartbeats sent by the extension.

## Install the daemon and enable the systemd service
```sh
go build -v . && sudo cp ./gce-launcher /usr/local/bin && sudo cp ./gce-launcher.service /etc/systemd/system && sudo systemctl daemon-reload && sudo systemctl restart gce-launcher
```
