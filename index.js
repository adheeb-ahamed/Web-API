const express = require('express');
const data = require('./seedTuk.json');

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

app.get('/vehicles/:vehicleId', (req, res) => {
  const vehicle = data.vehicles.find(v => v.id === Number(req.params.vehicleId));
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  const vehiclePings = data.pings
    .filter(p => p.vehicle_id === vehicle.id)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const lastPing = vehiclePings.length
    ? {
        ping_id: String(vehiclePings[0].id),
        vehicle_id: String(vehiclePings[0].vehicle_id),
        timestamp: vehiclePings[0].timestamp,
        lat: vehiclePings[0].latitude,
        lng: vehiclePings[0].longitude,
        speed: vehiclePings[0].speed ?? null
      }
    : null;

  res.json({
    vehicle_id: String(vehicle.id),
    reg_number: vehicle.register_number,
    device_id: vehicle.device_id,
    station_id: String(vehicle.station_id),
    last_ping: lastPing
  });
});

app.get('/vehicles/:vehicleId/pings', (req, res) => {
  const vehicle = data.vehicles.find(v => v.id === Number(req.params.vehicleId));
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  const pings = data.pings.filter(p => p.vehicle_id === vehicle.id);
  res.json(pings.map(p => ({ ping_id: p.id, vehicle_id: p.vehicle_id, timestamp: p.timestamp, lat: p.latitude, lng: p.longitude, speed: p.speed ?? null })));
});

app.post('/vehicles/:vehicleId/pings', (req, res) => {
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

  const maxId = data.pings.reduce((max, p) => Math.max(max, p.id), 0);
  const newId = maxId + 1;
  const timestamp = new Date().toISOString();
  const ping = { id: newId, vehicle_id: vehicleId, latitude, longitude, speed, timestamp };
  data.pings.push(ping);

  const mapped = {
    ping_id: String(newId),
    vehicle_id: String(vehicleId),
    timestamp,
    lat: latitude,
    lng: longitude,
    speed
  };

  res.set('ETag', `"${newId}"`);
  res.set('Last-Modified', timestamp);
  res.status(201)
    .location(`/vehicles/${vehicleId}/pings/${newId}`)
    .json(mapped);
});

app.get('/vehicles/:vehicleId/pings/:pingId', (req, res) => {
  const vehicleId = Number(req.params.vehicleId);
  const pingId = Number(req.params.pingId);
  const ping = data.pings.find(p => p.id === pingId && p.vehicle_id === vehicleId);
  if (!ping) return res.status(404).json({ error: 'Ping not found' });
  res.json({
    ping_id: String(ping.id),
    vehicle_id: String(ping.vehicle_id),
    timestamp: ping.timestamp,
    lat: ping.latitude,
    lng: ping.longitude,
    speed: ping.speed ?? null
  });
});

app.get('/vehicles/:vehicleId/last-position', (req, res) => {
  const vehicle = data.vehicles.find(v => v.id === Number(req.params.vehicleId));
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  const pings = data.pings
    .filter(p => p.vehicle_id === vehicle.id)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  if (!pings.length) return res.status(404).json({ error: 'No pings found for this vehicle' });
  res.json({
    vehicle_id: String(pings[0].vehicle_id),
    timestamp: pings[0].timestamp,
    lat: pings[0].latitude,
    lng: pings[0].longitude,
    speed: pings[0].speed ?? null
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
