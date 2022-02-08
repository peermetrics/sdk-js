# PeerMetrics sdk

This is the repo for the `PeerMetrics` JS sdk. 

Peer metrics is a service that helps you collect events and metrics for your `WebRTC` connections. You can read more about the service [here](https://peermetrics.io/).



Contents

1. [Install]()

## Install

To use the sdk you can install the package through npm:

```sh
npm install @peermetrics/sdk
```

Or load it directly in the browser:

```html
<script src="//cdn.peermetrics.io/js/sdk/peermetrics.js"></script>
```



## Usage

To use the sdk you need a peer metrics account. Once you've created an organization and an app you will receive an `apiKey`

```js
let peerMetrics = new PeerMetrics({
    apiKey: '7090df95cd247f4aa735779636b202',
    userId: '1234',
    userName: 'My user',
    conferenceId: 'conference-1',
    conferenceName: 'Conference from 4pm'
})
// initialize the sdk
await peerMetrics.initialize()
```
In order to start tracking a connection, use the `.addPeer()` method:
```js
let pc1 = new RTCPeerConnection({...})
peerMetrics.addPeer({
    pc: pc1,
    peerId: '1' # any string that helps you identify this peer
})
```
### Options
To instantiate the sdk you have the following options:
```js
let peerMetrics = new PeerMetrics({
    // the api key associated to the app created inside your account
    apiKey: '', // String, mandatory

    // a string that will help you indentify this user inside your peer metrics account
    userId: '1234', // String, mandatory

    // a readable name for this user
    userName: 'My user', // String, optional

    // an ID to identify this conference
    conferenceId: 'conference-1', // String, mandatory

    // a readable name for this conference
    conferenceName: 'Conference from 4pm', // String, optional

    // the version of your app. this helps you filter conferecens/stats for a specific version
    appVersion: '0.0.1', // String, optional

    // if the sdk can't be run on the other side of the call (for example a SFU) you can still collect some stats for that using this flag
    remote: false, // Boolean, optional

    // Object, optional: if you would like to save some additional info about this user
    // there is a limit of 5 attributes that can be added. only string, number, boolean supported as values
    meta: {
        isRegistered: true,
        plan: 'premium'
    },

    // if you would like to save events from some page events
    pageEvents: {
        pageVisibility: false // when the user focuses on another tab
    }
})
```

### API

#### `.initialize()`

Used to initialize the SDK. Returns a promise that rejects if any problems were encountered (for example invalid apiKey, over quota, etc)

#### `.addPeer(options)`
Adds a peer to the watch list.
`options`

  - `pc`: the `RTCPeerConnection` instance
  - `peerId`: String a unique Id to identify this peer
Monitoring of a peer will automatically end when the connection is closed.

#### `.removePeer(peerId)`

Stop listening for events/stats for this peer

#### `.addEvent(object)`

Add a custom event for this participant. eg: `{eventName: 'open settings', description: 'user opened settings dialog'}`.

`object` doesn't require a specific structure, but if the `eventName` attribute is present, it will be used as a event title on the timeline.

This helps you get a better context of the actions the user took that might have impacted the WebRTC experience.

#### `.mute()`/`.unmute()`

Save event that user muted/unmuted the microphone

### Browser support

Right now, the sdk has been tested and is compatible with the latest version of Chromium based browsers (Chrome, Edge, Brave, etc), Firefox and Safari.

### SDK integrations

You can use `PeerMetrics` with many well known WebRTC SDKs. 

In order to integrate you can initialize the SDK as usually and then call `.addSdkIntegration()` with special options:

```js
let peerMetrics = new PeerMetrics({
    apiKey: '7090df95cd247f4aa735779636b202',
    userId: '1234',
    userName: 'My user',
    conferenceId: 'conference-1',
    conferenceName: 'Conference from 4pm'
})
// initialize the SDK
await peerMetrics.initialize()
// call addSdkIntegration()
await peerMetrics.addSdkIntegration(options)

// That's it
```

The `options` object differs depending on the integration. 

The `PeerMetrics` SDK will take care of adding connection listeners and sending events, there's no need to call `addConnection()`

List of SDK that `PeerMetrics` supports:

#### Mediasoup

```js
peerMetrics.addSdkIntegration({
    device: device, // mandatory, the mediasoupClient.Device() instance
    serverId: '', // string, mandatory, and ID that would help you indentify the SFU server the user connets to
    serverName: '' // string, optional, and more readable name for this server
})
```



## License
MIT
