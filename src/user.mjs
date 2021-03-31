
import UAParse from 'ua-parser-js'

/**
 * We gather the info for the current user here
 */
export class User {
  constructor (options) {
    if (!options.userId) {
      throw new Error('missing argument userId')
    }

    this.userId = options.userId
    this.userName = options.userName

    this.platform = {}
    this.constraints = {}
    this.devices = []
  }

  /**
   * Used initially to gather info about the user's platform and send them
   * @return {Object} Details about the user: userId, userName, platform info, etc
   */
  async getUserDetails () {
    let platform = await this.gatherPlatformInfo()
    return {...platform}
  }

  async gatherPlatformInfo () {
    // browser data
    // version, name, OS
    this.platform = this.getUAdetails()

    this.constraints = this.getContraints()

    this.devices = await this.getDevices()

    this.deviceInfo = await this.getDeviceInfo()

    return {
      platform: this.platform,
      constraints: this.constraints,
      devices: this.devices
    }
  }

  getUAdetails () {
    return new UAParse().getResult()
  }

  getContraints () {
    if (!window.navigator || !window.navigator.mediaDevices) {
      return {}
    }

    return window.navigator.mediaDevices.getSupportedConstraints()
  }

  async getDeviceInfo () {
    let battery

    if (navigator.getBattery) {
      try {
        battery = await navigator.getBattery()
        battery = {
          charging: battery.charging,
          chargingTime: battery.chargingTime,
          dischargingTime: battery.dischargingTime,
          level: battery.level
        }
      } catch (e) {
        battery = {}
      }
    }

    return {
      battery: battery,
      cores: navigator.hardwareConcurrency,
      memory: window.performance.memory || {},
      timing: window.performance.timing || {},
      navigation: window.performance.navigation || {}
    }
  }

  /**
   * Get connected audio/video devices connected to this device
   * @return {Promise}
   */
  getDevices () {
    if (!window.navigator.mediaDevices || !window.navigator.mediaDevices.enumerateDevices) {
      return Promise.resolve([])
    }

    return window.navigator.mediaDevices.enumerateDevices()
      .then((devices) => {
        let deviceArray = []
        devices.forEach((device) => {
          let dev = device.toJSON()
          if (dev.label) {
            deviceArray.push(dev)
          }
        })

        return deviceArray
      })
      .catch(() => {
        return []
      })
  }
}
