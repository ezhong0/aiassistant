#!/bin/bash

echo "🚀 Setting up iOS development environment for AssistantAppRN..."

# Check if Xcode is installed
if ! command -v xcodebuild &> /dev/null; then
    echo "❌ Xcode is not installed. Please install Xcode from the App Store first."
    exit 1
fi

echo "✅ Xcode is installed"

# Check if CocoaPods is installed
if ! command -v pod &> /dev/null; then
    echo "❌ CocoaPods is not installed. Installing..."
    sudo gem install cocoapods
else
    echo "✅ CocoaPods is installed"
fi

# Install dependencies
echo "📦 Installing JavaScript dependencies..."
npm install

echo "📱 Installing iOS dependencies..."
cd ios
bundle install
bundle exec pod install
cd ..

echo ""
echo "🎯 Next steps:"
echo "1. Open ios/AssistantAppRN.xcworkspace in Xcode"
echo "2. Select your project in the navigator"
echo "3. Go to 'Signing & Capabilities' tab"
echo "4. Select your development team"
echo "5. Update the Bundle Identifier if needed"
echo ""
echo "6. Run the app:"
echo "   npx react-native run-ios"
echo ""
echo "Or run from Xcode by clicking the Play button"
echo ""
echo "🚀 Happy coding!"
