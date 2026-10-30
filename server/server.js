const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/db');
const microclimateRoutes = require('./routes/microclimateRoutes');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

connectDB();

app.use('/api/microclimate', microclimateRoutes);

app.get('/', (req, res) => {
  res.send('Microclimate Monitoring API Server is active.');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Express Server running on port ${PORT}`);
});