const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const HTTP_PORT = process.env.HTTP_PORT || 3080;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded IPA files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve SSL certificates for download
app.use('/certs', express.static(path.join(__dirname, 'certs')));

// API routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Manifest.plist route (needs to be at root level for iOS)
app.get('/manifest/:appId', (req, res) => {
    const { generateManifest } = require('./utils/manifestGenerator');
    const appsPath = path.join(__dirname, 'data', 'apps.json');

    try {
        const apps = JSON.parse(fs.readFileSync(appsPath, 'utf8'));
        const app = apps.find(a => a.id === req.params.appId);

        if (!app) {
            return res.status(404).send('App not found');
        }

        // Get the host from request
        const host = req.get('host');
        const protocol = 'https';
        const baseUrl = `${protocol}://${host}`;

        const manifest = generateManifest(app, baseUrl);
        res.set('Content-Type', 'text/xml');
        res.send(manifest);
    } catch (error) {
        console.error('Error generating manifest:', error);
        res.status(500).send('Error generating manifest');
    }
});

// Main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ensure required directories exist
const dirs = ['uploads', 'data', 'certs'];
dirs.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
});

// Initialize apps.json if not exists
const appsPath = path.join(__dirname, 'data', 'apps.json');
if (!fs.existsSync(appsPath)) {
    fs.writeFileSync(appsPath, '[]');
}

// Check for SSL certificates
const certPath = path.join(__dirname, 'certs', 'server.crt');
const keyPath = path.join(__dirname, 'certs', 'server.key');

// Get local IP address
function getLocalIP() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const localIP = getLocalIP();

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    // Start HTTPS server
    const httpsOptions = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
    };

    https.createServer(httpsOptions, app).listen(PORT, '0.0.0.0', () => {
        console.log('================================================');
        console.log('🚀 IPA Server is running!');
        console.log('================================================');
        console.log(`📱 HTTPS: https://${localIP}:${PORT}`);
        console.log(`💻 Local: https://localhost:${PORT}`);
        console.log('================================================');
        console.log('⚠️  First time on iOS? Install the certificate:');
        console.log(`   https://${localIP}:${PORT}/certs/ca.crt`);
        console.log('================================================');
    });

    // Also start HTTP server for certificate download
    http.createServer(app).listen(HTTP_PORT, '0.0.0.0', () => {
        console.log(`📦 HTTP (for cert): http://${localIP}:${HTTP_PORT}`);
    });
} else {
    // Start HTTP server (for development/testing)
    console.log('⚠️  SSL certificates not found!');
    console.log('   Run: npm run generate-cert');
    console.log('   Then restart the server.');
    console.log('');
    console.log('   Starting HTTP server for now (iOS install will not work)');

    http.createServer(app).listen(PORT, '0.0.0.0', () => {
        console.log(`🌐 HTTP: http://${localIP}:${PORT}`);
    });
}
