import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  HAP,
  Logging,
  Service,
} from 'homebridge';

import os from 'os';
import crypto from 'crypto';

import fakegato from 'fakegato-history';


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

import {ACCESSORY_NAME} from './settings';

let hap: HAP;

// Initializer function called when the plugin is loaded.
export = (api: API) => {
  hap = api.hap;
  api.registerAccessory(ACCESSORY_NAME, SoilMoistureTempSensor);
};

class SoilMoistureTempSensor implements AccessoryPlugin {

  public readonly log: Logging;
  public readonly displayName: string;
  private readonly maxCacheAgeMs: number;

  private readonly informationService: Service;
  private readonly moistureService: Service;
  private readonly temperatureService: Service;
  private readonly batteryService: Service;
  private readonly loggingService;
  public readonly services: Service[];

  private currentRelativeHumidity = 0.0;
  private currentTemperature = 0.0;
  private lastCacheUpdateDateMs = 0;


  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.displayName = config.name;
    this.maxCacheAgeMs = (config.maxCacheAgeMin || 5*60) * 60*1000; // 5h default converted to ms.

    const FakeGatoHistoryService = fakegato(api);

    // Information service.
    const serialNumber = crypto.createHash('md5').update(os.hostname()+'-'+this.displayName, 'utf8').digest('hex');
    this.log.debug('Generated unique serial number: '+serialNumber);

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, PACKAGE_JSON.author.name)
      .setCharacteristic(hap.Characteristic.Model, PACKAGE_JSON.name)
      // Must be unique for the whole Eve instance to prevent combining sensors.
      .setCharacteristic(hap.Characteristic.SerialNumber, serialNumber)
      .setCharacteristic(hap.Characteristic.FirmwareRevision, PACKAGE_JSON.version);

    // Humidity service.
    this.moistureService = new hap.Service.HumiditySensor();
    this.moistureService.getCharacteristic(hap.Characteristic.CurrentRelativeHumidity)
      .onGet(this.handleCurrentRelativeHumidityGet.bind(this));

    // Temperature service.
    this.temperatureService = new hap.Service.TemperatureSensor();
    this.temperatureService.getCharacteristic(hap.Characteristic.CurrentTemperature)
      .onGet(this.handleCurrentTemperatureGet.bind(this));

    // Battery service.
    this.batteryService = new hap.Service.Battery();
    this.batteryService.getCharacteristic(hap.Characteristic.StatusLowBattery)
      .onGet(this.handleStatusLowBatteryGet.bind(this));

    // This attribute is required for the custom Fake Gato history and re-used for HomeKit's getServices().
    this.services = [
      this.informationService,
      this.moistureService,
      this.temperatureService,
      this.batteryService,
    ];

    // Fake gato service.
    this.loggingService = new FakeGatoHistoryService('custom', this, {disableTimer: true});
    this.services.push(this.loggingService); // Now we created the service, add it.

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


    log.info(ACCESSORY_NAME+' initialized.');

  }

  // Identify
  identify(): void {
    this.log('Identify!');
  }

  // This method is called directly after creation of this instance.
  // It should return all services which should be added to the accessory.    
  getServices(): Service[] {
    return this.services;
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

  // Assume battery low when latest data is too old (older than twice the device's interval)
  handleStatusLowBatteryGet() {
    
    let statusLowBattery = hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;

    if( (this.lastCacheUpdateDateMs + this.maxCacheAgeMs) <= Date.now() ) {
      statusLowBattery = hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW;
    }

    this.log.debug('Get current status battery low: ' + (statusLowBattery ? 'Normal' : 'Low') + '.');
    return statusLowBattery;
  }

  // Update cache from received update.
  handleNotification(jsonRequest) {    
    const characteristic = jsonRequest.characteristic;
    const value = jsonRequest.value;

    this.lastCacheUpdateDateMs = Date.now();
        
    if (this.moistureService.testCharacteristic(characteristic)) {
      this.moistureService.updateCharacteristic(characteristic, value);
      this.log.info(`Updated ${characteristic} to value: ${value}.`);

      this.currentRelativeHumidity = value;
      this.loggingService.addEntry(
        { time: Math.round(new Date().valueOf() / 1000), humidity: this.currentRelativeHumidity});

    } else if (this.temperatureService.testCharacteristic(characteristic)) {
      this.temperatureService.updateCharacteristic(characteristic, value);
      this.log.info(`Updated ${characteristic} to value: ${value}.`);

      this.currentTemperature = value;
      this.loggingService.addEntry(
        { time: Math.round(new Date().valueOf() / 1000), temp: this.currentTemperature });
      

    } else {
      this.log.error(`Invalid characteristic received: "${characteristic}"`);
    }

    

  }


}
