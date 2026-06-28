const express = require('express');
const data = require('./seedTuk.json');

const app = express();
const port = 3000;

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
        speed: 0
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
  res.json(pings.map(p => ({ ping_id: p.id, vehicle_id: p.vehicle_id, timestamp: p.timestamp, lat: p.latitude, lng: p.longitude, speed: 0 })));
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
    speed: 0
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
