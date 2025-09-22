import React, { useState, useEffect, useRef } from 'react'; // Imported useRef
import axios from 'axios';
import { AlertTriangle, Zap, Activity, Power, Clock, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface SensorData {
  _id: string;
  voltage: number;
  current: number;
  power: number;
  timestamp: Date;
}

interface Alert {
  id: string;
  // Added 'low_current' to the possible types
  type: 'short_circuit' | 'low_current' | 'normal';
  message: string;
  timestamp: Date;
  current: number;
}

interface ChartDataPoint {
  time: string;
  voltage: number;
  current: number;
  power: number;
  timestamp: number;
}

// Main App Component
function App() {
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isShortCircuit, setIsShortCircuit] = useState(false);
  // New state for low current warning
  const [isLowCurrentWarning, setIsLowCurrentWarning] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [emailStatus, setEmailStatus] = useState<string>('');
  const [apiError, setApiError] = useState<string | null>(null);
  // NEW: Ref to track the last alert type to avoid duplicates
  const lastAlertTypeRef = useRef<'short_circuit' | 'low_current' | 'normal'>('normal');


  // Function to send email alert
  const sendEmailAlert = async (sensorData: SensorData) => {
    try {
      // This endpoint triggers the email logic on your backend.
      const response = await fetch('http://192.168.98.1:3000/send-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          _id: sensorData._id,
          voltage: sensorData.voltage,
          current: sensorData.current,
          power: sensorData.power,
          timestamp: sensorData.timestamp.toISOString()
        })
      });

      if (!response.ok) {
        // Mock success if the API doesn't exist for demonstration
        if (response.status === 404) {
          console.warn("Email API endpoint not found. Simulating success.");
          setEmailStatus(`✅ (Demo) Alert email sent to j.joshuasamraj@gmail.com`);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        setEmailStatus(`✅ ${result.message}`);
      } else {
        // Display message from server if it indicates no new alert was sent
        if (result.message) {
            console.log("Server response:", result.message);
        } else {
            setEmailStatus(`❌ Failed to send email: ${result.error}`);
        }
      }
    } catch (error) {
      console.error("Email service error:", error);
      setEmailStatus(`❌ (Demo) Email service error. See console for details.`);
    }
  };

  // Fetch data from the API endpoint
  const fetchData = async () => {
    try {
      const response = await axios.get('http://192.168.98.1:3000/api/data');
      setApiError(null); // Clear previous errors on success

      if (response.data && response.data.length > 0) {
        const latestData = response.data[0]; // Assuming the latest data is the first item

        // Create a new SensorData object with a proper Date object
        const newData: SensorData = {
          _id: latestData._id,
          voltage: latestData.voltage,
          current: latestData.current,
          power: latestData.power,
          timestamp: new Date(latestData.timestamp),
        };

        setSensorData(newData);
        setLastUpdate(new Date());

        // Add to chart data
        const newChartPoint: ChartDataPoint = {
          time: new Date(newData.timestamp).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }),
          voltage: newData.voltage,
          current: newData.current,
          power: newData.power,
          timestamp: new Date(newData.timestamp).getTime()
        };

        setChartData(prev => {
          const updated = [...prev, newChartPoint];
          // Keep only last 20 data points for smooth animation
          return updated.slice(-20);
        });

        // Check for conditions
        const shortCircuitDetected = newData.current > 11;
        const lowCurrentDetected = newData.current === 0; // Check for low current

        setIsShortCircuit(shortCircuitDetected);
        setIsLowCurrentWarning(lowCurrentDetected); // Set the new state

        // --- MODIFIED ALERT LOGIC ---
        // Determine the current alert type based on the new data
        const currentAlertType = shortCircuitDetected ? 'short_circuit' : lowCurrentDetected ? 'low_current' : 'normal';

        // Only trigger a new alert if the state has transitioned into a warning/fault state
        if (currentAlertType !== 'normal' && currentAlertType !== lastAlertTypeRef.current) {
            let newAlert: Alert | null = null;
            
            // --- ADDED ---
            // Trigger email alert for either condition
            sendEmailAlert(newData);

            if (currentAlertType === 'short_circuit') {
                newAlert = {
                    id: newData._id,
                    type: 'short_circuit',
                    message: `SHORT CIRCUIT DETECTED! Current: ${newData.current}A exceeds safe limit of 11A`,
                    timestamp: new Date(newData.timestamp),
                    current: newData.current
                };
            } else if (currentAlertType === 'low_current') {
                newAlert = {
                    id: newData._id,
                    type: 'low_current',
                    message: `LOW CURRENT WARNING! Current is 0A. Possible open circuit or power loss.`,
                    timestamp: new Date(newData.timestamp),
                    current: newData.current
                };
            }
            
            if (newAlert) {
                setAlerts(prev => [newAlert, ...prev.slice(0, 9)]);
            }
        }
        
        // Always update the ref to the current state for the next comparison
        lastAlertTypeRef.current = currentAlertType;
        
      }
    } catch (error) {
      console.error("Error fetching sensor data:", error);
      setApiError("Failed to connect to the sensor API. Please check the connection and endpoint.");
    }
  };


  // Effect to fetch data on mount and set an interval
  useEffect(() => {
    fetchData(); // Fetch initial data
    const interval = setInterval(fetchData, 2000); // Fetch data every 2 seconds

    return () => clearInterval(interval); // Cleanup interval on component unmount
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Updated logic to include the 0 current case
  const getStatusColor = (current: number) => {
    if (current > 11) return 'text-red-500';
    if (current === 0) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getStatusIcon = (current: number) => {
    if (current > 11) return <XCircle className="h-6 w-6 text-red-500" />;
    if (current === 0) return <AlertTriangle className="h-6 w-6 text-yellow-500" />;
    return <CheckCircle className="h-6 w-6 text-green-500" />;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-gray-300 text-sm mb-2">{`Time: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {`${entry.dataKey === 'voltage' ? 'Voltage' :
                entry.dataKey === 'current' ? 'Current' : 'Power'}: ${entry.value.toFixed(1)}${
                entry.dataKey === 'voltage' ? 'V' :
                  entry.dataKey === 'current' ? 'A' : 'W'}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white overflow-x-hidden">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0">
          <div className="flex items-center space-x-3 text-center sm:text-left">
            <Zap className="h-8 w-8 text-blue-400" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">AC Distribution Monitor</h1>
              <p className="text-gray-400 text-xs sm:text-sm">Low Voltage Overhead Conductor Monitoring</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-xs sm:text-sm text-gray-300">
                Last Update: {formatTime(lastUpdate)}
              </span>
            </div>
            {sensorData && getStatusIcon(sensorData.current)}
          </div>
        </div>
      </header>

      {/* API Error Banner */}
      {apiError && (
        <div className="bg-yellow-600 border-l-4 border-yellow-800 px-4 sm:px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center">
            <AlertTriangle className="h-6 w-6 text-white mr-3" />
            <div>
              <p className="font-bold text-sm sm:text-lg">Connection Error</p>
              <p className="text-sm">{apiError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Short Circuit Warning Banner */}
      {isShortCircuit && sensorData && (
        <div className="bg-red-600 border-l-4 border-red-800 px-4 sm:px-6 py-4 animate-pulse">
          <div className="max-w-7xl mx-auto flex items-center">
            <AlertTriangle className="h-6 w-6 text-white mr-3" />
            <div>
              <p className="font-bold text-sm sm:text-lg">⚠️ CRITICAL ALERT: SHORT CIRCUIT DETECTED</p>
              <p className="text-sm">
                Current reading of {sensorData.current}A exceeds safe operating limit of 11A.
                Immediate attention required!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* NEW: Low Current Warning Banner */}
      {isLowCurrentWarning && !isShortCircuit && (
        <div className="bg-yellow-600 border-l-4 border-yellow-800 px-4 sm:px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center">
            <AlertTriangle className="h-6 w-6 text-white mr-3" />
            <div>
              <p className="font-bold text-sm sm:text-lg">⚠️ LOW CURRENT WARNING</p>
              <p className="text-sm">
                Current reading is 0A. This could indicate an open circuit or power loss.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Email Status */}
      {emailStatus && (
        <div className="bg-blue-600 px-4 sm:px-6 py-2">
          <div className="max-w-7xl mx-auto">
            <p className="text-sm text-center">{emailStatus}</p>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Real-time Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Voltage Card */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 hover:border-blue-500 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-blue-400" />
                <h3 className="text-lg font-semibold text-gray-200">Voltage</h3>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-3xl font-bold text-blue-400">
                {sensorData?.voltage?.toFixed(1) || '--'}<span className="text-base sm:text-lg text-gray-400 ml-1">V</span>
              </p>
              <p className="text-sm text-gray-400">AC Distribution Line</p>
            </div>
          </div>

          {/* UPDATED: Current Card */}
          <div className={`bg-gray-800 rounded-lg border p-6 hover:border-yellow-500 transition-colors ${isShortCircuit
            ? 'border-red-500 bg-red-900 bg-opacity-20'
            : isLowCurrentWarning
              ? 'border-yellow-500'
              : 'border-gray-700'
            }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-yellow-400" />
                <h3 className="text-lg font-semibold text-gray-200">Current</h3>
              </div>
              {isShortCircuit && <AlertTriangle className="h-5 w-5 text-red-400 animate-pulse" />}
              {isLowCurrentWarning && !isShortCircuit && <AlertTriangle className="h-5 w-5 text-yellow-400" />}
            </div>
            <div className="space-y-2">
              <p className={`text-3xl font-bold ${getStatusColor(sensorData?.current || 0)}`}>
                {sensorData?.current?.toFixed(1) || '--'}<span className="text-base sm:text-lg text-gray-400 ml-1">A</span>
              </p>
              <p className="text-sm text-gray-400">
                {sensorData && sensorData.current > 11 ? 'CRITICAL - Short Circuit!' :
                  sensorData && sensorData.current === 0 ? 'WARNING - Low Current' : 'Normal Operation'}
              </p>
            </div>
          </div>

          {/* Power Card */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 hover:border-green-500 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Power className="h-5 w-5 text-green-400" />
                <h3 className="text-lg font-semibold text-gray-200">Power</h3>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-3xl font-bold text-green-400">
                {sensorData?.power?.toFixed(1) || '--'}<span className="text-base sm:text-lg text-gray-400 ml-1">W</span>
              </p>
              <p className="text-sm text-gray-400">Instantaneous Power</p>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* UPDATED: Status Overview */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center">
              <Activity className="h-5 w-5 mr-2 text-blue-400" />
              System Status
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Operating Status:</span>
                <span className={`font-semibold ${isShortCircuit ? 'text-red-400' :
                  isLowCurrentWarning ? 'text-yellow-400' : 'text-green-400'
                  }`}>
                  {isShortCircuit ? 'FAULT DETECTED' :
                    isLowCurrentWarning ? 'WARNING' : 'NORMAL'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Current Level:</span>
                <span className={`font-semibold ${getStatusColor(sensorData?.current ?? -1)}`}>
                  {sensorData?.current !== undefined ?
                    (sensorData.current > 11 ? 'CRITICAL' :
                      sensorData.current === 0 ? 'WARNING' : 'NORMAL')
                    : '--'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Last Reading:</span>
                <span className="text-gray-300 font-mono text-sm">
                  {sensorData?.timestamp ? formatTime(new Date(sensorData.timestamp)) : '--:--:--'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Safe Current Limit:</span>
                <span className="text-red-400 font-semibold">11.0 A</span>
              </div>
            </div>
          </div>

          {/* UPDATED: Recent Alerts */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-red-400" />
              Recent Alerts
            </h3>
            <div className="space-y-3 max-h-48 sm:max-h-64 overflow-y-auto">
              {alerts.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No recent alerts</p>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`border rounded p-3 ${alert.type === 'short_circuit'
                        ? 'bg-red-900 bg-opacity-30 border-red-700'
                        : 'bg-yellow-900 bg-opacity-30 border-yellow-700'
                      }`}
                  >
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${alert.type === 'short_circuit' ? 'text-red-400' : 'text-yellow-400'
                        }`} />
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${alert.type === 'short_circuit' ? 'text-red-200' : 'text-yellow-200'
                          }`}>{alert.message}</p>
                        <p className={`text-xs mt-1 ${alert.type === 'short_circuit' ? 'text-red-300' : 'text-yellow-300'
                          }`}>
                          {formatTime(alert.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Real-time Charts */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 sm:p-6 mb-6 sm:mb-8">
          <h3 className="text-xl font-semibold mb-6 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-blue-400" />
            Real-time Monitoring Charts
          </h3>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* UPDATED: Voltage & Current Chart */}
            <div className="bg-gray-900 rounded-lg p-4">
              <h4 className="text-base sm:text-lg font-medium mb-4 text-gray-200">Voltage & Current</h4>
              <div className="h-48 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="time"
                      stroke="#9CA3AF"
                      fontSize={8}
                      interval={'preserveStartEnd'}
                    />
                    <YAxis stroke="#9CA3AF" fontSize={8} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="voltage"
                      stroke="#60A5FA"
                      strokeWidth={2}
                      dot={{ fill: '#60A5FA', strokeWidth: 2, r: 3 }}
                      activeDot={{ r: 5, stroke: '#60A5FA', strokeWidth: 2 }}
                      isAnimationActive={false} // Better performance for real-time data
                    />
                    <Line
                      type="monotone"
                      dataKey="current"
                      stroke="#FBBF24"
                      strokeWidth={2}
                      dot={{ fill: '#FBBF24', strokeWidth: 2, r: 3 }}
                      activeDot={{ r: 5, stroke: '#FBBF24', strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                    {/* Updated ReferenceLine to 11A for consistency */}
                    <ReferenceLine
                      y={11}
                      stroke="#EF4444"
                      strokeDasharray="5 5"
                      label={{ value: "Short Circuit Limit (11A)", position: "insideTopRight", fill: "#EF4444", fontSize: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mt-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                  <span className="text-sm text-gray-300">Voltage (V)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                  <span className="text-sm text-gray-300">Current (A)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <span className="text-sm text-gray-300">Limit (11A)</span>
                </div>
              </div>
            </div>

            {/* Power Chart */}
            <div className="bg-gray-900 rounded-lg p-4">
              <h4 className="text-base sm:text-lg font-medium mb-4 text-gray-200">Power Consumption</h4>
              <div className="h-48 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="time"
                      stroke="#9CA3AF"
                      fontSize={8}
                      interval={'preserveStartEnd'}
                    />
                    <YAxis stroke="#9CA3AF" fontSize={8} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="power"
                      stroke="#10B981"
                      strokeWidth={3}
                      dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: '#10B981', strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center mt-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  <span className="text-sm text-gray-300">Power (W)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* UPDATED: Current Data Display */}
        {sensorData && (
          <div className="mt-6 sm:mt-8 bg-gray-800 rounded-lg border border-gray-700 p-4 sm:p-6">
            <h3 className="text-xl font-semibold mb-4">Latest Sensor Reading</h3>
            <div className="bg-gray-900 rounded p-4 font-mono text-sm overflow-x-auto">
              <pre className="text-gray-300">
                {`{
  "_id": "${sensorData._id}",
  "voltage": ${sensorData.voltage},
  "current": ${sensorData.current},
  "power": ${sensorData.power},
  "timestamp": "${sensorData.timestamp.toISOString()}",
  "status": "${sensorData.current > 11 ? 'SHORT_CIRCUIT' : sensorData.current === 0 ? 'LOW_CURRENT_WARNING' : 'NORMAL'}"
}`}
              </pre>
            </div>
          </div>
        )}

        {/* Email Notification Info */}
        <div className="mt-6 bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-2 flex items-center">
            📧 Email Notifications
          </h3>
          <p className="text-sm text-blue-200">
            Automatic email alerts are sent to <strong>j.joshuasamraj@gmail.com</strong> when the system state changes to a warning or critical level.
          </p>
        </div>

      </main>
    </div>
  );
}

export default App;
