const testData = {
    GWETROOT_raw: 0.43,
    GWETROOT_converted: 0.43 * 100,
};

const climateData = {
    avgPrecip: 5.38,
    maxPrecip: 20.28,
    avgSoilMoisture: 43,
};

const FLOOD_THRESHOLDS = {
    PRECIP_HIGH: 10,
    PRECIP_EXTREME: 30,
    SOIL_MOISTURE_HIGH: 60,
};

const highCheck = climateData.maxPrecip >= FLOOD_THRESHOLDS.PRECIP_EXTREME;
const mediumCheck = climateData.avgPrecip >= FLOOD_THRESHOLDS.PRECIP_HIGH && climateData.avgSoilMoisture >= FLOOD_THRESHOLDS.SOIL_MOISTURE_HIGH;
const lowCheck = climateData.avgPrecip >= (FLOOD_THRESHOLDS.PRECIP_HIGH / 2);

if (lowCheck) {
    console.log('FLOOD SHOULD BE DETECTED AS LOW');
} else {
    console.log('FLOOD WILL NOT BE DETECTED');
}
