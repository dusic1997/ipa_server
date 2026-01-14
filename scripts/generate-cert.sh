#!/bin/bash

# Generate self-signed SSL certificate for IPA Server
# This script creates certificates that iOS devices can install and trust

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="$SCRIPT_DIR/../certs"

# Create certs directory if not exists
mkdir -p "$CERTS_DIR"

cd "$CERTS_DIR"

# Get the local IP address
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -1)

if [ -z "$LOCAL_IP" ]; then
    echo "Could not detect local IP address. Please enter it manually:"
    read -r LOCAL_IP
fi

echo "Using IP address: $LOCAL_IP"

# Create CA private key
openssl genrsa -out ca.key 2048

# Create CA certificate (this is what users will install on iOS)
openssl req -x509 -new -nodes -key ca.key -sha256 -days 365 \
    -out ca.crt \
    -subj "/C=CN/ST=Local/L=Local/O=IPA Server/OU=Development/CN=IPA Server CA"

# Create server private key
openssl genrsa -out server.key 2048

# Create server CSR configuration
cat > server.csr.conf << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
req_extensions = req_ext
distinguished_name = dn

[dn]
C = CN
ST = Local
L = Local
O = IPA Server
OU = Development
CN = $LOCAL_IP

[req_ext]
subjectAltName = @alt_names

[alt_names]
IP.1 = $LOCAL_IP
IP.2 = 127.0.0.1
DNS.1 = localhost
EOF

# Create server CSR
openssl req -new -key server.key -out server.csr -config server.csr.conf

# Create server certificate configuration
cat > server.ext << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
IP.1 = $LOCAL_IP
IP.2 = 127.0.0.1
DNS.1 = localhost
EOF

# Create server certificate signed by CA
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
    -out server.crt -days 365 -sha256 -extfile server.ext

# Clean up temporary files
rm -f server.csr server.csr.conf server.ext ca.srl

echo ""
echo "================================================"
echo "✅ SSL certificates generated successfully!"
echo "================================================"
echo ""
echo "📁 Files created in: $CERTS_DIR"
echo "   - ca.crt     (Install this on iOS devices)"
echo "   - ca.key     (CA private key)"
echo "   - server.crt (Server certificate)"
echo "   - server.key (Server private key)"
echo ""
echo "📱 To install on iOS device:"
echo "   1. Visit http://$LOCAL_IP:3080/certs/ca.crt on Safari"
echo "   2. Allow the profile download"
echo "   3. Go to Settings > General > VPN & Device Management"
echo "   4. Install the 'IPA Server CA' profile"
echo "   5. Go to Settings > General > About > Certificate Trust Settings"
echo "   6. Enable full trust for 'IPA Server CA'"
echo ""
echo "🔄 Now restart the server: npm start"
echo "================================================"
