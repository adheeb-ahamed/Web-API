const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const data = require('./seedTuk.json');
const Ping = require('./models/Ping');

const deviceKeys = {};
data.vehicles.forEach(v => {
  const padded = String(v.id).padStart(2, '0');
  deviceKeys[`v-${padded}`] = `key_v${padded}`;
});

const app = express();
const port = 3000;

app.use(express.json());

function basicAuth(req, res, next) {
  const auth = req.get('Authorization');
  if (!auth) {
    res.set('WWW-Authenticate', 'Basic realm="Police API"');
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const encoded = auth.split(' ')[1];
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
  const [username, password] = decoded.split(':');
  if (username !== 'police' || password !== 'nibm2024') {
    return res.status(403).json({ error: 'Invalid credentials' });
  }
  next();
}

app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  basicAuth(req, res, next);
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', session: 'NB6007CEM S2' });
});

app.get('/provinces', (req, res) => {
  res.json(data.provinces.map(p => ({ province_id: p.id, name: p.name })));
});

app.get('/provinces/:provinceId', (req, res) => {
  const province = data.provinces.find(p => p.id === Number(req.params.provinceId));
  if (!province) return res.status(404).json({ error: 'Province not found' });
  res.json({ province_id: province.id, name: province.name });
});

app.get('/districts', (req, res) => {
  res.json(data.districts.map(d => ({ district_id: d.id, name: d.name, province_id: d.province_id })));
});

app.get('/districts/:districtId', (req, res) => {
  const district = data.districts.find(d => d.id === Number(req.params.districtId));
  if (!district) return res.status(404).json({ error: 'District not found' });
  res.json({ district_id: district.id, name: district.name, province_id: district.province_id });
});

app.get('/stations', (req, res) => {
  res.json(data.stations.map(s => ({ station_id: s.id, name: s.name, district_id: s.district_id })));
});

app.get('/stations/:stationId', (req, res) => {
  const station = data.stations.find(s => s.id === Number(req.params.stationId));
  if (!station) return res.status(404).json({ error: 'Station not found' });
  res.json({ station_id: station.id, name: station.name, district_id: station.district_id });
});

app.get('/vehicles', (req, res) => {
  res.json(data.vehicles.map(v => ({ vehicle_id: v.id, reg_number: v.register_number, device_id: v.device_id, station_id: v.station_id })));
});

app.get('/vehicles/:vehicleId', async (req, res) => {
  try {
    const vehicle = data.vehicles.find(v => v.id === Number(req.params.vehicleId));
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const lastPingDoc = await Ping.findOne({ vehicle_id: vehicle.id })
      .sort({ timestamp: -1 });

    const lastPing = lastPingDoc
      ? {
          ping_id: String(lastPingDoc.ping_id),
          vehicle_id: String(lastPingDoc.vehicle_id),
          timestamp: lastPingDoc.timestamp,
          lat: lastPingDoc.latitude,
          lng: lastPingDoc.longitude,
          speed: lastPingDoc.speed ?? null
        }
      : null;

    res.json({
      vehicle_id: String(vehicle.id),
      reg_number: vehicle.register_number,
      device_id: vehicle.device_id,
      station_id: String(vehicle.station_id),
      last_ping: lastPing
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/vehicles/:vehicleId/pings', async (req, res) => {
  try {
    const vehicle = data.vehicles.find(v => v.id === Number(req.params.vehicleId));
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const pings = await Ping.find({ vehicle_id: vehicle.id })
      .sort({ timestamp: -1 });

    res.json(pings.map(p => ({
      ping_id: String(p.ping_id),
      vehicle_id: String(p.vehicle_id),
      timestamp: p.timestamp,
      lat: p.latitude,
      lng: p.longitude,
      speed: p.speed ?? null
    })));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/vehicles/:vehicleId/pings', async (req, res) => {
  try {
    const apiKey = req.get('X-API-Key');
    if (!apiKey) return res.status(401).json({ error: 'Missing X-API-Key header' });

    const vehicleId = Number(req.params.vehicleId);
    const vehicle = data.vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const padded = String(vehicleId).padStart(2, '0');
    const vKey = `v-${padded}`;
    if (deviceKeys[vKey] !== apiKey) return res.status(403).json({ error: 'Invalid API key' });

    const { latitude, longitude, speed } = req.body;
    if (latitude == null || longitude == null || speed == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
      return res.status(400).json({ error: 'Latitude must be a number between -90 and 90' });
    }
    if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Longitude must be a number between -180 and 180' });
    }
    if (typeof speed !== 'number' || speed < 0) {
      return res.status(400).json({ error: 'Speed must be a non-negative number' });
    }

    const lastPing = await Ping.findOne().sort({ ping_id: -1 });
    const newId = lastPing ? lastPing.ping_id + 1 : 1;
    const timestamp = new Date();

    const ping = await Ping.create({
      ping_id: newId,
      vehicle_id: vehicleId,
      latitude,
      longitude,
      speed,
      timestamp
    });

    const mapped = {
      ping_id: String(ping.ping_id),
      vehicle_id: String(ping.vehicle_id),
      timestamp: ping.timestamp,
      lat: ping.latitude,
      lng: ping.longitude,
      speed: ping.speed
    };

    res.set('ETag', `"${newId}"`);
    res.set('Last-Modified', ping.timestamp.toISOString());
    res.status(201)
      .location(`/vehicles/${vehicleId}/pings/${newId}`)
      .json(mapped);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/vehicles/:vehicleId/pings/:pingId', async (req, res) => {
  try {
    const vehicleId = Number(req.params.vehicleId);
    const pingId = Number(req.params.pingId);
    const ping = await Ping.findOne({ ping_id: pingId, vehicle_id: vehicleId });
    if (!ping) return res.status(404).json({ error: 'Ping not found' });
    res.json({
      ping_id: String(ping.ping_id),
      vehicle_id: String(ping.vehicle_id),
      timestamp: ping.timestamp,
      lat: ping.latitude,
      lng: ping.longitude,
      speed: ping.speed ?? null
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/vehicles/:vehicleId/last-position', async (req, res) => {
  try {
    const vehicle = data.vehicles.find(v => v.id === Number(req.params.vehicleId));
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const ping = await Ping.findOne({ vehicle_id: vehicle.id })
      .sort({ timestamp: -1 });

    if (!ping) return res.status(404).json({ error: 'No pings found for this vehicle' });

    res.json({
      vehicle_id: String(ping.vehicle_id),
      timestamp: ping.timestamp,
      lat: ping.latitude,
      lng: ping.longitude,
      speed: ping.speed ?? null
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is missing from the .env file');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Atlas connected successfully');

    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}/`);
    });
  } catch (error) {
    console.error('Unable to start server:', error.message);
    process.exit(1);
  }
}

startServer();
