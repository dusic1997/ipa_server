const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { parseIPA } = require('../utils/ipaParser');

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'uploads');
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}.ipa`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() === '.ipa') {
            cb(null, true);
        } else {
            cb(new Error('Only .ipa files are allowed'), false);
        }
    },
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB limit
    }
});

const appsPath = path.join(__dirname, '..', 'data', 'apps.json');

// Helper to read apps
function getApps() {
    try {
        return JSON.parse(fs.readFileSync(appsPath, 'utf8'));
    } catch {
        return [];
    }
}

// Helper to save apps
function saveApps(apps) {
    fs.writeFileSync(appsPath, JSON.stringify(apps, null, 2));
}

// Upload IPA file
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = req.file.path;

        // Parse IPA to get app info
        let appInfo;
        try {
            appInfo = await parseIPA(filePath);
        } catch (parseError) {
            // Clean up the uploaded file if parsing fails
            fs.unlinkSync(filePath);
            return res.status(400).json({ error: 'Failed to parse IPA file: ' + parseError.message });
        }

        // Create app record
        const app = {
            id: uuidv4(),
            name: appInfo.name || 'Unknown App',
            bundleId: appInfo.bundleId || 'com.unknown.app',
            version: appInfo.version || '1.0',
            buildVersion: appInfo.buildVersion || '1',
            fileName: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            icon: appInfo.icon || null,
            uploadedAt: new Date().toISOString()
        };

        // Save to apps.json
        const apps = getApps();
        apps.unshift(app);
        saveApps(apps);

        res.json({ success: true, app });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Upload failed: ' + error.message });
    }
});

// Get all apps
router.get('/apps', (req, res) => {
    const apps = getApps();
    res.json(apps);
});

// Get single app
router.get('/apps/:id', (req, res) => {
    const apps = getApps();
    const app = apps.find(a => a.id === req.params.id);

    if (!app) {
        return res.status(404).json({ error: 'App not found' });
    }

    res.json(app);
});

// Delete app
router.delete('/apps/:id', (req, res) => {
    const apps = getApps();
    const appIndex = apps.findIndex(a => a.id === req.params.id);

    if (appIndex === -1) {
        return res.status(404).json({ error: 'App not found' });
    }

    const app = apps[appIndex];

    // Delete the IPA file
    const filePath = path.join(__dirname, '..', 'uploads', app.fileName);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    // Delete icon if exists
    if (app.icon) {
        const iconPath = path.join(__dirname, '..', 'public', app.icon);
        if (fs.existsSync(iconPath)) {
            fs.unlinkSync(iconPath);
        }
    }

    // Remove from apps list
    apps.splice(appIndex, 1);
    saveApps(apps);

    res.json({ success: true });
});

// Generate QR code for install URL
router.get('/qrcode/:id', async (req, res) => {
    const QRCode = require('qrcode');
    const apps = getApps();
    const app = apps.find(a => a.id === req.params.id);

    if (!app) {
        return res.status(404).json({ error: 'App not found' });
    }

    const host = req.get('host');
    const manifestUrl = encodeURIComponent(`https://${host}/manifest/${app.id}`);
    const installUrl = `itms-services://?action=download-manifest&url=${manifestUrl}`;

    try {
        const qrDataUrl = await QRCode.toDataURL(installUrl, {
            width: 256,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });

        res.json({ qrcode: qrDataUrl, installUrl });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

module.exports = router;
