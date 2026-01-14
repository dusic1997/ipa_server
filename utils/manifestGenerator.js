const plist = require('plist');

/**
 * Generate manifest.plist for iOS OTA installation
 * @param {Object} app - App information
 * @param {string} baseUrl - Base URL of the server
 * @returns {string} manifest.plist XML content
 */
function generateManifest(app, baseUrl) {
    const manifest = {
        items: [
            {
                assets: [
                    {
                        kind: 'software-package',
                        url: `${baseUrl}/uploads/${app.fileName}`
                    }
                ],
                metadata: {
                    'bundle-identifier': app.bundleId,
                    'bundle-version': app.version,
                    kind: 'software',
                    title: app.name
                }
            }
        ]
    };

    // Add icon if available
    if (app.icon) {
        manifest.items[0].assets.push({
            kind: 'display-image',
            url: `${baseUrl}${app.icon}`
        });
        manifest.items[0].assets.push({
            kind: 'full-size-image',
            url: `${baseUrl}${app.icon}`
        });
    }

    return plist.build(manifest);
}

module.exports = { generateManifest };
