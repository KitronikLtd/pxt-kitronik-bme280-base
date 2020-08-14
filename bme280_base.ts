/**
 * Kitronik BME280 Blocks
 * Sensor Chip: BME280
 */
 
 	//List of different temperature units
    enum TemperatureUnitList {
        //% block="°C"
        C,
        //% block="°F"
        F
    }

	//List of different pressure units
    enum PressureUnitList {
        //% block="Pa"
        Pa,
        //% block="mBar"
        mBar
    }
 
namespace kitronik_BME280 {

	//Useful BME280 constants
	export const CHIP_ADDRESS = 0x76
	export const CONTROL_HUMIDITY_REG = 0xF2
	export const CONTROL_MEASURE_REG = 0xF4
	export const CONFIG_REG = 0xF5
	export const PRESSURE_MSB_REG = 0xF7
	
    
    //The following functions allow us to simply read the manufacturer settings of the BME280 chip
    //function for reading register as unsigned 8 bit integer
    export function getInt8BE(reg: number): number {
        pins.i2cWriteNumber(CHIP_ADDRESS, reg, NumberFormat.UInt8BE);
        return pins.i2cReadNumber(CHIP_ADDRESS, NumberFormat.UInt8BE);
    }

	//function for reading register as signed 8 bit integer
    export function getInt8LE(reg: number): number {
        pins.i2cWriteNumber(CHIP_ADDRESS, reg, NumberFormat.UInt8BE);
        return pins.i2cReadNumber(CHIP_ADDRESS, NumberFormat.Int8LE);
    }

	//function for reading register as unsigned 16 bit integer
    export function getUInt16LE(reg: number): number {
        pins.i2cWriteNumber(CHIP_ADDRESS, reg, NumberFormat.UInt8BE);
        return pins.i2cReadNumber(CHIP_ADDRESS, NumberFormat.UInt16LE);
    }

	//function for reading register as signed 16 bit integer
    export function getInt16LE(reg: number): number {
        pins.i2cWriteNumber(CHIP_ADDRESS, reg, NumberFormat.UInt8BE);
        return pins.i2cReadNumber(CHIP_ADDRESS, NumberFormat.Int16LE);
    }
    
    //These are the various constants that are part of the chip build.
	export const DIG_T1 = getUInt16LE(0x88)
    export const DIG_T2 = getInt16LE(0x8A)
    export const DIG_T3 = getInt16LE(0x8C)
    export const DIG_P1 = getUInt16LE(0x8E)
    export const DIG_P2 = getInt16LE(0x90)
    export const DIG_P3 = getInt16LE(0x92)
    export const DIG_P4 = getInt16LE(0x94)
    export const DIG_P5 = getInt16LE(0x96)
    export const DIG_P6 = getInt16LE(0x98)
    export const DIG_P7 = getInt16LE(0x9A)
    export const DIG_P8 = getInt16LE(0x9C)
    export const DIG_P9 = getInt16LE(0x9E)
    export const DIG_H1 = getInt8BE(0xA1)
    export const DIG_H2 = getInt16LE(0xE1)
    export const DIG_H3 = getInt8BE(0xE3)
    //Registers H4 and H5 overlap at address 0xE5, so we read the overlapping bit and then split it into the 2 registers.
    export const DIG_H4_LSB_DIG_H5_MSB = getInt8BE(0xE5)
    export const DIG_H4 = (getInt8BE(0xE4) << 4) + (DIG_H4_LSB_DIG_H5_MSB % 16)
    export const DIG_H5 = (getInt8BE(0xE6) << 4) + (DIG_H4_LSB_DIG_H5_MSB >> 4)
    export const DIG_H6 = getInt8LE(0xE7)

	//Global variables used for storing one copy of value, these are used in multiple locations for calculations
    export let initalised = false
    export let measurementsBuf = pins.createBuffer(8)

    export let temperatureReading = 0		// calculated readings of sensor parameters from raw adc readings
    export let pressureReading = 0
    export let humidityReading = 0

    export let adcRawTemperature = 0       //adc reading of raw temperature
    export let adcRawPressure = 0       //adc reading of raw pressure
    export let adcRawHumidity = 0       //adc reading of raw humidity


