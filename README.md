# homebridge-soil-temp-sensor
[Homebridge](https://github.com/nfarina/homebridge) plugin _only_ listening to http push events from a soil and temperature sensor.

## Why this plugin?
Building an extremely low power soil humidity and temperature sensor based on the simple http protocol demanded the sensor's http server to be offline most of the time.
Humidity and temperature are measured at a very low frequency (once per hour) at the device which makes the device unavailable for http requests
most of the time. Several temperature or humidty Homebridge sensors exist, however none of them supported:
- only http push notifications.
- written in TypeScript.
- support for FakeGato sensor history.

## Notification Server

`homebridge-soil-temp-sensor` has to be used together with
[homebridge-http-notification-server](https://github.com/Supereg/homebridge-http-notification-server) in order to receive
updates when the state changes at your external program. For details on how to implement those updates and how to
install and configure `homebridge-http-notification-server`, please refer to the
[README](https://github.com/Supereg/homebridge-http-notification-server) of the repository.

Down here is an example on how to configure `homebridge-soil-temp-sensor` to work with your implementation of the
`homebridge-soil-temp-sensor`.

```json
{
    "accessories": [
        {
          "accessory": "SoilMoistureTempSensor",
          "name": "Garden mositure sensor",

          "notificationID": "my-soil-sensor",
          "notificationPassword": "superSecretPassword",
        }   
    ]
}
```

* `notificationID` is an per Homebridge instance unique id which must be included in any http request.  
* `notificationPassword` is **optional**. It can be used to secure any incoming requests.

To get more details about the configuration have a look at the
[README](https://github.com/Supereg/homebridge-http-notification-server).
