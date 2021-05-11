import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  HAP,
  Logging,
  Service,
} from 'homebridge';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      notificationRegistration(id: string, handler: (jsonRequest) => void, password: string): void;
    } 
  }
}

// eslint-disable-next-line @typescript-eslint/no-var-requires 
const PACKAGE_JSON = require('../package.json');

import {ACCESSORY_NAME, SERIAL_NUMBER} from './settings';

let hap: HAP;

// Initializer function called when the plugin is loaded.
export = (api: API) => {
  hap = api.hap;
  api.registerAccessory(ACCESSORY_NAME, SoilMoistureTempSensor);
};

class SoilMoistureTempSensor implements AccessoryPlugin {

  private readonly log: Logging;
  private readonly name: string;

  private readonly informationService: Service;
  private readonly moistureService: Service;
  private readonly temperatureService: Service;

  private currentRelativeHumidity = 0.0;
  private currentTemperature = 0.0;


  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.name = config.name;

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, PACKAGE_JSON.author.name)
      .setCharacteristic(hap.Characteristic.Model, PACKAGE_JSON.name)
      .setCharacteristic(hap.Characteristic.SerialNumber, SERIAL_NUMBER)
      .setCharacteristic(hap.Characteristic.FirmwareRevision, PACKAGE_JSON.version);

    this.moistureService = new hap.Service.HumiditySensor();
    this.moistureService.getCharacteristic(hap.Characteristic.CurrentRelativeHumidity)
      .onGet(this.handleCurrentRelativeHumidityGet.bind(this));

    this.temperatureService = new hap.Service.TemperatureSensor();
    this.temperatureService.getCharacteristic(hap.Characteristic.CurrentTemperature)
      .onGet(this.handleCurrentTemperatureGet.bind(this));

    // Register with notification server.
    api.on('didFinishLaunching', () => {
      // check if notificationRegistration is set, if not 'notificationRegistration' is probably not installed on the system
      if (global.notificationRegistration && typeof global.notificationRegistration === 'function') {
        try {
          global.notificationRegistration(config.notificationID, this.handleNotification.bind(this), config.notificationPassword);
        } catch (error) {
          // notificationID is already taken
          this.log.error('Failed to register with notification server: '+error);
        }
      }
    });

    log.info('Soil Moisture and temperature sensor initialized.');


  }

  // Identify
  identify(): void {
    this.log('Identify!');
  }

  // This method is called directly after creation of this instance.
  // It should return all services which should be added to the accessory.    
  getServices(): Service[] {
    return [
      this.informationService,
      this.moistureService,
      this.temperatureService,
    ];
  }

  // Retrieve current humidty from cache.
  handleCurrentRelativeHumidityGet() {
    this.log.debug('Get current humidty: '+this.currentRelativeHumidity+'%.');
    return this.currentRelativeHumidity;
  }

  // Retrieve current temperature from cache.
  handleCurrentTemperatureGet() {
    this.log.debug('Get current temperature: '+this.currentTemperature+' [deg C].');
    return this.currentTemperature;
  }

  // Update cache from received update.
  handleNotification(jsonRequest) {    
    const characteristic = jsonRequest.characteristic;
    const value = jsonRequest.value;
        
    if (this.moistureService.testCharacteristic(characteristic)) {
      this.moistureService.updateCharacteristic(characteristic, value);
    } else if (this.temperatureService.testCharacteristic(characteristic)) {
      this.temperatureService.updateCharacteristic(characteristic, value);
    } else {
      this.log.error(`Invalid characteristic received: "${characteristic}"`);
    }
  }


}
