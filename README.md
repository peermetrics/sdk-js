# PeerMetrics SDK

<img src="https://img.shields.io/npm/v/@peermetrics/sdk">

This is the repo for the `PeerMetrics` JS SDK. 

Peer metrics is a service that helps you collect events and metrics for your `WebRTC` connections. You can read more about the service on [peermetrics.io](https://peermetrics.io/).

### Contents

1. [Install](#install)
2. [Usage](#usage)
   1. [Options](#options)
   2. [API](#api)
   3. [Static methods](#static-methods)
3. [SDK integrations](#sdk-integrations)
   1. [LiveKit](#livekit)
   2. [Twilio Video](#twilio-video)
   3. [Mediasoup](#mediasoup)
   4. [Janus](#janus)
   5. [Vonage](#vonage)
   6. [Agora](#agora)
   7. [Pion](#pion)
   8. [SimplePeer](#simplepeer)
4. [Browser support](#browser-support)
5. [License](#license)



## Install

To use the sdk you can install the package through npm:

```sh
npm install @peermetrics/sdk
```

Then

```js
import { PeerMetrics } from '@peermetrics/sdk'
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
    conferenceName: 'Conference from 4pm',
    appVersion: '1.0.1'
})
// initialize the sdk
await peerMetrics.initialize()
```
In order to start tracking a connection, use the `.addConnection()` method:
```js
let pc1 = new RTCPeerConnection({...})
await peerMetrics.addConnection({
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

    // the version of your app. this helps you filter conferecens/stats/issues for a specific version
    appVersion: '0.0.1', // String, optional

    // if the sdk can't be run on the other side of the call (for example a SFU) you can still collect some stats for that using this flag
    remote: true, // Boolean, optional, Default: true

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
Adds a connection to the watch list.
`options`

```js
{
	`pc`: pc, // RTCPeerConnection instance
	`peerId`: 'peer-1' // String, a unique Id to identify this peer
}
```

**Note:** Monitoring of a peer will automatically end when the connection is closed.



#### `.removeConnection(options)`

Stop listening for events on a specific connection.

`options` can be one of two options:

```js
{
	'connectionId': '123' // the one returned after calling `.addConnection()`
}
```

OR

```js
{
	'pc': pc // the `RTCPeerConnection` instance
}
```



#### `.removePeer(peerId)`

Stop listening for events/stats on all the connections for this peer



#### `.addEvent(object)`

Add a custom event for this participant. Example: 

```js
{
    eventName: 'open settings',
    description: 'user opened settings dialog'
}
```

`object` doesn't require a specific structure, but if the `eventName` attribute is present, it will be displayed on the event timeline in your dashboard.

This helps you get a better context of the actions the user took that might have impacted the WebRTC experience.



#### `.mute()`/`.unmute()`

Save event that user muted/unmuted the microphone



### Static methods

#### `.getPageUrl()`

Method used to get the peer metrics page url for a conference or a participants. Useful if you would like to link to one of these pages in your internal website/tool.

```js
await PeerMetrics.getPageUrl({
    apiKey: 'you-api-key', // mandatory

    userId: 'my-user-id', // the userId provided to peer metrics during a call
    // or
    conferenceId: 'confence-id' // an ID provided for a past conference
})
```



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



### List of SDKs that `PeerMetrics` supports:

### LiveKit

To integrate with [LiveKit' js sdk](https://github.com/livekit/client-sdk-js) you need to pass an instance of `Room`.

**Note** You need at least version `v0.16.2` of `livekit-client`.

```js
import { Room } from 'livekit-client'

const room = new Room(roomOptions)

peerMetrics.addSdkIntegration({
	livekit: {
        room: room, // mandatory, the livekit client Room instance
        serverId: '', // string, optional, an ID to indentify the SFU server the user connects to (default: livekit-sfu-server)
        serverName: '' // string, optional, a more readable name for this server (default: LiveKit SFU Server)
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
        serverId: '', // string, optional, an ID to indentify the SFU server the user connects to (default: mediasoup-sfu-server)
        serverName: '' // string, optional, a more readable name for this server (default: MediaSoup SFU Server)
    }
})
```

### Janus

If you are using the [Janus](https://janus.conf.meetecho.com/docs/JS.html) javascript sdk to create connections to Janus server, you can integrate by sending the plugin handler that result from calling `.attach()`. First thing:

```js
let peerMetrics = new PeerMetrics({
    ...
})
await peerMetrics.initialize()
```

And then:

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
                        serverId: '', // string, optional, an ID for this SFU server (default: janus-sfu-server)
                        serverName: '' // string, optional, a more readable name for this server (default: Janus SFU Server)
                    }
                })

                ...
            }
        })
    }
})
```

### Vonage

To integrate with [Vonage](https://www.vonage.com/) SDK (previously Tokbox) you will need to load `PeerMetrics` before it. For example:

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
        let peerMetrics = new PeerMetrics({
            ...
        })
        await peerMetrics.initialize()

        peerMetrics.addSdkIntegration({
            vonage: true
        })
    })()
</script>

<!-- Load the OpenTok sdk -->
<script src="https://static.opentok.com/v2/js/opentok.min.js"></script>
```

### Agora

To integrate with [Agora](https://www.agora.io/) SDK you will need to load `PeerMetrics` before it. For example:

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
        let peerMetrics = new PeerMetrics({
            ...
        })
        await peerMetrics.initialize()

        peerMetrics.addSdkIntegration({
            agora: true
        })
    })()
</script>

<!-- Load the Agora sdk -->
<script src="https://download.agora.io/sdk/release/AgoraRTC_N.js"></script>
```

Or, if you are using a bundler:

```js
import { PeerMetrics } from '@peermetrics/sdk'
// call wrapPeerConnection as soon as possible
PeerMetrics.wrapPeerConnection()

let peerMetrics = new PeerMetrics({...})
await peerMetrics.initialize()

peerMetrics.addSdkIntegration({
    agora: true
})
```

### Pion

Integrating with Pion is dead simple. If for example you are using [ion sdk js](https://github.com/pion/ion-sdk-js), just initialize peer metrics first and you are good to go:

```js
import { Client, LocalStream, RemoteStream } from 'ion-sdk-js';
import { IonSFUJSONRPCSignal } from 'ion-sdk-js/lib/signal/json-rpc-impl';
import { PeerMetrics } from '@peermetrics/sdk'

let peerMetrics = new PeerMetrics({...})
await peerMetrics.initialize()

peerMetrics.addSdkIntegration({
    pion: true
})

// then continue with the usual things
const signal = new IonSFUJSONRPCSignal("wss://ion-sfu:7000/ws");
const client = new Client(signal);
signal.onopen = () => client.join("test session", "test uid")
```

You can pass additional details to `addSdkIntegration()` to better identify the SFU server the user is connecting to:

```js
peerMetrics.addSdkIntegration({
    pion: {
        serverId: 'pion-sfu-na',
        serverName: 'Pion SFU North America'
    }
})
```

### SimplePeer

To integrate with `SimplePeer` you would just need to pass the `RTCPeerConnection` to `PeerMetrics`. For example:

```js
var peer = new SimplePeer({
    initiator: true,
    config: iceServers,
    stream: stream,
    trickle: true
})

peerMetrics.addConnection({
    pc: peer._pc,
    peerId: peerId
})
```



## Browser support

Right now, the SDK is compatible with the latest version of Chromium based browsers (Chrome, Edge, Brave, etc), Firefox and Safari.



## License
MIT
