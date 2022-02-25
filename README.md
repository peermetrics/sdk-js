# PeerMetrics sdk

<img src="https://img.shields.io/npm/v/@peermetrics/sdk">

This is the repo for the `PeerMetrics` JS sdk. 

Peer metrics is a service that helps you collect events and metrics for your `WebRTC` connections. You can read more about the service on [peermetrics.io](https://peermetrics.io/).

### Contents

1. [Install](#install)
2. [Usage](#usage)
   1. [Options](#options)
   2. [API](#api)
4. [SDK integrations](#sdk-integrations)
   1. [LiveKit](#livekit)
   1. [Twilio Video](#twilio-video)
   1. [Mediasoup](#mediasoup)
   1. [Janus](#janus)
   1. [Vonage](#vonage)
5. [Browser support](#browser-support)
5. [License](#license)

## Install

To use the sdk you can install the package through npm:

```sh
npm install @peermetrics/sdk
```

Or load it directly in the browser:

```html
<script src="//cdn.peermetrics.io/js/sdk/peermetrics.min.js"></script>
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

#### `.addSdkIntegration(options)`

Used to integrate with different SDKs. See [here](#sdk-integrations) list for options.

#### `.addConnection(options)`
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

## SDK integrations

You can use `PeerMetrics` with many well known WebRTC SDKs. 

In order to integrate you can initialize the SDK as usually and then call `.addSdkIntegration()` with special options:

```js
let peerMetrics = new PeerMetrics({
    apiKey: '7090df95cd247f4aa735779636b202',
    userId: '1234',
    userName: 'My user',
    conferenceId: 'room-1',
    conferenceName: 'Call from 4pm'
})
// initialize the SDK
await peerMetrics.initialize()
// call addSdkIntegration()
await peerMetrics.addSdkIntegration(options)

// That's it
```

The `options` object differs depending on the integration. 

**Note:** There's no need to call `addConnection()` anymore, the `PeerMetrics` SDK will take care of adding connection listeners and sending events.



List of SDKs that `PeerMetrics` supports:

### LiveKit

To integrate with [LiveKit' js sdk](https://github.com/livekit/client-sdk-js) you need to pass an instance of `Room`.

**Note** You need at least version `v0.16.2` of `livekit-client`.

```js
import { Room } from 'livekit-client'

const room = new Room(roomOptions)

peerMetrics.addSdkIntegration({
	livekit: {
        room: room, // mandatory, the livekit client Room instance
        serverId: '', // string, mandatory, an ID to indentify the SFU server the user connects to
        serverName: '' // string, optional, a more readable name for this server
    }
})
```

### Twilio Video

You can integrate with v2 of [Twilio Video SDK](https://github.com/twilio/twilio-video.js). To do that, you need to pass the instance of `Room`. For example:

```js
import Video from 'twilio-video'

Video.connect('$TOKEN', { name: 'room-name' }).then(room => {
    peerMetrics.addSdkIntegration({
        twilioVideo: {
            room: room, // mandatory, the twilio video Room instance
            serverId: '', // string, mandatory, an ID to indentify this connection
            serverName: '' // string, optional, a more readable name for this server
        }
    })
})

```



### Mediasoup

To integrate with [mediasoup](https://mediasoup.org/) you need to pass in the device instance:

```js
import * as mediasoupClient from 'mediasoup-client'

let device = new mediasoupClient.Device({
    handlerName : this._handlerName
})

peerMetrics.addSdkIntegration({
	mediasoup: {
        device: device, // mandatory, the mediasoupClient.Device() instance
        serverId: '', // string, mandatory, an ID to indentify the SFU server the user connects to
        serverName: '' // string, optional, a more readable name for this server
    }
})
```

### Janus

If you are using the [Janus](https://janus.conf.meetecho.com/docs/JS.html) javascript sdk to create connections to Janus server, you can integrate by sending the plugin handler that result from calling `.attach()`. For example:

```js
let janus = new Janus({
    server: server,
    success: function() {
        // Attach to VideoCall plugin
        janus.attach({
            plugin: "janus.plugin.videocall",
            opaqueId: opaqueId,
            success: function(pluginHandle) {
                peerMetrics.addSdkIntegration({
					janus: {
                        plugin: pluginHandle, // mandatory
                        serverId: '', // string, mandatory, an ID for this SFU server
                        serverName: '' // string, optional, a more readable name for this server
                    }
                })

                ...
            }
        })
    }
})
```

### Vonage

To integrate with Vonage SDK (previously Tokbox) you will need to load `PeerMetrics` before the them. For example:

```html
<!-- First we need to set a special global option -->
<script>
    var PeerMetricsOptions = {
        wrapPeerConnection: true
    }
</script>

<!-- Load the sdk -->
<script src="//cdn.peermetrics.io/js/sdk/peermetrics.min.js"></script>

<!-- Then setup PeerMetrics. This can alse be done later, but before calling OT.initSession() -->
<script>
    (async () => {
        let stats = new PeerMetrics({
            ...
        })
        await stats.initialize()

        stats.addSdkIntegration({
            vonage: true
        })
    })()
</script>

<!-- Load the OpenTok sdk -->
<script src="https://static.opentok.com/v2/js/opentok.min.js"></script>

```



## Browser support

Right now, the sdk has been tested and is compatible with the latest version of Chromium based browsers (Chrome, Edge, Brave, etc), Firefox and Safari.



## License
MIT
