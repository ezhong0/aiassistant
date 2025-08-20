#!/bin/bash

#
# validate-configuration.sh
# AssistantApp
#
# This script validates the app configuration at build time
# Add this as a "Run Script" build phase in Xcode
#

set -e

echo "🔧 Validating app configuration..."

# Determine current configuration
if [[ "${CONFIGURATION}" == *"Production"* ]]; then
    ENV="Production"
    CONFIG_FILE="${SRCROOT}/AssistantApp/Configuration/Production.plist"
elif [[ "${CONFIGURATION}" == *"Staging"* ]]; then
    ENV="Staging"
    CONFIG_FILE="${SRCROOT}/AssistantApp/Configuration/Staging.plist"
else
    ENV="Development"
    CONFIG_FILE="${SRCROOT}/AssistantApp/Configuration/Development.plist"
fi

echo "📱 Environment: ${ENV}"
echo "📄 Config file: ${CONFIG_FILE}"

# Check if config file exists
if [ ! -f "${CONFIG_FILE}" ]; then
    echo "❌ ERROR: Configuration file not found: ${CONFIG_FILE}"
    exit 1
fi

# Extract values from plist using PlistBuddy
BACKEND_URL=$(/usr/libexec/PlistBuddy -c "Print BackendBaseURL" "${CONFIG_FILE}" 2>/dev/null || echo "")
GOOGLE_CLIENT_ID=$(/usr/libexec/PlistBuddy -c "Print GoogleClientID" "${CONFIG_FILE}" 2>/dev/null || echo "")

# Validate Backend URL
if [ -z "${BACKEND_URL}" ]; then
    echo "❌ ERROR: BackendBaseURL is missing from ${CONFIG_FILE}"
    exit 1
fi

if [[ "${BACKEND_URL}" == *"REPLACE_WITH"* ]]; then
    if [[ "${ENV}" == "Production" ]]; then
        echo "❌ ERROR: Production build requires a real BackendBaseURL"
        echo "   Current value: ${BACKEND_URL}"
        echo "   Please update ${CONFIG_FILE} with your production URL"
        exit 1
    else
        echo "⚠️  WARNING: ${ENV} environment has placeholder BackendBaseURL: ${BACKEND_URL}"
    fi
fi

# Validate Google Client ID
if [ -z "${GOOGLE_CLIENT_ID}" ]; then
    echo "❌ ERROR: GoogleClientID is missing from ${CONFIG_FILE}"
    exit 1
fi

if [[ ! "${GOOGLE_CLIENT_ID}" == *".apps.googleusercontent.com" ]]; then
    echo "❌ ERROR: GoogleClientID format appears invalid: ${GOOGLE_CLIENT_ID}"
    exit 1
fi

# Validate HTTPS for production
if [[ "${ENV}" == "Production" ]] && [[ ! "${BACKEND_URL}" == https://* ]]; then
    echo "❌ ERROR: Production builds must use HTTPS"
    echo "   Current URL: ${BACKEND_URL}"
    exit 1
fi

# Validate localhost not used in production
if [[ "${ENV}" == "Production" ]] && [[ "${BACKEND_URL}" == *"localhost"* ]]; then
    echo "❌ ERROR: Production builds cannot use localhost"
    echo "   Current URL: ${BACKEND_URL}"
    exit 1
fi

echo "✅ Configuration validation passed for ${ENV} environment"

# ATS (App Transport Security) Validation
echo "🔒 Validating App Transport Security configuration..."

# Determine Info.plist file based on environment
if [[ "${ENV}" == "Production" ]]; then
    INFO_PLIST="${SRCROOT}/AssistantApp/Supporting Files/Info-Production.plist"
elif [[ "${ENV}" == "Staging" ]]; then
    INFO_PLIST="${SRCROOT}/AssistantApp/Supporting Files/Info-Staging.plist"
else
    INFO_PLIST="${SRCROOT}/AssistantApp/Supporting Files/Info-Development.plist"
fi

# Check if Info.plist exists
if [ ! -f "${INFO_PLIST}" ]; then
    echo "❌ ERROR: Info.plist not found: ${INFO_PLIST}"
    exit 1
fi

# Extract ATS values
ATS_ARBITRARY_LOADS=$(/usr/libexec/PlistBuddy -c "Print NSAppTransportSecurity:NSAllowsArbitraryLoads" "${INFO_PLIST}" 2>/dev/null || echo "false")
ATS_LOCAL_NETWORKING=$(/usr/libexec/PlistBuddy -c "Print NSAppTransportSecurity:NSAllowsLocalNetworking" "${INFO_PLIST}" 2>/dev/null || echo "false")

echo "📋 ATS Configuration:"
echo "   Arbitrary Loads: ${ATS_ARBITRARY_LOADS}"
echo "   Local Networking: ${ATS_LOCAL_NETWORKING}"

# Validate ATS for production
if [[ "${ENV}" == "Production" ]]; then
    if [[ "${ATS_ARBITRARY_LOADS}" == "true" ]]; then
        echo "❌ ERROR: Production builds must not allow arbitrary loads"
        echo "   NSAllowsArbitraryLoads should be false in production"
        exit 1
    fi
    
    if [[ "${ATS_LOCAL_NETWORKING}" == "true" ]]; then
        echo "❌ ERROR: Production builds must not allow local networking"
        echo "   NSAllowsLocalNetworking should be false in production"
        exit 1
    fi
    
    echo "✅ ATS configuration is secure for production"
elif [[ "${ENV}" == "Development" ]]; then
    if [[ "${ATS_ARBITRARY_LOADS}" == "true" ]]; then
        echo "⚠️  WARNING: Development allows arbitrary loads - ensure this is intentional"
    fi
    
    if [[ "${ATS_LOCAL_NETWORKING}" == "true" ]]; then
        echo "ℹ️  INFO: Development allows local networking for localhost development"
    fi
    
    echo "✅ ATS configuration allows development flexibility"
else
    # Staging
    if [[ "${ATS_ARBITRARY_LOADS}" == "true" ]]; then
        echo "⚠️  WARNING: Staging allows arbitrary loads - consider restricting for security"
    fi
    
    echo "✅ ATS configuration validated for staging"
fi
echo "   Backend URL: ${BACKEND_URL}"
echo "   Client ID: ${GOOGLE_CLIENT_ID:0:20}..."

# Create a build info file that can be accessed by the app
BUILD_INFO_FILE="${BUILT_PRODUCTS_DIR}/${PRODUCT_NAME}.app/BuildInfo.plist"
cat > "${BUILD_INFO_FILE}" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Environment</key>
    <string>${ENV}</string>
    <key>BuildDate</key>
    <string>$(date -u +"%Y-%m-%d %H:%M:%S UTC")</string>
    <key>GitCommit</key>
    <string>$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")</string>
    <key>XcodeVersion</key>
    <string>${XCODE_VERSION_ACTUAL}</string>
</dict>
</plist>
EOF

echo "📋 Build info written to ${BUILD_INFO_FILE}"
echo "🎉 Configuration validation complete!"