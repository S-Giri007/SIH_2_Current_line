/*
  # Unified Sensor Data and Email Alert Server (Node.js)

  1. Purpose
    - Connects to MongoDB to store and retrieve sensor data.
    - Provides an API endpoint to fetch sensor data for the frontend.
    - Provides an endpoint to receive new sensor data.
    - Sends Gmail notifications via a separate endpoint when triggered by the frontend.

  2. Functionality
    - `POST /data`: Receives sensor data and saves it to MongoDB.
    - `GET /api/data`: Fetches the latest 50 sensor readings for the dashboard.
    - `POST /send-alert`: Receives sensor data and sends a formatted alert email if the current exceeds the safe limit.

  3. Security
    - CORS enabled for frontend access.
    - Input validation for sensor data on the alert endpoint.
    - Error handling for database and email delivery failures.
*/

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import os from 'os';
import nodemailer from 'nodemailer';
// import dotenv from 'dotenv';

// Load environment variables from .env file
// dotenv.config();

const app = express();
const PORT = 3000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Enable JSON body parsing
app.use(express.static('public')); // serve static files

// MongoDB connection
mongoose.connect('mongodb+srv://giri:Sgiri%40123@giridb.ruxfhu5.mongodb.net/SIH_2', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("MongoDB connected successfully"))
  .catch(err => console.error("MongoDB connection error:", err));

// MongoDB schema
const SensorSchema = new mongoose.Schema({
  voltage: Number,
  current: Number,
  power: Number,
  timestamp: { type: Date, default: Date.now }
});
const SensorData = mongoose.model('Nodemcu', SensorSchema, 'Nodemcu');

// Endpoint to receive and store ESP8266 data
app.post('/data', async (req, res) => {
  try {
    const { voltage, current, power } = req.body;
    const data = new SensorData({ voltage, current, power });
    await data.save();
    res.status(200).send("Data saved successfully");
  } catch (err) {
    console.error("Error saving data:", err);
    res.status(500).send("Error saving data");
  }
});

// Endpoint to fetch all sensor data for the frontend
app.get('/api/data', async (req, res) => {
  try {
    const data = await SensorData.find().sort({ timestamp: -1 }).limit(50); // latest 50
    res.json(data);
  } catch (err) {
    console.error("Error fetching data:", err);
    res.status(500).send("Error fetching data");
  }
});

// Endpoint to handle sending email alerts
app.post('/send-alert', async (req, res) => {
    try {
        const sensorData = req.body;

        // Validate sensor data
        if (!sensorData || typeof sensorData.current !== 'number') {
            return res.status(400).json({ error: "Invalid sensor data" });
        }

        // Only send email if current exceeds limit
        if (sensorData.current <= 12) {
            return res.status(200).json({ message: "Current within normal limits, no email sent" });
        }

        // Create email transporter
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: "j.joshuasamraj@gmail.com",
                pass: "mpmb bphi dnyd aqut"
            }
        });

        const timestamp = new Date(sensorData.timestamp).toLocaleString('en-US', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
              .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
              .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
              .content { padding: 30px; }
              .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 15px; margin: 20px 0; }
              .data-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              .data-table th, .data-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
              .data-table th { background: #f9fafb; font-weight: 600; }
              .critical { color: #dc2626; font-weight: bold; }
              .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🚨 CRITICAL ALERT: SHORT CIRCUIT DETECTED</h1>
                <p>AC Distribution Overhead Conductor Monitoring System</p>
              </div>
              <div class="content">
                <div class="alert-box">
                  <h2 style="color: #dc2626; margin-top: 0;">⚠️ IMMEDIATE ACTION REQUIRED</h2>
                  <p>A short circuit condition has been detected. The current reading has exceeded the safe operating limit of 12A.</p>
                </div>
                <h3>Sensor Reading Details:</h3>
                <table class="data-table">
                  <tr><th>Parameter</th><th>Value</th><th>Status</th></tr>
                  <tr><td>Current</td><td class="critical">${sensorData.current.toFixed(1)} A</td><td class="critical">CRITICAL</td></tr>
                  <tr><td>Voltage</td><td>${sensorData.voltage.toFixed(1)} V</td><td>Normal</td></tr>
                  <tr><td>Power</td><td>${sensorData.power.toFixed(1)} W</td><td>High</td></tr>
                  <tr><td>Timestamp</td><td>${timestamp}</td><td>-</td></tr>
                  <tr><td>Sensor ID</td><td>${sensorData._id}</td><td>-</td></tr>
                </table>
                <h3>Recommended Actions:</h3>
                <ol>
                  <li>Immediately inspect the overhead conductor for physical damage</li>
                  <li>Check for fallen branches or debris on the lines</li>
                  <li>Verify all connections and insulators</li>
                </ol>
              </div>
              <div class="footer">
                <p>This is an automated alert from the AC Distribution Monitoring System</p>
              </div>
            </div>
          </body>
          </html>
        `;

        const mailOptions = {
            from: `AC Monitor From Joshua Samraj`,
            to: 'j.joshuasamraj@gmail.com',
            subject: `🚨 CRITICAL ALERT: Short Circuit Detected - Current: ${sensorData.current.toFixed(1)}A`,
            html: emailHtml
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json(
          { 
            success: true, 
            message: "Alert email sent successfully",
            recipient: "j.joshuasamraj@gmail.com"
        });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ 
            error: "Failed to send alert email", 
            details: error.message 
        });
    }
});


// Function to get local IP for display message
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const ifaceName in interfaces) {
    const iface = interfaces[ifaceName];
    for (let i = 0; i < iface.length; i++) {
      const details = iface[i];
      if (details.family === 'IPv4' && !details.internal) {
        return details.address;
      }
    }
  }
  return '127.0.0.1';
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://${getLocalIP()}:${PORT}`);
});
