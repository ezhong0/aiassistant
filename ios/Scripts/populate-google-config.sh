#!/bin/bash

#
# populate-google-config.sh
# AssistantApp
#
# This script populates Google configuration from environment-specific plist files
# Add this as a "Run Script" build phase in Xcode BEFORE "Compile Sources"
#

set -e

echo "🔧 Populating Google configuration for build..."

# Determine current configuration
if [[ "${CONFIGURATION}" == *"Production"* ]]; then
    ENV="Production"
    GOOGLE_CONFIG_FILE="${SRCROOT}/AssistantApp/Configuration/GoogleClient-Production.plist"
elif [[ "${CONFIGURATION}" == *"Staging"* ]]; then
    ENV="Staging"
    GOOGLE_CONFIG_FILE="${SRCROOT}/AssistantApp/Configuration/GoogleClient-Staging.plist"
else
    ENV="Development"
    GOOGLE_CONFIG_FILE="${SRCROOT}/AssistantApp/Configuration/GoogleClient-Development.plist"
fi

echo "📱 Environment: ${ENV}"
echo "📄 Google config file: ${GOOGLE_CONFIG_FILE}"

# Check if Google config file exists
if [ ! -f "${GOOGLE_CONFIG_FILE}" ]; then
    echo "❌ ERROR: Google configuration file not found: ${GOOGLE_CONFIG_FILE}"
    exit 1
fi

# Extract Google configuration values
GOOGLE_CLIENT_ID=$(/usr/libexec/PlistBuddy -c "Print CLIENT_ID" "${GOOGLE_CONFIG_FILE}" 2>/dev/null || echo "")
GOOGLE_REVERSED_CLIENT_ID=$(/usr/libexec/PlistBuddy -c "Print REVERSED_CLIENT_ID" "${GOOGLE_CONFIG_FILE}" 2>/dev/null || echo "")
GOOGLE_BUNDLE_ID=$(/usr/libexec/PlistBuddy -c "Print BUNDLE_ID" "${GOOGLE_CONFIG_FILE}" 2>/dev/null || echo "")

# Validate Google Client ID
if [ -z "${GOOGLE_CLIENT_ID}" ]; then
    echo "❌ ERROR: CLIENT_ID is missing from ${GOOGLE_CONFIG_FILE}"
    exit 1
fi

if [[ "${GOOGLE_CLIENT_ID}" == *"REPLACE_WITH"* ]]; then
    if [[ "${ENV}" == "Production" ]]; then
        echo "❌ ERROR: Production build requires a real Google CLIENT_ID"
        echo "   Current value: ${GOOGLE_CLIENT_ID}"
        echo "   Please configure ${GOOGLE_CONFIG_FILE} with your production Google Client ID"
        exit 1
    else
        echo "⚠️  WARNING: ${ENV} environment has placeholder Google CLIENT_ID: ${GOOGLE_CLIENT_ID}"
    fi
fi

# Validate Reversed Client ID
if [ -z "${GOOGLE_REVERSED_CLIENT_ID}" ]; then
    echo "❌ ERROR: REVERSED_CLIENT_ID is missing from ${GOOGLE_CONFIG_FILE}"
    exit 1
fi

if [[ "${GOOGLE_REVERSED_CLIENT_ID}" == *"REPLACE_WITH"* ]]; then
    if [[ "${ENV}" == "Production" ]]; then
        echo "❌ ERROR: Production build requires a real Google REVERSED_CLIENT_ID"
        echo "   Current value: ${GOOGLE_REVERSED_CLIENT_ID}"
        echo "   Please configure ${GOOGLE_CONFIG_FILE} with your production Google Reversed Client ID"
        exit 1
    else
        echo "⚠️  WARNING: ${ENV} environment has placeholder REVERSED_CLIENT_ID: ${GOOGLE_REVERSED_CLIENT_ID}"
    fi
fi

echo "✅ Google configuration validation passed for ${ENV} environment"
echo "📋 Google Configuration:"
echo "   Client ID: ${GOOGLE_CLIENT_ID:0:20}..."
echo "   Reversed Client ID: ${GOOGLE_REVERSED_CLIENT_ID:0:30}..."
echo "   Bundle ID: ${GOOGLE_BUNDLE_ID}"

# Update the xcconfig file with Google configuration
ENV_XCCONFIG_FILE="${SRCROOT}/Configuration/${ENV}.xcconfig"

if [ -f "${ENV_XCCONFIG_FILE}" ]; then
    echo "📝 Updating ${ENV_XCCONFIG_FILE} with Google configuration"
    
    # Create a backup
    cp "${ENV_XCCONFIG_FILE}" "${ENV_XCCONFIG_FILE}.backup"
    
    # Update the GOOGLE_REVERSED_CLIENT_ID in the xcconfig file
    if grep -q "GOOGLE_REVERSED_CLIENT_ID.*REPLACE_WITH" "${ENV_XCCONFIG_FILE}"; then
        sed -i '' "s|GOOGLE_REVERSED_CLIENT_ID = REPLACE_WITH.*|GOOGLE_REVERSED_CLIENT_ID = ${GOOGLE_REVERSED_CLIENT_ID}|" "${ENV_XCCONFIG_FILE}"
        echo "✅ Updated GOOGLE_REVERSED_CLIENT_ID in ${ENV_XCCONFIG_FILE}"
    else
        echo "ℹ️  GOOGLE_REVERSED_CLIENT_ID already configured in ${ENV_XCCONFIG_FILE}"
    fi
else
    echo "⚠️  WARNING: xcconfig file not found: ${ENV_XCCONFIG_FILE}"
fi

# Also create a temporary xcconfig file for additional build variables
TEMP_GOOGLE_CONFIG="${DERIVED_FILE_DIR}/GoogleConfig.xcconfig"
cat > "${TEMP_GOOGLE_CONFIG}" << EOF
// Auto-generated Google configuration for ${ENV}
// Generated on: $(date)

GOOGLE_CLIENT_ID = ${GOOGLE_CLIENT_ID}
GOOGLE_REVERSED_CLIENT_ID = ${GOOGLE_REVERSED_CLIENT_ID}
GOOGLE_BUNDLE_ID = ${GOOGLE_BUNDLE_ID}
EOF

echo "📝 Created temporary Google config: ${TEMP_GOOGLE_CONFIG}"

# Copy the appropriate GoogleService-Info.plist if it exists
GOOGLE_SERVICE_INFO_SOURCE="${SRCROOT}/AssistantApp/Configuration/GoogleService-Info-${ENV}.plist"
GOOGLE_SERVICE_INFO_DEST="${BUILT_PRODUCTS_DIR}/${PRODUCT_NAME}.app/GoogleService-Info.plist"

if [ -f "${GOOGLE_SERVICE_INFO_SOURCE}" ]; then
    echo "📋 Copying GoogleService-Info.plist for ${ENV}"
    cp "${GOOGLE_SERVICE_INFO_SOURCE}" "${GOOGLE_SERVICE_INFO_DEST}"
else
    echo "ℹ️  No environment-specific GoogleService-Info.plist found for ${ENV}"
    echo "   Looking for: ${GOOGLE_SERVICE_INFO_SOURCE}"
fi

echo "🎉 Google configuration populated successfully!"