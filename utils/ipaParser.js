const JSZip = require('jszip');
const plist = require('plist');
const bplistParser = require('bplist-parser');
const fs = require('fs');
const path = require('path');

/**
 * Parse IPA file and extract app information
 * @param {string} ipaPath - Path to the IPA file
 * @returns {Promise<Object>} App information
 */
async function parseIPA(ipaPath) {
    const data = fs.readFileSync(ipaPath);
    const zip = await JSZip.loadAsync(data);

    // Find the .app directory inside Payload
    let appDir = null;
    let infoPlistPath = null;

    for (const fileName of Object.keys(zip.files)) {
        if (fileName.match(/^Payload\/[^/]+\.app\/Info\.plist$/)) {
            infoPlistPath = fileName;
            appDir = fileName.replace('/Info.plist', '');
            break;
        }
    }

    if (!infoPlistPath) {
        throw new Error('Could not find Info.plist in IPA');
    }

    // Read and parse Info.plist
    const plistData = await zip.file(infoPlistPath).async('nodebuffer');
    let info;

    // Check if it's a binary plist (starts with 'bplist')
    const isBinary = plistData.slice(0, 6).toString() === 'bplist';

    if (isBinary) {
        // Parse binary plist
        try {
            const parsed = bplistParser.parseBuffer(plistData);
            info = parsed[0];
        } catch (bplistError) {
            throw new Error('Failed to parse binary plist: ' + bplistError.message);
        }
    } else {
        // Parse XML plist
        try {
            info = plist.parse(plistData.toString('utf8'));
        } catch (xmlError) {
            throw new Error('Failed to parse XML plist: ' + xmlError.message);
        }
    }

    // Extract basic info
    const appInfo = {
        name: info.CFBundleDisplayName || info.CFBundleName || 'Unknown',
        bundleId: info.CFBundleIdentifier || 'com.unknown.app',
        version: info.CFBundleShortVersionString || '1.0',
        buildVersion: info.CFBundleVersion || '1',
        minimumOSVersion: info.MinimumOSVersion || '9.0'
    };

    // Try to extract icon
    try {
        const iconInfo = await extractIcon(zip, appDir, info);
        if (iconInfo) {
            appInfo.icon = iconInfo;
        }
    } catch (iconError) {
        console.log('Could not extract icon:', iconError.message);
    }

    return appInfo;
}

/**
 * Extract app icon from IPA
 */
async function extractIcon(zip, appDir, info) {
    // Possible icon names from Info.plist
    const iconNames = [];

    // Check CFBundleIcons for iOS 5+
    if (info.CFBundleIcons && info.CFBundleIcons.CFBundlePrimaryIcon) {
        const primaryIcon = info.CFBundleIcons.CFBundlePrimaryIcon;
        if (primaryIcon.CFBundleIconFiles) {
            iconNames.push(...primaryIcon.CFBundleIconFiles);
        }
    }

    // Check CFBundleIconFiles (older apps)
    if (info.CFBundleIconFiles) {
        iconNames.push(...info.CFBundleIconFiles);
    }

    // Common icon filenames
    const commonIcons = [
        'AppIcon60x60@3x.png',
        'AppIcon60x60@2x.png',
        'AppIcon76x76@2x.png',
        'AppIcon-60@3x.png',
        'AppIcon-60@2x.png',
        'Icon-60@3x.png',
        'Icon-60@2x.png',
        'Icon@3x.png',
        'Icon@2x.png',
        'Icon.png',
        'AppIcon.png'
    ];

    // Add variations of iconNames
    for (const name of [...iconNames]) {
        iconNames.push(`${name}.png`);
        iconNames.push(`${name}@2x.png`);
        iconNames.push(`${name}@3x.png`);
    }

    // Combine all possible names
    const allPossibleIcons = [...new Set([...iconNames, ...commonIcons])];

    // Try to find an icon file
    for (const iconName of allPossibleIcons) {
        const iconPath = `${appDir}/${iconName}`;
        const file = zip.file(iconPath);

        if (file) {
            const iconData = await file.async('nodebuffer');

            // Check if this is a PNG with Apple's CgBI header (crushed PNG)
            const isCrushed = iconData.length > 8 &&
                iconData[0] === 0x89 &&
                iconData[1] === 0x50 &&
                iconData[2] === 0x4E &&
                iconData[3] === 0x47;

            // Save the icon
            const iconFileName = `icon_${Date.now()}.png`;
            const iconsDir = path.join(__dirname, '..', 'public', 'icons');

            if (!fs.existsSync(iconsDir)) {
                fs.mkdirSync(iconsDir, { recursive: true });
            }

            const iconSavePath = path.join(iconsDir, iconFileName);
            fs.writeFileSync(iconSavePath, iconData);

            return `/icons/${iconFileName}`;
        }
    }

    return null;
}

module.exports = { parseIPA };
