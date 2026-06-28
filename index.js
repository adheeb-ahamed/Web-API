const express = require('express');
const data = require('./seedTuk.json');

const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.json({ status: 'ok', session: 'NB6007CEM S2' });
});

app.get('/provinces', (req, res) => {
  res.json(data.provinces);
});

app.get('/provinces/:provinceId', (req, res) => {
  const province = data.provinces.find(p => p.id === Number(req.params.provinceId));
  if (!province) return res.status(404).json({ error: 'Province not found' });
  res.json(province);
});

app.get('/districts', (req, res) => {
  res.json(data.districts);
});

app.get('/districts/:districtId', (req, res) => {
  const district = data.districts.find(d => d.id === Number(req.params.districtId));
  if (!district) return res.status(404).json({ error: 'District not found' });
  res.json(district);
});

app.get('/stations', (req, res) => {
  res.json(data.stations);
});

app.get('/stations/:stationId', (req, res) => {
  const station = data.stations.find(s => s.id === Number(req.params.stationId));
  if (!station) return res.status(404).json({ error: 'Station not found' });
  res.json(station);
});

app.get('/vehicles', (req, res) => {
  res.json(data.vehicles);
});

app.get('/vehicles/:vehicleId', (req, res) => {
  const vehicle = data.vehicles.find(v => v.id === Number(req.params.vehicleId));
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  res.json(vehicle);
});

app.get('/vehicles/:vehicleId/pings', (req, res) => {
  const vehicle = data.vehicles.find(v => v.id === Number(req.params.vehicleId));
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  const pings = data.pings.filter(p => p.vehicle_id === vehicle.id);
  res.json(pings);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
