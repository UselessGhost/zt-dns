# zt-dns

A simple, single file Node DNS resolver for ZeroTier domains. Only works with the legacy dashboard. Run as follows;

```ZT_KEY=my-zerotier-api-key DOMAIN=my.domain.com NETWORK=my-zerotier-network-id npm start```

The server will start up and start resolving hostnames. Hostnames are resolved using the device's alias as configured in ZeroTier (a device named "computer" will resolve to "computer.my.domain.com" per the example above)