	/* secretIncantation function is only called once at the beginning in order to set up the BME280 sensor.
	* This function should not need to be called by a user, it is called automatically on first use of a BME280 function
	*/
    export function secretIncantation() {
        let writeBuf = pins.createBuffer(2)
        //Humidity Register
        writeBuf[0] = CONTROL_HUMIDITY_REG
        writeBuf[1] = 0x01
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf)
        //Temp and pressure register
        writeBuf[0] = CONTROL_MEASURE_REG
        writeBuf[1] = 0x2B
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf)
        //set filters
        writeBuf[0] = CONFIG_REG
        writeBuf[1] = 0x08
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf)

        initalised = true
    }

    // blockId="temperature_units" block="%temp_units"
    export function temperatureUnits(temp_units: TemperatureUnitList): string {
    	switch(temp_units) {
    		case TemperatureUnitList.C: return "°C";
    		case TemperatureUnitList.F: return "°F";
    	}
    }

    // blockId="pressure_units" block="%press_units"
    export function pressureUnits(press_units: PressureUnitList): string {
    	switch(press_units) {
    		case PressureUnitList.Pa: return "Pa";
    		case PressureUnitList.mBar: return "mBar";
    	}
    }

	/*readRawReadings reads all registers to do with measurements from the BME280 chip .
	* Once all bytes are collated, the required bytes are shifted left or right depending if it was most or least significate bites.
	* At the end of the fuction, there are three globals with the raw readings of temperature, pressure and humidity.
	*/
    export function readRawReadings(): void {

        //now read the results
        pins.i2cWriteNumber(CHIP_ADDRESS, PRESSURE_MSB_REG, NumberFormat.UInt8BE)
        measurementsBuf = pins.i2cReadBuffer(CHIP_ADDRESS, 8)
		
        //now split the 3 measurements into 3 numbers
        adcRawPressure = ((measurementsBuf[0] << 12) | (measurementsBuf[1] << 4) | ((measurementsBuf[2] & 0xF0) >> 4))
        adcRawTemperature = ((measurementsBuf[3] << 12) | (measurementsBuf[4] << 4) | ((measurementsBuf[5] & 0xF0) >> 4))
        adcRawHumidity = ((measurementsBuf[6] << 8) | measurementsBuf[7])
    }

	
	/*convertReadings takes the raw adc global and uses the BME280 custom trimming parameters, then calaculate the actual readings.
	* Temperature is in degrees C
	* Pressure is in Pascals
	* Humidity is in percentage
	*/
    export function convertReadings(): void {

        //Convert raw temperature to °C reading
		// var1 and var2 are variables that are re-used within the function only for calculation as temperary variables
        let var1 = (((adcRawTemperature >> 3) - (DIG_T1 << 1)) * DIG_T2) >> 11
        let var2 = (((((adcRawTemperature >> 4) - DIG_T1) * ((adcRawTemperature >> 4) - DIG_T1)) >> 12) * DIG_T3) >> 14
        let temperatureCalculation = var1 + var2

        temperatureReading = ((temperatureCalculation * 5 + 128) >> 8) / 100

        var1 = (temperatureCalculation >> 1) - 64000
        var2 = (((var1 >> 2) * (var1 >> 2)) >> 11) * DIG_P6
        var2 = var2 + ((var1 * DIG_P5) << 1)
        var2 = (var2 >> 2) + (DIG_P4 << 16)
        var1 = (((DIG_P3 * ((var1 >> 2) * (var1 >> 2)) >> 13) >> 3) + (((DIG_P2) * var1) >> 1)) >> 18
        var1 = ((32768 + var1) * DIG_P1) >> 15

        if (var1 == 0)
            return; // avoid exception caused by division by zero

        //Convert raw pressure to mBar reading
        let pressureCalculation = ((1048576 - adcRawPressure) - (var2 >> 12)) * 3125

        pressureCalculation = (pressureCalculation / var1) * 2;
        var1 = (DIG_P9 * (((pressureCalculation >> 3) * (pressureCalculation >> 3)) >> 13)) >> 12
        var2 = (((pressureCalculation >> 2)) * DIG_P8) >> 13

        pressureReading = pressureCalculation + ((var1 + var2 + DIG_P7) >> 4)

        //convert raw humidity to percentage reading
        var1 = temperatureCalculation - 76800
        var2 = (((adcRawHumidity << 14) - (DIG_H4 << 20) - (DIG_H5 * var1)) + 16384) >> 15
        var1 = var2 * (((((((var1 * DIG_H6) >> 10) * (((var1 * DIG_H3) >> 11) + 32768)) >> 10) + 2097152) * DIG_H2 + 8192) >> 14)
        var2 = var1 - (((((var1 >> 15) * (var1 >> 15)) >> 7) * DIG_H1) >> 4)

        if (var2 < 0)
            var2 = 0

        if (var2 > 419430400)
            var2 = 419430400

        humidityReading = (var2 >> 12) / 1024
    }
}
